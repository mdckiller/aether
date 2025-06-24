// === GESTIONE GENERICA DEI PANNELLI ===
class PanelManager {
    static activeNoteId = null;
    static lastSelectedNoteId = null;
    static dragOffset = { x: 0, y: 0 };
    static isDragging = false;
    static animationFrameId = null;
    static pendingPosition = null;
    static dragStartColumn = null;
    static cachedConfig = null;
    static repositionTimeout = null;
    static widthUpdateLock = false;

    static setActivePanel(panel, note) {
        document.querySelectorAll('.note-panel').forEach(p => {
            p.classList.remove('active');
            // Disabilita Quill su tutte le altre note
            if (p !== panel) {
                const quill = p.quillEditor;
                if (quill && quill.isEnabled()) {
                    // Salva la nota prima di disabilitare l'editor
                    if (p.saveIfEnabled) {
                        p.saveIfEnabled();
                    }
                    quill.disable();
                    p.classList.add('readonly');
                }
            }
        });
        panel.classList.add('active');
        this.activeNoteId = note.id;
        this.lastSelectedNoteId = note.id;
    }

    static async renderNotes() {
        const workspace = document.getElementById('workspace');
        workspace.innerHTML = '';

        try {
            const notesData = await NotesManager.fetchNotes();

            notesData.forEach(note => {
                const notePanel = new NotePanel(note);
                const panel = notePanel.getPanel();
                // Le note esistenti non hanno bisogno del fade-in e devono essere posizionate normalmente
                panel.style.left = `${note.position_x || 0}px`;
                panel.style.top = `${note.position_y || 0}px`;
                panel.style.opacity = '1';
                panel.style.transition = 'opacity 0.3s ease-in-out';
                workspace.appendChild(panel);
            });

            // Organizza automaticamente in griglia dopo il rendering
            setTimeout(() => {
                this.organizeGridLayout();
            }, 200);
        } catch (error) {
            console.error('🚨 Errore nel rendering note:', error);
        }
    }

