/**
 * Esempi di utilizzo del DialogManager
 * Questo file contiene esempi di come utilizzare la utility DialogManager
 */

// Esempio 1: Dialog di conferma semplice
function showSimpleConfirm() {
    DialogManager.confirm(
        'Conferma Azione',
        'Vuoi procedere con questa operazione?',
        () => {
            console.log('Utente ha confermato');
            DialogManager.alert('Successo', 'Operazione completata!', 'info');
        },
        () => {
            console.log('Utente ha annullato');
        }
    );
}

// Esempio 2: Dialog di avviso con diversi tipi
function showAlerts() {
    // Info
    DialogManager.alert(
        'Informazione',
        'Questa è una dialog informativa.',
        'info'
    );
    
    // Warning
    setTimeout(() => {
        DialogManager.alert(
            'Attenzione',
            'Questa è una dialog di avviso.',
            'warning'
        );
    }, 2000);
    
    // Error
    setTimeout(() => {
        DialogManager.alert(
            'Errore',
            'Questa è una dialog di errore.',
            'error'
        );
    }, 4000);
}

// Esempio 3: Dialog personalizzata con bottoni custom
function showCustomDialog() {
    DialogManager.show({
        title: 'Salva Documento',
        message: 'Vuoi salvare le modifiche prima di uscire?',
        type: 'question',
        buttons: [
            {
                text: 'Non Salvare',
                class: 'btn-secondary',
                handler: () => {
                    console.log('Uscita senza salvare');
                    return true; // Chiudi dialog
                }
            },
            {
                text: 'Annulla',
                class: 'btn-secondary',
                handler: () => {
                    console.log('Operazione annullata');
                    return true; // Chiudi dialog
                }
            },
            {
                text: 'Salva',
                class: 'btn-primary',
                handler: () => {
                    console.log('Documento salvato');
                    // Simula operazione di salvataggio
                    DialogManager.alert('Successo', 'Documento salvato correttamente!', 'info');
                    return true; // Chiudi dialog
                }
            }
        ]
    });
}

// Esempio 4: Dialog con validazione (non chiude se validazione fallisce)
function showValidationDialog() {
    DialogManager.show({
        title: 'Inserisci Nome',
        message: 'Inserisci il tuo nome per continuare:',
        type: 'question',
        buttons: [
            {
                text: 'Annulla',
                class: 'btn-secondary',
                handler: () => true // Chiudi sempre
            },
            {
                text: 'Conferma',
                class: 'btn-primary',
                handler: () => {
                    // Simula validazione
                    const isValid = Math.random() > 0.5;
                    
                    if (!isValid) {
                        DialogManager.alert('Errore', 'Nome non valido, riprova!', 'error');
                        return false; // Non chiudere la dialog
                    }
                    
                    DialogManager.alert('Successo', 'Nome accettato!', 'info');
                    return true; // Chiudi dialog
                }
            }
        ]
    });
}

// Esempio 5: Dialog non modale
function showNonModalDialog() {
    DialogManager.show({
        title: 'Dialog Non Modale',
        message: 'Questa dialog può essere chiusa cliccando fuori.',
        type: 'info',
        modal: false,
        buttons: [
            {
                text: 'OK',
                class: 'btn-primary',
                handler: () => true
            }
        ]
    });
}

// Esempio 6: Dialog con callback di chiusura
function showDialogWithCallback() {
    DialogManager.show({
        title: 'Dialog con Callback',
        message: 'Questa dialog esegue una funzione quando viene chiusa.',
        type: 'info',
        buttons: [
            {
                text: 'Chiudi',
                class: 'btn-primary',
                handler: () => true
            }
        ],
        onClose: () => {
            console.log('Dialog chiusa!');
            DialogManager.alert('Callback', 'La dialog è stata chiusa!', 'info');
        }
    });
}

// Funzioni di utilità per testare le dialog
window.DialogExamples = {
    showSimpleConfirm,
    showAlerts,
    showCustomDialog,
    showValidationDialog,
    showNonModalDialog,
    showDialogWithCallback
};

// Per testare rapidamente dalla console:
// DialogExamples.showSimpleConfirm()
// DialogExamples.showAlerts()
// DialogExamples.showCustomDialog()
// DialogExamples.showValidationDialog()
// DialogExamples.showNonModalDialog()
// DialogExamples.showDialogWithCallback()