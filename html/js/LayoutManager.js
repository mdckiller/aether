/**
 * Gestisce i calcoli di layout e posizionamento per il workspace
 */
class LayoutManager {
    static _gap = null;
    
    /**
     * Ottiene il GAP dalle impostazioni
     * @returns {number} Valore del GAP
     */
    static get GAP() {
        if (this._gap === null) {
            this._gap = parseInt(SaveManager.getPreference('gap', '20'));
        }
        return this._gap;
    }
    
    /**
     * Imposta il GAP
     * @param {number} value - Nuovo valore del GAP
     */
    static set GAP(value) {
        this._gap = value;
    }
    
    /**
     * Ottiene il numero di colonne dalle impostazioni utente
     * @returns {number} Numero di colonne configurato
     */
    static getCols() {
        return parseInt(SaveManager.getPreference('columns', '3'));
    }
    
    /**
     * Aggiorna il GAP dalle impostazioni
     */
    static updateGap() {
        this._gap = parseInt(SaveManager.getPreference('gap', '20'));
    }
    
    /**
     * Ottiene la configurazione del workspace
     * @returns {Object} Configurazione con width, cols, gap, colWidth
     */
    static getWorkspaceConfig() {
        const workspace = document.querySelector('.workspace');
        if (!workspace) {
            throw new Error('Workspace non trovato');
        }
        
        // Sottrai 20px per considerare la possibile comparsa della scrollbar verticale
        const workspaceWidth = workspace.clientWidth;
        const cols = this.getCols();
        const colWidth = (workspaceWidth - (this.GAP * (cols + 1))) / cols;
        
        return {
            width: workspaceWidth,
            cols: cols,
            gap: this.GAP,
            colWidth: colWidth
        };
    }
    
    /**
     * Calcola l'indice della colonna basandosi sulla posizione X
     * @param {number} x - Posizione X
     * @returns {number} Indice della colonna (0-2)
     */
    static getColumnIndex(x) {
        const config = this.getWorkspaceConfig();
        return Math.max(0, Math.min(config.cols - 1, Math.round((x - config.gap) / (config.colWidth + config.gap))));
    }
    
    /**
     * Calcola la posizione X di una colonna
     * @param {number} columnIndex - Indice della colonna
     * @returns {number} Posizione X della colonna
     */
    static getColumnX(columnIndex) {
        const config = this.getWorkspaceConfig();
        return config.gap + columnIndex * (config.colWidth + config.gap);
    }
    
    /**
     * Verifica se una posizione X appartiene a una specifica colonna
     * @param {number} x - Posizione X
     * @param {number} columnIndex - Indice della colonna
     * @param {number} tolerance - Tolleranza per il confronto (default: 50)
     * @returns {boolean} True se la posizione appartiene alla colonna
     */
    static isInColumn(x, columnIndex, tolerance = 50) {
        const expectedX = this.getColumnX(columnIndex);
        return Math.abs(x - expectedX) < tolerance;
    }
    
    /**
     * Trova la colonna basandosi sulla posizione X con controllo dei limiti
     * @param {number} x - Posizione X
     * @returns {number} Indice della colonna valido
     */
    static getColumnFromX(x) {
        const config = this.getWorkspaceConfig();
        
        for (let i = 0; i < config.cols; i++) {
            const colStart = config.gap + i * (config.colWidth + config.gap);
            const colEnd = colStart + config.colWidth;
            if (x >= colStart && x <= colEnd) {
                return i;
            }
        }
        
        // Fallback: ritorna la colonna più vicina
        return Math.max(0, Math.min(config.cols - 1, Math.round((x - config.gap) / (config.colWidth + config.gap))));
    }
}