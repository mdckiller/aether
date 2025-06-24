// === CONFIGURAZIONE GLOBALE ===
const API_BASE = './api';
let currentUser = null;
let sessionToken = localStorage.getItem('sessionToken');
let notes = [];
let isAuthMode = 'login'; // 'login' o 'register'

// === GESTIONE AUTENTICAZIONE ===
class AuthManager {
    static async login(username, password) {


        
        try {
            const url = `${API_BASE}/auth/login`;

            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            


            
            const data = await response.json();

            
            if (response.ok) {
                sessionToken = data.sessionToken;
                currentUser = data.user;
                localStorage.setItem('sessionToken', sessionToken);

                return { success: true, data };
            } else {

                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('🚨 Errore di connessione:', error);
            return { success: false, error: 'Errore di connessione: ' + error.message };
        }
    }
    
    static async register(username, email, password) {
        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, data };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Errore di connessione' };
        }
    }
    
    static async logout() {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
        } catch (error) {
            console.error('Errore logout:', error);
        }
        
        sessionToken = null;
        currentUser = null;
        localStorage.removeItem('sessionToken');
        location.reload();
    }
}

// === GESTIONE NOTE ===
class NotesManager {
    static async fetchNotes() {


        
        try {
            const url = `${API_BASE}/notes`;

            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            

            
            if (response.ok) {
                notes = await response.json();

                return notes;
            } else {
                const errorData = await response.text();
                console.error('❌ Errore risposta server:', response.status, errorData);
                throw new Error('Errore caricamento note: ' + response.status);
            }
        } catch (error) {
            console.error('🚨 Errore fetch note:', error);
            return [];
        }
    }
    
