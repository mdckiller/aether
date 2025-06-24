// === GESTIONE PANNELLI NOTE ===
class NotePanel {
    constructor(note, isNewlyCreated = false) {
        this.note = note;
        this.isNewlyCreated = isNewlyCreated;
        this.panel = this.createPanel();
        this.quillEditor = null;
        this.initializeEditor();
        this.attachEvents();
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.className = 'note-panel';
        panel.dataset.noteId = this.note.id;
        panel.dataset.columnIndex = this.note.column_index || 0;
        panel.dataset.sortOrder = this.note.sort_order || 0;
        
        // La posizione e larghezza verranno calcolate da organizeGridLayout
        panel.style.height = `${this.note.height}px`;
        panel.style.zIndex = this.note.z_index || 1;
        
        // Inizia fuori dallo schermo per evitare il flash in posizione (0,0)
        panel.style.left = '-9999px';
        panel.style.top = '-9999px';
        panel.style.opacity = '0';
        // Usa la gestione centralizzata delle transizioni
        PanelManager.setTransition(panel, 'initial');
        
        panel.innerHTML = `
            <div class="note-header">
                <input type="text" class="note-title" value="${this.note.title}" readonly>
                <div class="note-controls">
                    <button class="note-btn menu" title="Menu">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <button class="note-btn close" title="Elimina">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="note-content">
                <div class="editor" id="editor-${this.note.id}"></div>
            </div>
            <div class="resize-handle"></div>
        `;
        
        // Crea il menu nel body per evitare problemi di z-index
        const noteMenu = document.createElement('div');
        noteMenu.className = 'note-menu hidden';
        noteMenu.dataset.noteId = this.note.id;
        noteMenu.innerHTML = `
            <div class="menu-item" data-action="edit-title">
                <i class="fas fa-edit"></i> Modifica titolo
            </div>
            <div class="menu-item" data-action="edit-text">
                <i class="fas fa-pen"></i> Modifica
            </div>
            <div class="menu-item" data-action="change-background">
                <i class="fas fa-palette"></i> Colore sfondo
            </div>
            <div class="menu-item" data-action="auto-fit">
                <i class="fas fa-expand-arrows-alt"></i> Adatta
            </div>
        `;
        document.body.appendChild(noteMenu);
        
        return panel;
    }

    initializeEditor() {
        setTimeout(() => {
            // Le note caricate dal DB sono sempre statiche, le nuove note sono sempre in modalità edit
            const isNewNote = this.isNewlyCreated;
            
            this.quillEditor = new Quill(`#editor-${this.note.id}`, {
                theme: 'snow',
                bounds: `#workspace`, // Confina i popup all'interno del pannello della nota
                readOnly: !isNewNote, // Solo le nuove note iniziano abilitate
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote', 'code-block'],
                        [{ 'header': 1 }, { 'header': 2 }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'color': [] }, { 'background': [] }],
                        ['link', 'image'],
                        ['clean']
                    ]
                }
            });
            
            // Carica contenuto esistente
            if (this.note.content_html) {
                this.quillEditor.root.innerHTML = this.note.content_html;
            }
            
            // Imposta stato iniziale
            if (!isNewNote) {
                this.panel.classList.add('readonly');
            } else {
                this.quillEditor.focus();
                PanelManager.setActivePanel(this.panel, this.note);
            }
            
            // Auto-fit per note nuove con contenuto
            if (isNewNote && this.note.content_html && this.note.content_html.trim()) {
                // Aspetta che il layout sia organizzato prima di chiamare autoFitToContent
                setTimeout(() => {
                    this.autoFitToContent();
                }, 200);
            }
            
            // Auto-save su modifica con debounce
            let debouncedSave = debounce(() => {
                if (!this.quillEditor.isEnabled()) return;
                
                // Mostra feedback di salvataggio
                UIManager.showSavingStatus(true);
                
                this.saveContent().then(() => {
                    // Mantieni il feedback visibile per almeno 800ms
                    setTimeout(() => {
                        UIManager.showSavingStatus(false);
                    }, 800);
                }).catch(() => {
                    setTimeout(() => {
                        UIManager.showSavingStatus(false);
                    }, 800);
                });
            }, 1000);
            
