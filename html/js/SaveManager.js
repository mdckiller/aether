/**
 * Gestisce il salvataggio delle note con debounce e feedback visivo
 * e la gestione delle preferenze utente
 */
class SaveManager {
    // Cache delle preferenze utente
    static userPreferences = new Map();
    static preferencesLoaded = false;
    /**
     * Salva con debounce per evitare troppe chiamate al server
     * @param {HTMLElement} element - Elemento a cui associare il timeout
     * @param {Function} saveFunction - Funzione di salvataggio da eseguire
     * @param {number} delay - Ritardo in millisecondi (default: 300)
     * @param {string} timeoutProperty - Nome della proprietà timeout (default: 'saveTimeout')
     */
    static debouncedSave(element, saveFunction, delay = 300, timeoutProperty = 'saveTimeout') {
        if (!element || typeof saveFunction !== 'function') {
            console.error('SaveManager: elemento o funzione di salvataggio non validi');
            return;
        }
        
        // Cancella il timeout precedente
        if (element[timeoutProperty]) {
            clearTimeout(element[timeoutProperty]);
        }
        
        // Imposta il nuovo timeout
        element[timeoutProperty] = setTimeout(() => {
            try {
                saveFunction();
            } catch (error) {
                console.error('Errore durante il salvataggio:', error);
            }
        }, delay);
    }
    
    /**
     * Salva il contenuto di una nota con feedback visivo
     * @param {number} noteId - ID della nota
     * @param {Object} updates - Aggiornamenti da salvare
     * @param {boolean} showFeedback - Mostra feedback visivo (default: true)
     * @returns {Promise} Promise del salvataggio
     */
    static async saveNote(noteId, updates, showFeedback = true) {
        if (showFeedback) {
            UIManager.showSavingStatus(true);
        }
        
        try {
            const result = await NotesManager.updateNote(noteId, updates);
            
            if (showFeedback) {
                // Mantieni il feedback visibile per almeno 800ms
                setTimeout(() => {
                    UIManager.showSavingStatus(false);
                }, 800);
            }
            
            return result;
        } catch (error) {
            console.error('Errore salvataggio nota:', error);
            
            if (showFeedback) {
                setTimeout(() => {
                    UIManager.showSavingStatus(false);
                }, 800);
            }
            
            throw error;
        }
    }
    
    /**
     * Salva la posizione di una nota con debounce
     * @param {HTMLElement} panel - Pannello della nota
     * @param {number} noteId - ID della nota
     * @param {Object} position - Oggetto con x, y, width, height
     * @param {number} delay - Ritardo per il debounce (default: 300)
     */
    static debouncedSavePosition(panel, noteId, position, delay = 300) {
        this.debouncedSave(panel, () => {
            this.saveNote(noteId, position, true);
        }, delay, 'positionSaveTimeout');
    }
    
    /**
     * Salva le dimensioni di una nota con debounce
     * @param {HTMLElement} panel - Pannello della nota
     * @param {number} noteId - ID della nota
     * @param {Object} dimensions - Oggetto con width e/o height
     * @param {number} delay - Ritardo per il debounce (default: 300)
     */
    static debouncedSaveDimensions(panel, noteId, dimensions, delay = 300) {
        this.debouncedSave(panel, () => {
            this.saveNote(noteId, dimensions, true);
        }, delay, 'dimensionsSaveTimeout');
    }
    
    /**
     * Cancella tutti i timeout di salvataggio per un elemento
     * @param {HTMLElement} element - Elemento di cui cancellare i timeout
     */
    static clearAllTimeouts(element) {
        const timeoutProperties = [
            'saveTimeout',
            'positionSaveTimeout', 
            'dimensionsSaveTimeout',
            'dbUpdateTimeout',
            'resizeTimeout',
            'repositionTimeout',
            'resizeHandleTimeout'
        ];
        
        timeoutProperties.forEach(prop => {
            if (element[prop]) {
                clearTimeout(element[prop]);
                delete element[prop];
            }
        });
    }

    // === GESTIONE PREFERENZE UTENTE ===

    /**
     * Carica tutte le preferenze utente dal server
     * @returns {Promise<Map>} Map delle preferenze caricate
     */
    static async loadUserPreferences() {
        try {
            const sessionToken = localStorage.getItem('sessionToken');
            if (!sessionToken) {
                throw new Error('Token di sessione non trovato');
            }
            
            const response = await fetch('./api/preferences', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Errore caricamento preferenze: ${response.status}`);
            }

            const preferences = await response.json();
            
            // Popola la cache
            this.userPreferences.clear();
            Object.entries(preferences).forEach(([key, value]) => {
                this.userPreferences.set(key, value);
            });
            
            this.preferencesLoaded = true;
            
            return this.userPreferences;
        } catch (error) {
            console.error('Errore caricamento preferenze:', error);
            // Imposta valori di default in caso di errore
            this.setDefaultPreferences();
            return this.userPreferences;
        }
    }

    /**
     * Salva tutte le preferenze utente sul server
     * @param {Map|Object} preferences - Preferenze da salvare
     * @returns {Promise<boolean>} True se salvate con successo
     */
    static async saveUserPreferences(preferences) {
        try {
            const sessionToken = localStorage.getItem('sessionToken');
            if (!sessionToken) {
                throw new Error('Token di sessione non trovato');
            }
            
            // Converte Map in oggetto se necessario
            let prefsObject;
            if (preferences instanceof Map) {
                prefsObject = Object.fromEntries(preferences);
            } else {
                prefsObject = preferences;
            }

            const response = await fetch('./api/preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify(prefsObject)
            });

            if (!response.ok) {
                throw new Error(`Errore salvataggio preferenze: ${response.status}`);
            }

            // Aggiorna la cache locale
            Object.entries(prefsObject).forEach(([key, value]) => {
                this.userPreferences.set(key, value);
            });

            return true;
        } catch (error) {
            console.error('Errore salvataggio preferenze:', error);
            return false;
        }
    }

    /**
     * Ottiene una preferenza specifica
     * @param {string} key - Chiave della preferenza
     * @param {*} defaultValue - Valore di default se non trovata
     * @returns {*} Valore della preferenza
     */
    static getPreference(key, defaultValue = null) {
        return this.userPreferences.get(key) ?? defaultValue;
    }

    /**
     * Imposta una preferenza specifica
     * @param {string} key - Chiave della preferenza
     * @param {*} value - Valore da impostare
     */
    static setPreference(key, value) {
        this.userPreferences.set(key, value);
    }

    /**
     * Imposta le preferenze di default
     */
    static setDefaultPreferences() {
        const defaults = {
            'columns': '3',
            'gap': '20',
            'theme': 'light',
            'auto_save': 'true',
            'grid_snap': 'true'
        };

        Object.entries(defaults).forEach(([key, value]) => {
            if (!this.userPreferences.has(key)) {
                this.userPreferences.set(key, value);
            }
        });

        this.preferencesLoaded = true;
    }

    /**
     * Verifica se le preferenze sono state caricate
     * @returns {boolean} True se caricate
     */
    static arePreferencesLoaded() {
        return this.preferencesLoaded;
    }
}