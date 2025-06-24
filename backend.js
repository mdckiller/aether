const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const LinkAPI = require('./linkapi');

// Carica configurazione da config.yaml
const configPath = path.join(__dirname, 'config.yaml');
const localConfigPath = path.join(__dirname, 'config.local.yaml');
let config;

try {
    // Carica configurazione principale
    const fileContents = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(fileContents);
    
    // Carica configurazione locale se esiste (sovrascrive quella principale)
    if (fs.existsSync(localConfigPath)) {
        const localFileContents = fs.readFileSync(localConfigPath, 'utf8');
        const localConfig = yaml.load(localFileContents);
        
        // Merge delle configurazioni (locale sovrascrive principale)
        config = mergeDeep(config, localConfig);
        console.log('✓ Configurazione locale caricata da config.local.yaml');
    }
} catch (error) {
    console.error('Errore nel caricamento dei file di configurazione:', error);
    process.exit(1);
}

// Funzione per merge profondo degli oggetti
function mergeDeep(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = mergeDeep(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

const app = express();
const PORT = config.server.port;

// Configurazione PostgreSQL
const pool = new Pool({
    user: config.database.user,
    host: config.database.host,
    database: config.database.name,
    password: config.database.password,
    port: config.database.port,
    max: config.database.pool.max,
    idleTimeoutMillis: config.database.pool.idle_timeout,
    connectionTimeoutMillis: config.database.pool.connection_timeout,
});

// Inizializza LinkAPI
const linkAPI = new LinkAPI(config);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'html')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Middleware per autenticazione
const authenticateUser = async (req, res, next) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionToken;
    
    if (!sessionToken) {
        return res.status(401).json({ error: 'Token di sessione richiesto' });
    }
    
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.email 
             FROM users u 
             JOIN user_sessions s ON u.id = s.user_id 
             WHERE s.session_token = $1 AND s.expires_at > NOW()`,
            [sessionToken]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Sessione non valida o scaduta' });
        }
        
        req.user = result.rows[0];
        next();
    } catch (error) {
        console.error('Errore autenticazione:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
};

// === ROUTES AUTENTICAZIONE ===

// Registrazione utente
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email e password sono richiesti' });
    }
    
    try {
        // Verifica se utente esiste già
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username o email già esistenti' });
        }
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Inserisci nuovo utente
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, passwordHash]
        );
        
        res.status(201).json({
            message: 'Utente registrato con successo',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Errore registrazione:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Login utente
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username e password sono richiesti' });
    }
    
    try {
        // Trova utente
        const result = await pool.query(
            'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
            [username]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }
        
        const user = result.rows[0];
        
        // Verifica password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }
        
        // Genera token sessione
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore
        
        // Salva sessione
        await pool.query(
            'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
            [user.id, sessionToken, expiresAt]
        );
        
        res.json({
            message: 'Login effettuato con successo',
            user: { id: user.id, username: user.username, email: user.email },
            sessionToken,
            expiresAt
        });
    } catch (error) {
        console.error('Errore login:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Logout utente
app.post('/api/auth/logout', authenticateUser, async (req, res) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    
    try {
        await pool.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
        res.json({ message: 'Logout effettuato con successo' });
    } catch (error) {
        console.error('Errore logout:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni dati utente corrente
app.get('/api/auth/me', authenticateUser, async (req, res) => {
    try {
        res.json({
            id: req.user.id,
            username: req.user.username,
            email: req.user.email
        });
    } catch (error) {
        console.error('Errore recupero dati utente:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// === ROUTES NOTES ===

// API per elaborare note da link
app.post('/api/notes/from-link', authenticateUser, async (req, res) => {
    const { url, mode, includeImages } = req.body;
    // Add artificial delay for development/testing
    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
    if (!url) {
        return res.status(400).json({ error: 'URL è richiesto' });
    }
    
    if (!mode || !['formatted', 'summary', 'plain'].includes(mode)) {
        return res.status(400).json({ error: 'Modalità non valida. Deve essere: formatted, summary, plain' });
    }
    
    try {
        // Utilizza il modulo LinkAPI per elaborare il link
        const result = await linkAPI.processLink(url, mode, includeImages);
        
        res.json({
            success: true,
            title: result.title,
            html: result.html,
            metadata: {
                ...result.metadata,
                processedAt: new Date().toISOString(),
                userId: req.user.id
            }
        });
    } catch (error) {
        console.error('Errore elaborazione link:', error);
        res.status(500).json({ error: 'Errore interno del server durante l\'elaborazione del link' });
    }
});

// Ottieni tutte le note dell'utente
app.get('/api/notes', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, content, content_html, tags, is_favorite, is_archived,
                    column_index, sort_order, height, z_index, created_at, updated_at
             FROM notes 
             WHERE user_id = $1 AND is_archived = FALSE
             ORDER BY column_index, sort_order`,
            [req.user.id]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Errore recupero note:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Ottieni nota specifica
app.get('/api/notes/:id', authenticateUser, async (req, res) => {
    const noteId = parseInt(req.params.id);
    
    try {
        const result = await pool.query(
            `SELECT id, title, content, content_html, tags, is_favorite, is_archived,
                    column_index, sort_order, height, z_index, created_at, updated_at
             FROM notes 
             WHERE id = $1 AND user_id = $2`,
            [noteId, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nota non trovata' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Errore recupero nota:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Crea nuova nota
app.post('/api/notes', authenticateUser, async (req, res) => {
    const {
        title = 'Nuova Nota',
        content = '',
        content_html = '',
        tags = [],
        column_index = 0,
        sort_order = 0,

        height = 200
    } = req.body;
    
    try {
        // Se sort_order non è specificato o è 0, trova il prossimo disponibile nella colonna
        let finalSortOrder = sort_order;
        if (sort_order === undefined || sort_order === null || sort_order === 0) {
            const maxOrderResult = await pool.query(
                'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM notes WHERE user_id = $1 AND column_index = $2 AND is_archived = FALSE',
                [req.user.id, column_index]
            );
            finalSortOrder = maxOrderResult.rows[0].next_order;
        }
        
        const result = await pool.query(
            `INSERT INTO notes (user_id, title, content, content_html, tags, column_index, sort_order, height)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, title, content, content_html, tags, is_favorite, is_archived,
                       column_index, sort_order, height, z_index, created_at, updated_at`,
            [req.user.id, title, content, content_html, tags, column_index, finalSortOrder, height]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Errore creazione nota:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Aggiorna nota
app.put('/api/notes/:id', authenticateUser, async (req, res) => {
    const noteId = parseInt(req.params.id);
    const {
        title,
        content,
        content_html,
        tags,
        is_favorite,
        height,
        z_index
    } = req.body;
    
    try {
        // Costruisci query dinamica per aggiornare solo i campi forniti
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (title !== undefined) {
            updates.push(`title = $${paramCount++}`);
            values.push(title);
        }
        if (content !== undefined) {
            updates.push(`content = $${paramCount++}`);
            values.push(content);
        }
        if (content_html !== undefined) {
            updates.push(`content_html = $${paramCount++}`);
            values.push(content_html);
        }
        if (tags !== undefined) {
            updates.push(`tags = $${paramCount++}`);
            values.push(tags);
        }
        if (is_favorite !== undefined) {
            updates.push(`is_favorite = $${paramCount++}`);
            values.push(is_favorite);
        }
        if (req.body.column_index !== undefined) {
            updates.push(`column_index = $${paramCount++}`);
            values.push(parseInt(req.body.column_index));
        }
        if (req.body.sort_order !== undefined) {
            updates.push(`sort_order = $${paramCount++}`);
            values.push(parseInt(req.body.sort_order));
        }

        if (height !== undefined) {
            updates.push(`height = $${paramCount++}`);
            values.push(Math.round(parseFloat(height)));
        }
        if (z_index !== undefined) {
            updates.push(`z_index = $${paramCount++}`);
            values.push(z_index);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare' });
        }
        
        values.push(noteId, req.user.id);
        
        const result = await pool.query(
            `UPDATE notes SET ${updates.join(', ')}
             WHERE id = $${paramCount++} AND user_id = $${paramCount++}
             RETURNING id, title, content, content_html, tags, is_favorite, is_archived,
                       column_index, sort_order, height, z_index, created_at, updated_at`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nota non trovata' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Errore aggiornamento nota:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Elimina nota (soft delete)
app.delete('/api/notes/:id', authenticateUser, async (req, res) => {
    const noteId = parseInt(req.params.id);
    
    try {
        const result = await pool.query(
            'UPDATE notes SET is_archived = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
            [noteId, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nota non trovata' });
        }
        
        res.json({ message: 'Nota archiviata con successo' });
    } catch (error) {
        console.error('Errore eliminazione nota:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// === ROUTES PREFERENZE UTENTE ===

// Carica tutte le preferenze utente
app.get('/api/preferences', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT key, value FROM user_preferences WHERE user_id = $1',
            [req.user.id]
        );
        
        // Converte array di preferenze in oggetto
        const preferences = {};
        result.rows.forEach(row => {
            preferences[row.key] = row.value;
        });
        
        res.json(preferences);
    } catch (error) {
        console.error('Errore nel caricamento delle preferenze:', error);
        res.status(500).json({ error: 'Errore nel caricamento delle preferenze' });
    }
});

// Salva tutte le preferenze utente
app.post('/api/preferences', authenticateUser, async (req, res) => {
    try {
        const preferences = req.body;
        
        if (!preferences || typeof preferences !== 'object') {
            return res.status(400).json({ error: 'Formato preferenze non valido' });
        }
        
        // Inizia transazione
        await pool.query('BEGIN');
        
        try {
            // Elimina tutte le preferenze esistenti per l'utente
            await pool.query(
                'DELETE FROM user_preferences WHERE user_id = $1',
                [req.user.id]
            );
            
            // Inserisce le nuove preferenze
            for (const [key, value] of Object.entries(preferences)) {
                await pool.query(
                    'INSERT INTO user_preferences (user_id, key, value) VALUES ($1, $2, $3)',
                    [req.user.id, key, String(value)]
                );
            }
            
            // Conferma transazione
            await pool.query('COMMIT');
            
            res.json({ success: true, message: 'Preferenze salvate con successo' });
        } catch (error) {
            // Rollback in caso di errore
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Errore nel salvataggio delle preferenze:', error);
        res.status(500).json({ error: 'Errore nel salvataggio delle preferenze' });
    }
});

// === ROUTES UTILITÀ ===

// Verifica stato server
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// Gestione errori globale
app.use((err, req, res, next) => {
    console.error('Errore non gestito:', err);
    res.status(500).json({ error: 'Errore interno del server' });
});

// Avvio server
app.listen(PORT, () => {
    console.log(`🚀 Server avviato su porta ${PORT}`);
    console.log(`📝 Aether disponibile su http://localhost:${PORT}`);
    console.log(`🔗 API disponibili su http://localhost:${PORT}/api`);
});

// Gestione chiusura graceful
process.on('SIGINT', async () => {
    console.log('\n🛑 Chiusura server in corso...');
    await pool.end();
    process.exit(0);
});

module.exports = app;