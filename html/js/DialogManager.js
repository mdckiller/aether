/**
 * DialogManager - Utility per creare dialog personalizzabili con lo stile dell'applicazione
 */
class DialogManager {
    static activeDialog = null;

    /**
     * Crea e mostra una dialog personalizzabile
     * @param {Object} options - Opzioni per la dialog
     * @param {string} options.title - Titolo della dialog
     * @param {string} options.message - Messaggio della dialog
     * @param {Array} options.buttons - Array di bottoni con {text, class, handler}
     * @param {string} options.type - Tipo di dialog ('info', 'warning', 'error', 'question')
     * @param {boolean} options.modal - Se la dialog è modale (default: true)
     * @param {Function} options.onClose - Callback quando la dialog viene chiusa
     */
    static show(options) {
        // Chiudi dialog esistente se presente
        if (this.activeDialog) {
            this.close();
        }

        const {
            title = 'Dialog',
            message = '',
            buttons = [],
            type = 'info',
            modal = true,
            onClose = null
        } = options;

        // Crea overlay
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        if (modal) {
            overlay.classList.add('modal');
        }

        // Crea dialog
        const dialog = document.createElement('div');
        dialog.className = `dialog dialog-${type}`;

        // Header della dialog
        const header = document.createElement('div');
        header.className = 'dialog-header';
        
        const titleElement = document.createElement('h3');
        titleElement.className = 'dialog-title';
        titleElement.textContent = title;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'dialog-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => this.close(onClose);
        
        header.appendChild(titleElement);
        header.appendChild(closeButton);

        // Body della dialog
        const body = document.createElement('div');
        body.className = 'dialog-body';
        
        // Icona basata sul tipo
        const icon = document.createElement('div');
        icon.className = `dialog-icon dialog-icon-${type}`;
        icon.innerHTML = this.getIconForType(type);
        
        const messageElement = document.createElement('div');
        messageElement.className = 'dialog-message';
        messageElement.textContent = message;
        
        body.appendChild(icon);
        body.appendChild(messageElement);

        // Footer con bottoni
        const footer = document.createElement('div');
        footer.className = 'dialog-footer';
        
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = `btn ${button.class || 'btn-secondary'}`;
            btn.textContent = button.text;
            btn.onclick = async () => {
                if (button.handler) {
                    const result = button.handler();
                    // Se il handler restituisce una Promise, aspetta il completamento
                    if (result instanceof Promise) {
                        try {
                            const promiseResult = await result;
                            // Se la Promise risolve con false, non chiudere la dialog
                            if (promiseResult !== false) {
                                this.close(onClose);
                            }
                        } catch (error) {
                            console.error('Errore nel handler del bottone:', error);
                            // In caso di errore, non chiudere la dialog
                        }
                    } else {
                        // Se il handler restituisce false, non chiudere la dialog
                        if (result !== false) {
                            this.close(onClose);
                        }
                    }
                } else {
                    this.close(onClose);
                }
            };
            footer.appendChild(btn);
        });

        // Assembla la dialog
        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);

        // Aggiungi al DOM
        document.body.appendChild(overlay);
        this.activeDialog = overlay;

        // Animazione di entrata
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });

        // Gestione ESC per chiudere
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.close(onClose);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Click sull'overlay per chiudere (solo se non modale)
        if (!modal) {
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.close(onClose);
                }
            };
        }

        return overlay;
    }

    /**
     * Chiude la dialog attiva
     * @param {Function} onClose - Callback opzionale
     */
    static close(onClose = null) {
        if (!this.activeDialog) return;

        const overlay = this.activeDialog;
        overlay.classList.add('hide');
        
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            this.activeDialog = null;
            if (onClose) {
                onClose();
            }
        }, 300);
    }

    /**
     * Crea una dialog di conferma Si/No
     * @param {string} title - Titolo della dialog
     * @param {string} message - Messaggio di conferma
     * @param {Function} onConfirm - Callback per conferma
     * @param {Function} onCancel - Callback per annullamento
     */
    static confirm(title, message, onConfirm, onCancel = null) {
        return this.show({
            title,
            message,
            type: 'question',
            buttons: [
                {
                    text: 'Annulla',
                    class: 'btn-secondary',
                    handler: () => {
                        if (onCancel) onCancel();
                        return true; // Chiudi dialog
                    }
                },
                {
                    text: 'Conferma',
                    class: 'btn-primary',
                    handler: () => {
                        if (onConfirm) onConfirm();
                        return true; // Chiudi dialog
                    }
                }
            ]
        });
    }

    /**
     * Crea una dialog di avviso con solo OK
     * @param {string} title - Titolo della dialog
     * @param {string} message - Messaggio
     * @param {string} type - Tipo ('info', 'warning', 'error')
     * @param {Function} onOk - Callback per OK
     */
    static alert(title, message, type = 'info', onOk = null) {
        return this.show({
            title,
            message,
            type,
            buttons: [
                {
                    text: 'OK',
                    class: 'btn-primary',
                    handler: () => {
                        if (onOk) onOk();
                        return true; // Chiudi dialog
                    }
                }
            ]
        });
    }

    /**
     * Restituisce l'icona SVG per il tipo di dialog
     * @param {string} type - Tipo di dialog
     * @returns {string} HTML dell'icona
     */
    static getIconForType(type) {
        const icons = {
            info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="2"/>
                <path d="M12 16v-4" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 8h.01" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
            warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#f59e0b" stroke-width="2"/>
                <path d="M12 9v4" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 17h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
            error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/>
                <path d="M15 9l-6 6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 9l6 6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
            question: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#8b5cf6" stroke-width="2"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 17h.01" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/>
            </svg>`
        };
        return icons[type] || icons.info;
    }
}

// Esporta per uso globale
window.DialogManager = DialogManager;