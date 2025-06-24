/**
 * Funzioni di utilità condivise
 */

/**
 * Debounce function per limitare la frequenza di esecuzione di una funzione
 * @param {Function} func - Funzione da eseguire con debounce
 * @param {number} wait - Tempo di attesa in millisecondi
 * @returns {Function} Funzione con debounce applicato
 */
function debounce(func, wait) {
    let timeout;
    const executedFunction = function(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
    
    // Aggiungi metodo cancel per cancellare il timeout
    executedFunction.cancel = function() {
        clearTimeout(timeout);
    };
    
    return executedFunction;
}

/**
 * Mostra un messaggio di errore temporaneo
 * @param {HTMLElement} element - Elemento dove mostrare l'errore
 * @param {string} message - Messaggio di errore
 * @param {number} duration - Durata in millisecondi (default: 5000)
 */
function showError(element, message, duration = 5000) {
    if (!element) {
        console.error('Elemento per mostrare errore non trovato:', message);
        return;
    }
    
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), duration);
}

/**
 * Mostra un messaggio di successo temporaneo
 * @param {HTMLElement} element - Elemento dove mostrare il successo
 * @param {string} message - Messaggio di successo
 * @param {number} duration - Durata in millisecondi (default: 3000)
 */
function showSuccess(element, message, duration = 3000) {
    if (!element) {
        console.error('Elemento per mostrare successo non trovato:', message);
        return;
    }
    
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), duration);
}

/**
 * Throttle function per limitare la frequenza di esecuzione
 * @param {Function} func - Funzione da eseguire con throttle
 * @param {number} limit - Limite di tempo in millisecondi
 * @returns {Function} Funzione con throttle applicato
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Genera un ID univoco
 * @returns {string} ID univoco
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Clamp di un valore tra min e max
 * @param {number} value - Valore da limitare
 * @param {number} min - Valore minimo
 * @param {number} max - Valore massimo
 * @returns {number} Valore limitato
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Verifica se un elemento è visibile nel viewport
 * @param {HTMLElement} element - Elemento da verificare
 * @returns {boolean} True se l'elemento è visibile
 */
function isElementVisible(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Scroll fluido verso un elemento
 * @param {HTMLElement} element - Elemento verso cui fare scroll
 * @param {Object} options - Opzioni per lo scroll
 */
function smoothScrollTo(element, options = {}) {
    if (!element) return;
    
    const defaultOptions = {
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
    };
    
    element.scrollIntoView({ ...defaultOptions, ...options });
}

/**
 * Formatta una data in formato leggibile
 * @param {Date|string|number} date - Data da formattare
 * @returns {string} Data formattata
 */
function formatDate(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Data non valida';
    
    return d.toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Escape HTML per prevenire XSS
 * @param {string} text - Testo da escape
 * @returns {string} Testo con escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}