            this.quillEditor.on('text-change', debouncedSave);
            
            // Salva immediatamente quando l'editor perde il focus
            // Usa blur event sul root dell'editor come suggerito nella documentazione Quill
            this.quillEditor.root.addEventListener('blur', () => {
                if (this.quillEditor.isEnabled()) {
                    // L'editor ha perso il focus, cancella il debounce e salva immediatamente
                    debouncedSave.cancel();
                    
                    UIManager.showSavingStatus(true);
                    this.saveContent().then(() => {
                        setTimeout(() => {
                            UIManager.showSavingStatus(false);
                        }, 800);
                    }).catch(() => {
                        setTimeout(() => {
                            UIManager.showSavingStatus(false);
                        }, 800);
                    });
                }
            });
            
            // Memorizza la funzione di salvataggio per uso esterno
            this.panel.saveIfEnabled = () => {
                if (this.quillEditor.isEnabled()) {
                    debouncedSave.cancel();
                    
                    UIManager.showSavingStatus(true);
                    this.saveContent().then(() => {
                        setTimeout(() => {
                            UIManager.showSavingStatus(false);
                        }, 800);
                    }).catch(() => {
                        setTimeout(() => {
                            UIManager.showSavingStatus(false);
                        }, 800);
                    });
                }
            };
            