    static organizeGridLayout(scrollToPanel = null) {
        const panels = Array.from(document.querySelectorAll('.note-panel'));
        const config = LayoutManager.getWorkspaceConfig();

        // Organizza le note per colonna basandosi su column_index e sort_order
        const columns = Array(config.cols).fill().map(() => []);

        panels.forEach((panel) => {
            const colIndex = parseInt(panel.dataset.columnIndex) || 0;
            const sortOrder = parseInt(panel.dataset.sortOrder) || 0;

            // Assicurati che l'indice della colonna sia valido
            const validColIndex = Math.min(Math.max(colIndex, 0), config.cols - 1);
            let sortOrderReal = sortOrder
            if (validColIndex!==colIndex) {
                sortOrderReal = (colIndex*1000) + sortOrder
            }
            columns[validColIndex].push({
                panel: panel,
                sortOrder: sortOrderReal
            });
        });

        // Ordina ogni colonna per sort_order
        columns.forEach(column => {
            column.sort((a, b) => a.sortOrder - b.sortOrder);
        });

        // Posiziona le note in ogni colonna
        columns.forEach((column, colIndex) => {
            let currentY = config.gap;
            const x = LayoutManager.getColumnX(colIndex);

            column.forEach(({ panel }) => {
                // Applica transizione appropriata per il layout
                this.setTransition(panel, 'complete');
                
                // Non modificare la posizione left del pannello attivo durante il drag
                if (!this.widthUpdateLock || panel.dataset.noteId != this.activeNoteId) {
                    panel.style.left = `${x}px`;
                }
                panel.style.top = `${currentY}px`;
                
                // Imposta la larghezza solo se non siamo in drag e se significativamente diversa
                if (!this.widthUpdateLock) {
                    const currentWidth = parseInt(panel.style.width) || 0;
                    const targetWidth = Math.round(config.colWidth);
                    if (Math.abs(currentWidth - targetWidth) > 2) {
                        panel.style.width = `${targetWidth}px`;
                    }
                }

                // Mantieni l'altezza esistente o imposta un minimo
                const currentHeight = parseInt(panel.style.height) || 250;
                panel.style.height = `${Math.max(currentHeight, 200)}px`;

                const noteId = parseInt(panel.dataset.noteId);
                SaveManager.debouncedSavePosition(panel, noteId, {
                    position_x: x,
                    position_y: currentY,
                    height: Math.max(currentHeight, 200)
                });

                currentY += Math.max(currentHeight, 200) + config.gap;
            });
        });

        // Fade-in dei pannelli dopo il posizionamento
        setTimeout(() => {
            panels.forEach(panel => {
                if (panel.style.opacity === '0') {
                    // Rimuovi la transizione di posizione e applica il fade-in
                    panel.style.transition = 'opacity 0.3s ease-in-out';
                    panel.style.opacity = '1';
                }
            });

            // Scroll al pannello specificato (solo per nuove note)
            if (scrollToPanel) {
                setTimeout(() => {
                    scrollToPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }, 50);
    }

    static repositionColumnNotes(colIndex) {
        const config = LayoutManager.getWorkspaceConfig();
        const panels = Array.from(document.querySelectorAll('.note-panel'));
        const expectedX = LayoutManager.getColumnX(colIndex);

        const columnPanels = panels.filter(panel => {
            const panelX = parseInt(panel.style.left);
            return LayoutManager.isInColumn(panelX, colIndex, 50);
        });

        // Ordina per posizione Y attuale (rispetta l'ordinamento di organizeGridLayout)
        columnPanels.sort((a, b) => {
            const topA = parseInt(a.style.top) || 0;
            const topB = parseInt(b.style.top) || 0;
            return topA - topB;
        });

        let currentY = config.gap;

        columnPanels.forEach((panel, index) => {
            // Usa la gestione centralizzata delle transizioni
            this.setTransition(panel, 'reposition');
            
            // Non modificare la posizione left durante il drag per evitare conflitti
            if (!this.widthUpdateLock || panel.dataset.noteId != this.activeNoteId) {
                panel.style.left = `${expectedX}px`;
            }
            panel.style.top = `${currentY}px`;

            const noteId = parseInt(panel.dataset.noteId);
            const currentHeight = parseInt(panel.style.height) || 250;

            currentY += currentHeight + config.gap;

            // Rimuovi la transizione dopo l'animazione usando la gestione centralizzata
            setTimeout(() => {
                this.setTransition(panel, 'default');
            }, 200);
        });
    }

    /**
     * Gestisce le transizioni CSS in modo centralizzato per evitare conflitti
     * @param {HTMLElement} panel - Il pannello da modificare
     * @param {string} type - Tipo di transizione: 'none', 'drag', 'reposition', 'complete'
     */
    static setTransition(panel, type) {
        switch(type) {
            case 'none':
                panel.style.transition = 'none';
                break;
            case 'drag':
                panel.style.transition = 'none';
                break;
            case 'reposition':
                panel.style.transition = 'top 0.2s ease-out';
                break;
            case 'complete':
                panel.style.transition = 'all 0.3s ease';
                break;
            case 'initial':
                panel.style.transition = 'opacity 0.3s ease-in-out, left 0s, top 0s';
                break;
            default:
                panel.style.transition = '';
        }
    }

    static startDrag(panel, note, e) {
        this.activeNoteId = note.id;
        panel.classList.add('active');

        // Memorizza la posizione iniziale del mouse
        const startX = e.clientX;
        const startY = e.clientY;
        const dragThreshold = 5;
        let dragStarted = false;

        // Calcola l'offset relativo alla posizione del pannello
        const panelLeft = parseInt(panel.style.left) || 0;
        const panelTop = parseInt(panel.style.top) || 0;
        this.dragOffset.x = e.clientX - panelLeft;
        this.dragOffset.y = e.clientY - panelTop;

        // Traccia la colonna di origine
        this.dragStartColumn = this.getColumnFromX(panelLeft);

        // Memorizza il riferimento alla funzione bound per poterla rimuovere correttamente
        const boundHandleGridDrag = this.handleGridDrag.bind(this);

        const handleMouseMove = (moveEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - startX);
            const deltaY = Math.abs(moveEvent.clientY - startY);

            // Attiva il drag solo se il movimento supera la soglia
            if (!dragStarted && (deltaX > dragThreshold || deltaY > dragThreshold)) {
                dragStarted = true;
                this.isDragging = true;

                // Porta il pannello in primo piano durante il drag
                this.bringToFront(panel);

                // Disabilita la selezione del testo durante il drag
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'grabbing';

                requestAnimationFrame(() => {
                    panel.classList.add('dragging');
                });

                // Rimuove questo listener e aggiunge quello del drag
                document.removeEventListener('mousemove', handleMouseMove);
                document.addEventListener('mousemove', boundHandleGridDrag, { passive: true });
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            if (dragStarted) {
                // Rimuove i listener del drag vero e proprio usando il riferimento corretto
                document.removeEventListener('mousemove', boundHandleGridDrag);
                this.handleGridDragEnd();
            } else {
                // Se non c'è stato drag, ripristina lo stato senza salvare
                this.isDragging = false;
                this.activeNoteId = null;
                this.pendingPosition = null;
                this.dragStartColumn = null;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';

                // Rimuove la classe active dal pannello
                if (panel) {
                    panel.classList.remove('active');
                }
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        e.preventDefault();
    }

    static getColumnFromX(x) {
        return LayoutManager.getColumnFromX(x);
    }

    static handleGridDrag(e) {
        if (!this.activeNoteId) return;

        const panel = document.querySelector(`[data-note-id="${this.activeNoteId}"]`);
        if (!panel) return;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // Usa la configurazione cachata durante il drag per evitare ricalcoli
        if (!this.cachedConfig) {
            this.cachedConfig = LayoutManager.getWorkspaceConfig();
            this.widthUpdateLock = true; // Blocca aggiornamenti di larghezza durante il drag
        }
        
        // Vincola alla griglia solo sull'asse X
        const targetColumn = this.getColumnFromX(x);
        const gridX = this.cachedConfig.gap + targetColumn * (this.cachedConfig.colWidth + this.cachedConfig.gap);

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.animationFrameId = requestAnimationFrame(() => {
            this.setTransition(panel, 'drag');
            panel.style.left = `${gridX}px`;
            panel.style.top = `${Math.max(this.cachedConfig.gap, y)}px`;
        });

        this.pendingPosition = { x: gridX, y: Math.max(this.cachedConfig.gap, y), column: targetColumn };
    }

    static handleGridDragEnd() {
        if (!this.activeNoteId) return;

        const panel = document.querySelector(`[data-note-id="${this.activeNoteId}"]`);
        if (panel && this.pendingPosition) {
            this.setTransition(panel, 'complete');

            // Calcola column_index e sort_order dalla posizione
            const targetColumn = this.pendingPosition.column;
            const targetY = this.pendingPosition.y;

            // Verifica se la posizione è effettivamente cambiata
            const originalColumn = parseInt(panel.dataset.columnIndex);
            const originalSortOrder = parseInt(panel.dataset.sortOrder);

            // Trova tutte le note nella colonna di destinazione
            const columnPanels = Array.from(document.querySelectorAll('.note-panel'))
                .filter(p => parseInt(p.dataset.columnIndex) === targetColumn && p !== panel)
                .sort((a, b) => parseInt(a.style.top) - parseInt(b.style.top));

            // Calcola il nuovo sort_order basandosi sulla posizione Y
            let newSortOrder = 0;
            const config = this.cachedConfig || LayoutManager.getWorkspaceConfig();

            // Se la scheda è trascinata molto vicino al bordo superiore (entro 2 volte il gap),
            // posizionala automaticamente in cima
            if (targetY <= config.gap * 2) {
                newSortOrder = 0;
            } else {
                // Logica normale per il posizionamento basato sulla posizione Y
                for (let i = 0; i < columnPanels.length; i++) {
                    const panelTop = parseInt(columnPanels[i].style.top);
                    if (targetY < panelTop) {
                        newSortOrder = parseInt(columnPanels[i].dataset.sortOrder);
                        break;
                    }
                    newSortOrder = parseInt(columnPanels[i].dataset.sortOrder) + 1;
                }
            }

            // Verifica se la posizione è effettivamente cambiata
            const positionChanged = (targetColumn !== originalColumn || newSortOrder !== originalSortOrder);

            if (positionChanged) {
                // Aggiorna i dataset del pannello
                panel.dataset.columnIndex = targetColumn;
                panel.dataset.sortOrder = newSortOrder;

                // Aggiorna gli altri pannelli nella colonna se necessario
                if (targetY <= config.gap * 2) {
                    // Incrementa il sort_order di tutte le altre note nella colonna
                    columnPanels.forEach(p => {
                        const currentOrder = parseInt(p.dataset.sortOrder);
                        p.dataset.sortOrder = currentOrder + 1;
                        // Aggiorna anche nel database
                        SaveManager.saveNote(p.dataset.noteId, {
                            sort_order: currentOrder + 1
                        }, true);
                    });
                } else {
                    // Logica normale per aggiornare gli altri pannelli
                    columnPanels.forEach(p => {
                        const currentOrder = parseInt(p.dataset.sortOrder);
                        if (currentOrder >= newSortOrder) {
                            p.dataset.sortOrder = currentOrder + 1;
                            // Aggiorna anche nel database
                            SaveManager.saveNote(p.dataset.noteId, {
                                sort_order: currentOrder + 1
                            }, true);
                        }
                    });
                }

                // Salva la nuova posizione nel database solo se è cambiata
                SaveManager.saveNote(this.activeNoteId, {
                    column_index: targetColumn,
                    sort_order: newSortOrder
                }, true);
            }

            // Riorganizza le colonne con debounce più aggressivo
            if (targetColumn !== undefined) {
                const originalColumn = this.dragStartColumn;
                
                // Cancella eventuali timeout precedenti
                if (this.repositionTimeout) {
                    clearTimeout(this.repositionTimeout);
                }
                
                this.repositionTimeout = setTimeout(() => {
                    this.repositionColumnNotes(targetColumn);

                    if (typeof originalColumn === 'number' && originalColumn >= 0 && originalColumn !== targetColumn) {
                        // Ritarda la riorganizzazione della colonna originale per evitare conflitti
                        setTimeout(() => {
                            this.repositionColumnNotes(originalColumn);
                        }, 250);
                    }
                }, 200); // Debounce più lungo
            }

            panel.classList.remove('active', 'dragging');
        }

        // Ripristina gli stili del body
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        // Cleanup
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Pulisci la cache della configurazione e sblocca aggiornamenti larghezza
        this.cachedConfig = null;
        this.widthUpdateLock = false;

        this.activeNoteId = null;
        this.pendingPosition = null;
        this.isDragging = false;
        this.dragStartColumn = null;
    }

    static createNewNote(newNote) {
        // Calcola le dimensioni del workspace e delle colonne
        const config = LayoutManager.getWorkspaceConfig();

        let targetColumn, sortOrder;

        // Se c'è una nota selezionata, posiziona la nuova nota nella stessa colonna
        if (this.lastSelectedNoteId) {
            const lastSelectedPanel = document.querySelector(`[data-note-id="${this.lastSelectedNoteId}"]`);
            if (lastSelectedPanel) {
                targetColumn = parseInt(lastSelectedPanel.dataset.columnIndex) || 0;
                sortOrder = parseInt(lastSelectedPanel.dataset.sortOrder) + 1;

                // Aggiorna il sort_order delle note successive nella stessa colonna
                const columnPanels = Array.from(document.querySelectorAll('.note-panel'))
                    .filter(p => parseInt(p.dataset.columnIndex) === targetColumn);

                columnPanels.forEach(p => {
                    const currentOrder = parseInt(p.dataset.sortOrder);
                    if (currentOrder >= sortOrder) {
                        p.dataset.sortOrder = currentOrder + 1;
                        SaveManager.debouncedSave(p, () => {
                            SaveManager.saveNote(p.dataset.noteId, {
                                sort_order: currentOrder + 1
                            }, true);
                        }, 100);
                    }
                });

                // Aggiorna la nota esistente con column_index e sort_order
                SaveManager.saveNote(newNote.id, {
                    column_index: targetColumn,
                    sort_order: sortOrder
                }, false);

                // Aggiorna i dati locali della nota
                newNote.column_index = targetColumn;
                newNote.sort_order = sortOrder;

                const notePanel = new NotePanel(newNote, true);
                const panel = notePanel.getPanel();
                document.getElementById('workspace').appendChild(panel);

                // Riorganizza tutto il layout e scrolla alla nuova nota
                setTimeout(() => {
                    this.organizeGridLayout(panel);
                }, 100);
                return;
            }
        }

        // Fallback: posiziona alla fine della prima colonna
        targetColumn = 0;
        // Trova il sort_order più alto nella prima colonna
        const firstColumnPanels = Array.from(document.querySelectorAll('.note-panel'))
            .filter(p => parseInt(p.dataset.columnIndex) === 0);

        if (firstColumnPanels.length > 0) {
            const maxSortOrder = Math.max(...firstColumnPanels.map(p => parseInt(p.dataset.sortOrder) || 0));
            sortOrder = maxSortOrder + 1;
        } else {
            sortOrder = 0;
        }

        // Aggiorna la nota esistente con column_index e sort_order
        SaveManager.saveNote(newNote.id, {
            column_index: targetColumn,
            sort_order: sortOrder
        }, false);

        // Aggiorna i dati locali della nota
        newNote.column_index = targetColumn;
        newNote.sort_order = sortOrder;

        const notePanel = new NotePanel(newNote, true);
        const panel = notePanel.getPanel();
        document.getElementById('workspace').appendChild(panel);

        // Riorganizza tutto il layout e scrolla alla nuova nota
        setTimeout(() => {
            this.organizeGridLayout(panel);
        }, 100);
    }

    static setupWorkspaceEvents() {
        // Handle clicks on workspace to disable Quill editors
        document.getElementById('workspace').addEventListener('mousedown', (e) => {
            // Only proceed if click target is workspace itself and not any child elements
            // Also check if the click is not on note controls (menu, close button, etc.)
            const isNoteControl = e.target.closest('.note-btn, .note-menu, .note-controls, .note-header');
            
            if (e.target === e.currentTarget && !isNoteControl) {
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
                this.lastSelectedNoteId = null;
                document.querySelectorAll('.note-panel').forEach(p => p.classList.remove('active'));
            }
        });

        // Riorganizza la griglia quando cambia la dimensione della finestra
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (!this.widthUpdateLock) {
                    this.organizeGridLayout();
                }
            }, 400); // Debounce più lungo per il resize
        });
    }

    // Porta un pannello in primo piano incrementando il suo z-index
    static bringToFront(panel) {
        // Trova il z-index massimo attuale
        let maxZIndex = 0;
        document.querySelectorAll('.note-panel').forEach(p => {
            const zIndex = parseInt(p.style.zIndex) || 1;
            if (zIndex > maxZIndex) {
                maxZIndex = zIndex;
            }
        });

        // Imposta il z-index del pannello corrente a maxZIndex + 1
        const newZIndex = maxZIndex + 1;
        panel.style.zIndex = newZIndex;

        // Aggiorna anche il valore nella nota se esiste
        const noteId = panel.dataset.noteId;
        if (noteId) {
            const note = notes.find(n => n.id == noteId);
            if (note) {
                note.z_index = newZIndex;
            }
        }
    }
}