    static async createNote(noteData = {}) {
        try {
            const response = await fetch(`${API_BASE}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify(noteData)
            });
            
            if (response.ok) {
                const newNote = await response.json();
                notes.push(newNote);
                return newNote;
            } else {
                throw new Error('Errore creazione nota');
            }
        } catch (error) {
            console.error('Errore creazione nota:', error);
            return null;
        }
    }
    
    static async updateNote(noteId, updates) {
        try {
            const response = await fetch(`${API_BASE}/notes/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify(updates)
            });
            
            if (response.ok) {
                const updatedNote = await response.json();
                const index = notes.findIndex(n => n.id === noteId);
                if (index !== -1) {
                    notes[index] = updatedNote;
                }
                return updatedNote;
            } else {
                throw new Error('Errore aggiornamento nota');
            }
        } catch (error) {
            console.error('Errore aggiornamento nota:', error);
            return null;
        }
    }
    
    static async saveAllNotes() {
        try {
            // Ottieni tutte le note che potrebbero essere state modificate
            const panels = document.querySelectorAll('.note-panel');
            const savePromises = [];
            
            panels.forEach(panel => {
                const noteId = panel.dataset.noteId;
                const quill = panel.quillEditor;
                const titleInput = panel.querySelector('.note-title');
                
                if (quill && titleInput) {
                    // Salva il contenuto e il titolo della nota
                    const savePromise = this.updateNote(noteId, {
                        title: titleInput.value,
                        content: quill.getText(),
                        content_html: quill.root.innerHTML
                    });
                    savePromises.push(savePromise);
                }
            });
            
            // Attendi che tutte le note siano salvate
            await Promise.all(savePromises);
            return true;
        } catch (error) {
            console.error('Errore nel salvataggio di tutte le note:', error);
            throw error;
        }
    }

    static async deleteNote(noteId) {
        try {
            const response = await fetch(`${API_BASE}/notes/${noteId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            
            if (response.ok) {
                notes = notes.filter(n => n.id !== noteId);
                return true;
            } else {
                throw new Error('Errore eliminazione nota');
            }
        } catch (error) {
            console.error('Errore eliminazione nota:', error);
            return false;
        }
    }
}

// === GESTIONE UI ===
class UIManager {
    static showSavingStatus(isShowing) {
        const saveAllBtn = document.getElementById('saveAllBtn');
        if (!saveAllBtn) return;
        
        if (isShowing) {
            saveAllBtn.classList.add('saving');
            const icon = saveAllBtn.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-spinner fa-spin';
            }
        } else {
            saveAllBtn.classList.remove('saving');
            const icon = saveAllBtn.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-save';
            }
        }
    }
}





// === UTILITÀ ===
// Le funzioni di utilità sono ora centralizzate in utils.js

// === INIZIALIZZAZIONE ===
document.addEventListener('DOMContentLoaded', async () => {
    // Carica le preferenze utente PRIMA di tutto
    await SaveManager.loadUserPreferences();
    
    // Ora inizializza il GAP dalle impostazioni caricate
    LayoutManager.updateGap();
    
    const loginModal = document.getElementById('loginModal');
    const authForm = document.getElementById('authForm');
    const toggleAuthBtn = document.getElementById('toggleAuthBtn');
    const modalTitle = document.getElementById('modalTitle');
    const emailGroup = document.getElementById('emailGroup');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authError = document.getElementById('authError');
    const authSuccess = document.getElementById('authSuccess');
    
    // Verifica sessione esistente
    if (sessionToken) {
        try {
            // Verifica la validità della sessione recuperando i dati dell'utente
            const userResponse = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                loginModal.classList.add('hidden');
                document.getElementById('userDisplay').textContent = userData.username;
                await PanelManager.renderNotes();
            } else {
                throw new Error('Sessione non valida');
            }
        } catch (error) {
            localStorage.removeItem('sessionToken');
            sessionToken = null;
        }
    } else {
    }
    
    // Toggle tra login e registrazione
    toggleAuthBtn.addEventListener('click', () => {
        isAuthMode = isAuthMode === 'login' ? 'register' : 'login';
        
        if (isAuthMode === 'register') {
            modalTitle.textContent = 'Crea nuovo account';
            emailGroup.style.display = 'block';
            authSubmitBtn.textContent = 'Registrati';
            toggleAuthBtn.textContent = 'Accedi';
            document.getElementById('email').required = true;
        } else {
            modalTitle.textContent = 'Accedi al tuo account';
            emailGroup.style.display = 'none';
            authSubmitBtn.textContent = 'Accedi';
            toggleAuthBtn.textContent = 'Registrati';
            document.getElementById('email').required = false;
        }
    });
    
    // Gestione form autenticazione
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        

        
        authSubmitBtn.classList.add('loading');
        authError.classList.add('hidden');
        authSuccess.classList.add('hidden');
        
        let result;
        
        if (isAuthMode === 'login') {

            result = await AuthManager.login(username, password);
        } else {

            result = await AuthManager.register(username, email, password);
        }
        

        authSubmitBtn.classList.remove('loading');
        
        if (result.success) {

            if (isAuthMode === 'register') {
                showSuccess(authSuccess, 'Account creato! Ora puoi accedere.');
                toggleAuthBtn.click(); // Passa al login
            } else {

                loginModal.classList.add('hidden');
                document.getElementById('userDisplay').textContent = result.data.user.username;
                await PanelManager.renderNotes();

            }
        } else {

            showError(authError, result.error);
        }
    });
    
    // Event listeners toolbar
    document.getElementById('newNoteBtn').addEventListener('click', async () => {

        
        try {
            const newNote = await NotesManager.createNote({
                title: 'Nuova nota',
                content: '',
                content_html: ''
            });
            

            
            // Crea il pannello UI tramite PanelManager
            PanelManager.createNewNote(newNote);
            
        } catch (error) {
            console.error('🚨 Errore nella creazione della nota:', error);
            showError(document.getElementById('authError'), 'Errore nella creazione della nota');
        }
    });
    
    document.getElementById('saveAllBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveAllBtn');
        const originalText = btn.innerHTML;
        
        try {
            // Mostra stato di salvataggio
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btn.disabled = true;
            
            // Salva tutte le note modificate
            await NotesManager.saveAllNotes();
            
            // Mostra successo
            btn.innerHTML = '<i class="fas fa-check"></i> Salvato!';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        } catch (error) {
            // Mostra errore
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Errore!';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        }
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        AuthManager.logout();
    });

    // Event listener per il bottone impostazioni
    document.getElementById('settingsBtn').addEventListener('click', () => {
        showSettingsDialog();
    });
    
    // Event listener per il bottone nota da link
    document.getElementById('noteLinkBtn').addEventListener('click', () => {
        NoteLinkDialog.show();
    });
    
    // Function to deselect all notes and disable editors
    function deselectAllNotes() {
        // Disable all Quill editors
        document.querySelectorAll('.note-panel').forEach(panel => {
            const quill = panel.quillEditor;
            if (quill && quill.isEnabled()) {
                // Salva la nota prima di disabilitare l'editor
                if (panel.saveIfEnabled) {
                    panel.saveIfEnabled();
                }
                quill.disable();
                panel.classList.add('readonly');
            }
        });
        // Reset selection
        lastSelectedNoteId = null;
        PanelManager.activeNoteId = null;
        PanelManager.lastSelectedNoteId = null;
        document.querySelectorAll('.note-panel').forEach(p => p.classList.remove('active'));
    }

    // Handle clicks on workspace to disable editors
    document.getElementById('workspace').addEventListener('mousedown', (e) => {
        // Only proceed if click target is workspace itself and not any child elements
        // Also check if the click is not on note controls (menu, close button, etc.)
        const isNoteControl = e.target.closest('.note-btn, .note-menu, .note-controls, .note-header');
        
        if (e.target === e.currentTarget && !isNoteControl) {
            deselectAllNotes();
        }
    });
    
    // Handle clicks on header/toolbar to disable editors
    document.querySelector('.header').addEventListener('mousedown', (e) => {
        // Only proceed if click target is not a button or interactive element
        const isButton = e.target.closest('button, .btn');
        const isInteractive = e.target.closest('input, select, textarea');
        
        if (!isButton && !isInteractive) {
            deselectAllNotes();
        }
    });
    
    // Riorganizza la griglia quando cambia la dimensione della finestra
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            PanelManager.organizeGridLayout();
        }, 300);
    });
    
    // Handle paste on workspace when no note is selected
    document.addEventListener('paste', async (e) => {
        // Only handle paste if no note is currently active and target is workspace or body
        // const isWorkspaceOrBody = e.target === document.getElementById('workspace') || e.target === document.body;
        const noActiveNote = !PanelManager.activeNoteId;
        
        // Check if there's a modal dialog open
        const hasModalDialog = document.querySelector('.dialog-overlay');
        
        // Check if focus is on an input element
        const activeElement = document.activeElement;
        const isFocusOnInput = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.contentEditable === 'true' ||
            activeElement.closest('.ql-editor')
        );
        
        // Don't handle paste if there's a modal dialog or focus is on input
        if (hasModalDialog || isFocusOnInput) {
            return;
        }
        
        if (noActiveNote) {
            e.preventDefault();
            
            // Get clipboard data
            const clipboardData = e.clipboardData || window.clipboardData;
            let pastedText = clipboardData.getData('text/plain');
            let pastedHtml = clipboardData.getData('text/html');
            
            if (!pastedText && !pastedHtml) {
                return;
            }
            
            // Check if pasted text is a URL using regex
            const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
            
            if (pastedText && urlRegex.test(pastedText.trim())) {
                // If it's a URL, open the NoteLinkDialog with pre-filled URL
                NoteLinkDialog.show(pastedText.trim());
            } else {
                // Create a new note with the pasted content
                try {
                    const noteData = {
                        title: pastedText ? pastedText.substring(0, 50).replace(/\n/g, ' ') + (pastedText.length > 50 ? '...' : '') : 'Nota incollata',
                        content_html: pastedHtml || pastedText || ''
                    };
                    
                    const newNote = await NotesManager.createNote(noteData);
                    if (newNote) {
                        PanelManager.createNewNote(newNote);
                    }
                } catch (error) {
                    console.error('Errore durante la creazione della nota:', error);
                }
            }
        }
    });
    
    // Disabilita menu contestuale (tasto destro) ovunque tranne che negli editor Quill
    document.addEventListener('contextmenu', (e) => {
        // Permetti menu contestuale solo negli editor Quill e nei campi di input
        const isQuillEditor = e.target.closest('.ql-editor');
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        const isNoteTitle = e.target.classList.contains('note-title');
        
        if (!isQuillEditor && !isInput && !isNoteTitle) {
            e.preventDefault();
            return false;
        }
     });
});

/**
 * Mostra la dialog delle impostazioni
 */
function showSettingsDialog() {
    // Ottieni le preferenze correnti
    const currentColumns = SaveManager.getPreference('columns', '3');
    const currentGap = SaveManager.getPreference('gap', '20');
    
    // Crea il contenuto della dialog
    const settingsContent = `
        <div class="settings-form">
            <div class="form-group">
                <label for="columnsSpinner">Numero di colonne:</label>
                <div class="spinner-container">
                    <button type="button" class="spinner-btn" id="decreaseColumns">-</button>
                    <input type="number" id="columnsSpinner" value="${currentColumns}" min="1" max="10">
                    <button type="button" class="spinner-btn" id="increaseColumns">+</button>
                </div>
            </div>
            <div class="form-group">
                <label for="gapSpinner">Spaziatura tra colonne (px):</label>
                <div class="spinner-container">
                    <button type="button" class="spinner-btn" id="decreaseGap">-</button>
                    <input type="number" id="gapSpinner" value="${currentGap}" min="5" max="100">
                    <button type="button" class="spinner-btn" id="increaseGap">+</button>
                </div>
            </div>
        </div>
    `;
    
    // Crea la dialog personalizzata
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay modal';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog dialog-info';
    
    // Header
    const header = document.createElement('div');
    header.className = 'dialog-header';
    
    const title = document.createElement('h3');
    title.className = 'dialog-title';
    title.textContent = 'Impostazioni';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'dialog-close';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => closeSettingsDialog(overlay);
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Body
    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.innerHTML = settingsContent;
    
    // Footer
    const footer = document.createElement('div');
    footer.className = 'dialog-footer';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Annulla';
    cancelBtn.onclick = () => closeSettingsDialog(overlay);
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Salva';
    saveBtn.onclick = () => saveSettings(overlay);
    
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    
    // Assembla la dialog
    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    
    // Aggiungi al DOM
    document.body.appendChild(overlay);
    
    // Animazione di entrata
    requestAnimationFrame(() => {
        overlay.classList.add('show');
    });
    
    // Event listeners per gli spinner
    const columnsInput = document.getElementById('columnsSpinner');
    const decreaseColumnsBtn = document.getElementById('decreaseColumns');
    const increaseColumnsBtn = document.getElementById('increaseColumns');
    
    const gapInput = document.getElementById('gapSpinner');
    const decreaseGapBtn = document.getElementById('decreaseGap');
    const increaseGapBtn = document.getElementById('increaseGap');
    
    // Funzione di validazione per i valori
    function validateInput(input, min, max) {
        let value = parseInt(input.value);
        if (isNaN(value) || value < min) {
            input.value = min;
        } else if (value > max) {
            input.value = max;
        }
    }
    
    // Event listeners per le colonne
    decreaseColumnsBtn.addEventListener('click', () => {
        const current = parseInt(columnsInput.value);
        if (current > 1) {
            columnsInput.value = current - 1;
        }
    });
    
    increaseColumnsBtn.addEventListener('click', () => {
        const current = parseInt(columnsInput.value);
        if (current < 10) {
            columnsInput.value = current + 1;
        }
    });
    
    // Validazione input manuale per le colonne
    columnsInput.addEventListener('input', () => {
        validateInput(columnsInput, 1, 10);
    });
    
    columnsInput.addEventListener('blur', () => {
        validateInput(columnsInput, 1, 10);
    });
    
    // Event listeners per il GAP
    decreaseGapBtn.addEventListener('click', () => {
        const current = parseInt(gapInput.value);
        if (current > 5) {
            gapInput.value = current - 5;
        }
    });
    
    increaseGapBtn.addEventListener('click', () => {
        const current = parseInt(gapInput.value);
        if (current < 100) {
            gapInput.value = current + 5;
        }
    });
    
    // Validazione input manuale per il gap
    gapInput.addEventListener('input', () => {
        validateInput(gapInput, 5, 100);
    });
    
    gapInput.addEventListener('blur', () => {
        validateInput(gapInput, 5, 100);
    });
    
    // Gestione ESC
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeSettingsDialog(overlay);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Chiude la dialog delle impostazioni
 */
function closeSettingsDialog(overlay) {
    overlay.classList.remove('show');
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, 300);
}

/**
 * Salva le impostazioni
 */
async function saveSettings(overlay) {
    const columnsInput = document.getElementById('columnsSpinner');
    const gapInput = document.getElementById('gapSpinner');
    const newColumns = columnsInput.value;
    const newGap = gapInput.value;
    
    try {
        // Aggiorna le preferenze in memoria
        SaveManager.setPreference('columns', newColumns);
        SaveManager.setPreference('gap', newGap);
        
        // Aggiorna il GAP in LayoutManager
        LayoutManager.updateGap();
        
        // Salva sul server
        const success = await SaveManager.saveUserPreferences(SaveManager.userPreferences);
        
        if (success) {
            // Riorganizza il layout con le nuove impostazioni
            PanelManager.organizeGridLayout();
            closeSettingsDialog(overlay);
        } else {
            alert('Errore durante il salvataggio delle impostazioni');
        }
    } catch (error) {
        console.error('Errore salvataggio impostazioni:', error);
        alert('Errore durante il salvataggio delle impostazioni');
    }
}