            this.panel.quillEditor = this.quillEditor;
        }, 100);
    }

    async saveContent() {
        return await SaveManager.saveNote(this.note.id, {
            content: this.quillEditor.getText(),
            content_html: this.quillEditor.root.innerHTML
        });
    }

    async saveTitle(newTitle) {
        return await SaveManager.saveNote(this.note.id, { title: newTitle });
    }

    /**
     * Posiziona il menu in modo intelligente per rimanere sempre visibile
     * @param {HTMLElement} menu - Il menu da posizionare
     * @param {HTMLElement} button - Il bottone di riferimento
     */
    positionMenu(menu, button) {
        const btnRect = button.getBoundingClientRect();
        const gap = 5; // Spazio tra bottone e menu
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Mostra temporaneamente il menu per calcolare le dimensioni reali
        menu.style.visibility = 'hidden';
        menu.style.display = 'block';
        menu.classList.remove('hidden');
        
        const menuRect = menu.getBoundingClientRect();
        const menuWidth = menuRect.width;
        const menuHeight = menuRect.height;
        
        // Nascondi di nuovo il menu
        menu.classList.add('hidden');
        menu.style.visibility = 'visible';
        
        // Calcola posizione preferita (sotto il bottone, allineato a destra)
        let preferredTop = btnRect.bottom + gap;
        let preferredLeft = btnRect.right - menuWidth;
        
        // Verifica se il menu sfora a destra
        if (preferredLeft < 0) {
            // Allinea a sinistra del bottone
            preferredLeft = btnRect.left;
        }
        
        // Verifica se il menu sfora ancora a destra dopo l'aggiustamento
        if (preferredLeft + menuWidth > viewportWidth) {
            // Posiziona a sinistra del bottone
            preferredLeft = btnRect.left - menuWidth - gap;
        }
        
        // Verifica se il menu sfora a sinistra
        if (preferredLeft < 0) {
            // Forza allineamento al bordo sinistro con margine
            preferredLeft = gap;
        }
        
        // Verifica se il menu sfora in basso
        if (preferredTop + menuHeight > viewportHeight) {
            // Posiziona sopra il bottone
            preferredTop = btnRect.top - menuHeight - gap;
        }
        
        // Verifica se il menu sfora in alto
        if (preferredTop < 0) {
            // Forza allineamento al bordo superiore con margine
            preferredTop = gap;
        }
        
        // Applica la posizione calcolata
        menu.style.position = 'fixed';
        menu.style.top = preferredTop + 'px';
        menu.style.left = preferredLeft + 'px';
        menu.style.zIndex = '10000';
    }

    attachEvents() {
        const header = this.panel.querySelector('.note-header');
        const titleInput = this.panel.querySelector('.note-title');
        const menuBtn = this.panel.querySelector('.menu');
        const closeBtn = this.panel.querySelector('.close');
        const noteMenu = document.querySelector(`.note-menu[data-note-id="${this.note.id}"]`);
        
        // Drag and drop unificato per header e titolo
        const initializeDrag = (e) => {
            // Non permettere drag se il titolo è in editing
            if (e.target === titleInput && titleInput.classList.contains('editable')) return;
            
            PanelManager.startDrag(this.panel, this.note, e);
        };
        
        // Applica il drag sia al header che al titolo
        header.addEventListener('mousedown', initializeDrag);
        titleInput.addEventListener('mousedown', initializeDrag);
        
        // Aggiorna titolo e disabilita editing
        titleInput.addEventListener('blur', () => {
            titleInput.readOnly = true;
            titleInput.classList.remove('editable');
            this.saveTitle(titleInput.value);
        });
        
        titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                titleInput.blur();
            }
            if (e.key === 'Escape') {
                titleInput.readOnly = true;
                titleInput.classList.remove('editable');
                titleInput.blur();
            }
        });
        
        // Toggle menu
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Mantieni il focus sulla scheda attiva
            PanelManager.setActivePanel(this.panel, this.note);
            // Chiudi tutti gli altri menu aperti
            document.querySelectorAll('.note-menu').forEach(menu => {
                if (menu !== noteMenu) {
                    menu.classList.add('hidden');
                }
            });
            
            // Posiziona il menu rispetto al bottone
            if (noteMenu.classList.contains('hidden')) {
                this.positionMenu(noteMenu, menuBtn);
            }
            
            noteMenu.classList.toggle('hidden');
        });
        
        // Gestione click sui menu item
        noteMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                const action = menuItem.dataset.action;
                this.handleMenuAction(action, titleInput);
                noteMenu.classList.add('hidden');
                // Mantieni il focus sulla scheda dopo l'azione del menu
                PanelManager.setActivePanel(this.panel, this.note);
            }
        });
        
        // Chiudi menu quando si clicca fuori
        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && !noteMenu.contains(e.target)) {
                noteMenu.classList.add('hidden');
            }
        });
        
        // Previeni la perdita di focus quando si clicca sul menu
        noteMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Elimina nota
        closeBtn.addEventListener('click', async () => {
            DialogManager.confirm(
                'Elimina Nota',
                `Sei sicuro di voler eliminare la nota "${this.note.title}"? Questa azione non può essere annullata.`,
                async () => {
                    // Conferma eliminazione
                    const success = await this.delete();
                    if (success) {
                        this.panel.remove();
                        // Riorganizza tutte le colonne dopo l'eliminazione
                        setTimeout(() => {
                            PanelManager.organizeGridLayout();
                        }, 100);
                    } else {
                        DialogManager.alert(
                            'Errore',
                            'Si è verificato un errore durante l\'eliminazione della nota.',
                            'error'
                        );
                    }
                },
                () => {
                    // Annulla - non fare nulla
                }
            );
        });
        
        // ResizeObserver per gestire il ridimensionamento fluido
        this.setupResizeObserver();
        
        // Inizializza le dimensioni per il controllo del ResizeObserver
        setTimeout(() => {
            const rect = this.panel.getBoundingClientRect();
            this.panel.dataset.lastWidth = Math.round(rect.width);
            this.panel.dataset.lastHeight = Math.round(rect.height);
        }, 100);
        
        // Focus su click
        this.panel.addEventListener('click', () => {
            PanelManager.setActivePanel(this.panel, this.note);
        });
        
        // Gestione resize tramite handle personalizzato
        this.setupResizeHandle();
    }

    handleMenuAction(action, titleInput) {
        if (action === 'edit-title') {
            titleInput.readOnly = false;
            titleInput.classList.add('editable');
            titleInput.focus();
            titleInput.select();
        } else if (action === 'edit-text') {
            if (this.quillEditor) {
                if (this.quillEditor.isEnabled()) {
                    // Disabilita editing
                    this.quillEditor.disable();
                    this.panel.classList.add('readonly');
                } else {
                    // Abilita editing
                    this.quillEditor.enable();
                    this.panel.classList.remove('readonly');
                    // Focus sull'editor
                    this.quillEditor.focus();
                }
            }
        } else if (action === 'change-background') {
            // Apri la dialog per la selezione del colore
            const colorPicker = new ColorPickerDialog();
            colorPicker.show((selectedColor) => {
                this.setBackgroundColor(selectedColor);
            });
        } else if (action === 'auto-fit') {
            this.autoFitToContent();
        }
    }

    setupResizeObserver() {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const panel = entry.target;
                const noteId = parseInt(panel.dataset.noteId);
                const rect = panel.getBoundingClientRect();
                
                // Verifica se l'altezza è effettivamente cambiata
                const currentHeight = Math.round(rect.height);
                const lastHeight = panel.dataset.lastHeight ? parseInt(panel.dataset.lastHeight) : 0;
                
                // Determina la colonna (sempre necessario per il riposizionamento)
                const workspace = document.querySelector('.workspace');
                const workspaceRect = workspace.getBoundingClientRect();
                const relativeX = rect.left - workspaceRect.left;
                const colIndex = LayoutManager.getColumnIndex(relativeX);
                
                // Solo se l'altezza è effettivamente cambiata (tolleranza di 1px)
                if (Math.abs(currentHeight - lastHeight) > 1) {
                    // Memorizza la nuova altezza
                    panel.dataset.lastHeight = currentHeight;
                    
                    // Aggiorna il database con debounce più lungo
                    SaveManager.debouncedSaveDimensions(panel, noteId, {
                        height: currentHeight
                    });
                }
                
                // Riposiziona le note nella stessa colonna con debounce più lungo
                clearTimeout(panel.resizeTimeout);
                panel.resizeTimeout = setTimeout(() => {
                    if (!PanelManager.widthUpdateLock) {
                        const config = LayoutManager.getWorkspaceConfig();
                        PanelManager.repositionColumnNotes(Math.max(0, Math.min(config.cols - 1, colIndex)));
                    }
                }, 150); // Debounce più lungo per ridurre i ricalcoli
            }
        });
        
        resizeObserver.observe(this.panel);
    }

    setupResizeHandle() {
        const resizeHandle = this.panel.querySelector('.resize-handle');
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const startY = e.clientY;
            const startHeight = parseInt(this.panel.style.height) || this.panel.offsetHeight;
            
            function handleResize(moveEvent) {
                const deltaY = moveEvent.clientY - startY;
                const newHeight = Math.max(150, startHeight + deltaY); // Altezza minima 150px
                this.panel.style.height = newHeight + 'px';
                
                // Aggiorna il database con debounce
                SaveManager.debouncedSaveDimensions(this.panel, this.note.id, {
                    height: newHeight
                });
                
                // Riposiziona le note nella colonna con debounce
                clearTimeout(this.panel.repositionTimeout);
                this.panel.repositionTimeout = setTimeout(() => {
                    const rect = this.panel.getBoundingClientRect();
                    const config = LayoutManager.getWorkspaceConfig();
                    const colIndex = LayoutManager.getColumnFromX(rect.left);
                    if (!PanelManager.widthUpdateLock) {
                        PanelManager.repositionColumnNotes(colIndex);
                    }
                }, 200); // Debounce più lungo durante il resize manuale
            }
            
            const boundHandleResize = handleResize.bind(this);
            
            function handleResizeEnd() {
                document.removeEventListener('mousemove', boundHandleResize);
                document.removeEventListener('mouseup', handleResizeEnd);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
            
            document.addEventListener('mousemove', boundHandleResize);
            document.addEventListener('mouseup', handleResizeEnd);
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        });
    }

    setBackgroundColor(color) {
        // Imposta il colore di background del pannello
        this.panel.style.backgroundColor = color;
        
        // Rendi l'editor Quill trasparente per mostrare il background
        const editorElement = this.panel.querySelector('.ql-editor');
        if (editorElement) {
            editorElement.style.backgroundColor = 'transparent';
        }
        
        // Rendi trasparente anche il container dell'editor
        const editorContainer = this.panel.querySelector(`#editor-${this.note.id}`);
        if (editorContainer) {
            editorContainer.style.backgroundColor = 'transparent';
        }
    }

    async delete() {
        // Rimuovi il menu dal body
        const noteMenu = document.querySelector(`.note-menu[data-note-id="${this.note.id}"]`);
        if (noteMenu) {
            noteMenu.remove();
        }
        return await NotesManager.deleteNote(this.note.id);
    }

    autoFitToContent() {
        if (!this.quillEditor) return;
        
        // Calcola l'altezza necessaria per il contenuto
        const editorRoot = this.quillEditor.root;
        const noteHeader = this.panel.querySelector('.note-header');
        const resizeHandle = this.panel.querySelector('.resize-handle');
        
        // Ottieni l'altezza del contenuto dell'editor
        const contentHeight = editorRoot.scrollHeight;
        
        // Calcola l'altezza dell'header considerando il suo stato visibile
        // L'header ha altezza 0 quando nascosto, ma quando visibile ha padding 8px top/bottom + altezza contenuto
        let headerHeight = 0;
        if (noteHeader) {
            // Forza temporaneamente la visibilità per ottenere l'altezza reale
            const originalVisibility = noteHeader.style.visibility;
            const originalOpacity = noteHeader.style.opacity;
            const originalHeight = noteHeader.style.height;
            const originalPadding = noteHeader.style.padding;
            
            noteHeader.style.visibility = 'visible';
            noteHeader.style.opacity = '1';
            noteHeader.style.height = 'auto';
            noteHeader.style.padding = '8px 12px';
            
            headerHeight = noteHeader.offsetHeight;
            
            // Ripristina lo stato originale
            noteHeader.style.visibility = originalVisibility;
            noteHeader.style.opacity = originalOpacity;
            noteHeader.style.height = originalHeight;
            noteHeader.style.padding = originalPadding;
        }
        
        // Calcola l'altezza del resize handle (sempre 8px quando presente)
        const handleHeight = resizeHandle ? 8 : 0;
        
        // Aggiungi padding e margini del pannello
        const computedStyle = window.getComputedStyle(this.panel);
        const paddingTop = parseInt(computedStyle.paddingTop) || 0;
        const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
        
        // Ottieni l'altezza minima dal CSS
        const minHeight = parseInt(computedStyle.minHeight) || 150;
        
        // Calcola l'altezza totale necessaria
        const totalHeight = contentHeight + headerHeight + handleHeight + paddingTop + paddingBottom;
        
        // Usa l'altezza minima dal CSS se il contenuto è vuoto o troppo piccolo
        const newHeight = Math.max(minHeight, totalHeight);
        
        // Applica la nuova altezza
        this.panel.style.height = newHeight + 'px';
        
        // Salva le nuove dimensioni nel database
        SaveManager.debouncedSaveDimensions(this.panel, this.note.id, {
            height: newHeight
        });
        
        // Riposiziona le note nella colonna
        setTimeout(() => {
            const rect = this.panel.getBoundingClientRect();
            const config = LayoutManager.getWorkspaceConfig();
            const colIndex = LayoutManager.getColumnFromX(rect.left);
            if (!PanelManager.widthUpdateLock) {
                PanelManager.repositionColumnNotes(colIndex);
            }
        }, 100);
    }

    getPanel() {
        // Memorizza il riferimento all'istanza nel DOM per accesso esterno
        this.panel.noteInstance = this;
        return this.panel;
    }
}