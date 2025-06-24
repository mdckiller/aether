class ColorPickerDialog {
    constructor() {
        this.dialog = null;
        this.callback = null;
        this.colors = {
            standard: [
                '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
                '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#C0C0C0', '#808080'
            ],
            pastello: [
                '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#D4BAFF', '#FFBAFF', '#FFBABA',
                '#FFE5CC', '#FFF2CC', '#E5FFCC', '#CCF2FF', '#E5CCFF', '#FFCCFF', '#F0F0F0', '#E0E0E0'
            ],
            vivaci: [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
                '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#A9DFBF', '#D7BDE2'
            ]
        };
    }

    show(callback) {
        this.callback = callback;
        this.createDialog();
        this.attachEvents();
        document.body.appendChild(this.dialog);
        
        // Mostra la dialog con animazione
        setTimeout(() => {
            this.dialog.classList.add('show');
        }, 10);
    }

    createDialog() {
        this.dialog = document.createElement('div');
        this.dialog.className = 'color-picker-dialog';
        
        this.dialog.innerHTML = `
            <div class="color-picker-content">
                <div class="color-picker-header">
                    <h3>Seleziona Colore</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="color-picker-body">
                    <div class="color-section">
                        <h4>Standard</h4>
                        <div class="color-grid" data-section="standard">
                            ${this.renderColorGrid('standard')}
                        </div>
                    </div>
                    <div class="color-section">
                        <h4>Pastello</h4>
                        <div class="color-grid" data-section="pastello">
                            ${this.renderColorGrid('pastello')}
                        </div>
                    </div>
                    <div class="color-section">
                        <h4>Vivaci</h4>
                        <div class="color-grid" data-section="vivaci">
                            ${this.renderColorGrid('vivaci')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderColorGrid(section) {
        return this.colors[section].map(color => 
            `<div class="color-item" data-color="${color}" style="background-color: ${color}" title="${color}"></div>`
        ).join('');
    }

    attachEvents() {
        // Chiudi dialog
        const closeBtn = this.dialog.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.close());
        
        // Chiudi cliccando fuori
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.close();
            }
        });
        
        // Selezione colore
        const colorItems = this.dialog.querySelectorAll('.color-item');
        colorItems.forEach(item => {
            item.addEventListener('click', () => {
                const selectedColor = item.dataset.color;
                if (this.callback) {
                    this.callback(selectedColor);
                }
                this.close();
            });
        });
        
        // Chiudi con ESC
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.close();
        }
    }

    close() {
        if (this.dialog) {
            this.dialog.classList.remove('show');
            setTimeout(() => {
                if (this.dialog && this.dialog.parentNode) {
                    this.dialog.parentNode.removeChild(this.dialog);
                }
                document.removeEventListener('keydown', this.handleKeyDown.bind(this));
            }, 300);
        }
    }
}