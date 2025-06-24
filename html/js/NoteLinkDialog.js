/**
 * NoteLinkDialog - Dialog per creare note da link
 */
class NoteLinkDialog {
    static show(prefilledUrl = '') {
        // Crea il contenuto della dialog
        const dialogContent = `
            <div class="note-link-form">
                <div class="form-group">
                    <label for="urlInput">URL:</label>
                    <input type="url" id="urlInput" placeholder="https://esempio.com" value="${prefilledUrl}" required>
                </div>
                
                <div class="form-group">
                    <label>Modalità:</label>
                    <div class="radio-group">
                        <div class="radio-option">
                            <input type="radio" id="modeFormatted" name="mode" value="formatted" checked>
                            <label for="modeFormatted">
                                <span class="radio-custom"></span>
                                <span class="radio-label">
                                    <strong>Formattato</strong>
                                    <small>Testo formattato (HTML, contenuto principale basato su Readability)</small>
                                </span>
                            </label>
                        </div>
                        
                        <div class="radio-option">
                            <input type="radio" id="modeSummary" name="mode" value="summary">
                            <label for="modeSummary">
                                <span class="radio-custom"></span>
                                <span class="radio-label">
                                    <strong>Riassunto</strong>
                                    <small>Testo non formattato, da inviare a OpenAI per ottenere un resoconto</small>
                                </span>
                            </label>
                        </div>
                        
                        <div class="radio-option">
                            <input type="radio" id="modePlain" name="mode" value="plain">
                            <label for="modePlain">
                                <span class="radio-custom"></span>
                                <span class="radio-label">
                                    <strong>Semplice</strong>
                                    <small>Testo non formattato così com'è</small>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <div class="checkbox-group">
                        <div class="checkbox-option">
                            <input type="checkbox" id="includeImages" checked>
                            <label for="includeImages">
                                <span class="checkbox-custom"></span>
                                <span class="checkbox-label">Includi immagini (solo in modalità formattato)</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Crea la dialog usando DialogManager
        const dialog = DialogManager.show({
            title: 'Nuova nota da link',
            message: '', // Useremo il body personalizzato
            type: 'info',
            buttons: [
                {
                    text: 'Annulla',
                    class: 'btn-secondary',
                    handler: () => {
                        return true; // Chiudi dialog
                    }
                },
                {
                    text: 'Crea',
                    class: 'btn-primary',
                    handler: () => {
                        return this.handleCreate();
                    }
                }
            ]
        });
        
        // Sostituisci il contenuto del body con il nostro form personalizzato
        const dialogBody = dialog.querySelector('.dialog-body');
        dialogBody.innerHTML = dialogContent;
        
        // Aggiungi event listeners
        this.setupEventListeners(dialog);
        
        return dialog;
    }
    
    static setupEventListeners(dialog) {
        const urlInput = dialog.querySelector('#urlInput');
        const includeImagesCheckbox = dialog.querySelector('#includeImages');
        const modeRadios = dialog.querySelectorAll('input[name="mode"]');
        
        // Gestisci l'abilitazione/disabilitazione del checkbox immagini
        const updateImageCheckbox = () => {
            const selectedMode = dialog.querySelector('input[name="mode"]:checked').value;
            const isFormatted = selectedMode === 'formatted';
            
            includeImagesCheckbox.disabled = !isFormatted;
            const checkboxOption = dialog.querySelector('.checkbox-option');
            
            if (isFormatted) {
                checkboxOption.classList.remove('disabled');
            } else {
                checkboxOption.classList.add('disabled');
                includeImagesCheckbox.checked = false;
            }
        };
        
        // Event listener per i radio button
        modeRadios.forEach(radio => {
            radio.addEventListener('change', updateImageCheckbox);
        });
        
        // Inizializza lo stato del checkbox
        updateImageCheckbox();
        
        // Focus sull'input URL
        setTimeout(() => {
            urlInput.focus();
        }, 100);
    }
    
    static async handleCreate() {
        const dialog = DialogManager.activeDialog;
        if (!dialog) return true;
        
        const urlInput = dialog.querySelector('#urlInput');
        const selectedMode = dialog.querySelector('input[name="mode"]:checked').value;
        const includeImages = dialog.querySelector('#includeImages').checked;
        const createButton = dialog.querySelector('.btn-primary');
        
        const url = urlInput.value.trim();
        
        // Validazione URL
        if (!url) {
            this.showError(urlInput, 'Inserisci un URL valido');
            return false; // Non chiudere la dialog
        }
        
        // Validazione formato URL
        try {
            new URL(url);
        } catch (e) {
            this.showError(urlInput, 'URL non valido');
            return false;
        }
        
        // Rimuovi eventuali errori precedenti
        this.clearError(urlInput);
        
        // Avvia animazione di caricamento sul bottone
        const originalText = createButton.textContent;
        createButton.disabled = true;
        createButton.innerHTML = '<span class="loading-spinner"></span> Creazione...';
        createButton.classList.add('loading');
        
        try {
            // Crea la nota
            await this.createNoteFromLink({
                url: url,
                mode: selectedMode,
                includeImages: includeImages
            });
            
            return true; // Chiudi dialog
        } catch (error) {
            // Ripristina il bottone in caso di errore
            createButton.disabled = false;
            createButton.textContent = originalText;
            createButton.classList.remove('loading');
            return false; // Non chiudere la dialog
        }
    }
    
    static showError(input, message) {
        // Rimuovi errore precedente
        this.clearError(input);
        
        // Aggiungi classe di errore
        input.classList.add('error');
        
        // Crea messaggio di errore
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Inserisci dopo l'input
        input.parentNode.insertBefore(errorDiv, input.nextSibling);
    }
    
    static clearError(input) {
        input.classList.remove('error');
        const errorMessage = input.parentNode.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }
    
    static async createNoteFromLink(options) {
        try {
            // Chiama la nuova API per elaborare il link
            const response = await this.fetchFromLinkAPI(options);
            
            if (!response.success) {
                throw new Error('Errore nell\'elaborazione del link');
            }
            
            const noteData = {
                title: response.title,
                content_html: response.html
            };
            console.log('HTML:', response.html);
            // Crea la nota usando il sistema esistente
            if (typeof NotesManager !== 'undefined' && NotesManager.createNote) {
                const newNote = await NotesManager.createNote(noteData);
                
                // Crea il pannello UI tramite PanelManager
                if (typeof PanelManager !== 'undefined' && PanelManager.createNewNote) {
                    PanelManager.createNewNote(newNote);
                }
            } else {
                // Fallback: crea nota manualmente
                console.log('Creazione nota:', { title: response.title, content: response.html });
            }
        } catch (error) {
            console.error('Errore nella creazione della nota da link:', error);
            throw error;
        }
    }
    
    static async fetchFromLinkAPI(options) {
        const API_BASE = './api';
        const sessionToken = localStorage.getItem('sessionToken');
        
        if (!sessionToken) {
            throw new Error('Token di sessione non trovato');
        }
        
        try {
            const response = await fetch(`${API_BASE}/notes/from-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                    url: options.url,
                    mode: options.mode,
                    includeImages: options.includeImages
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore nella chiamata API');
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Errore nella chiamata API from-link:', error);
            throw error;
        }
    }
}

// Esporta per uso globale
window.NoteLinkDialog = NoteLinkDialog;