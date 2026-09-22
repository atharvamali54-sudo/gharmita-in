/**
 * Gharmitra - Direct Real Phone Calling System with Screen Privacy
 * Option 1: Direct cellular call to real number + on-screen masking.
 */

const GharmitraCallMasking = (function() {
    function maskDisplayNumber(phoneNumber) {
        if (!phoneNumber) return 'Not available';
        const cleaned = String(phoneNumber).replace(/\D/g, '');
        if (cleaned.length < 4) return phoneNumber;
        const lastDigits = cleaned.slice(-3);
        return `+91 ••••• ••${lastDigits}`;
    }

    function dialRealPhoneCall(realNumber, personName) {
        if (!realNumber) {
            alert('फोन नंबर उपलब्ध नाही.');
            return;
        }
        const cleaned = String(realNumber).replace(/[^\d+]/g, '');
        const targetUri = cleaned.startsWith('+') ? `tel:${cleaned}` : `tel:+91${cleaned.slice(-10)}`;
        window.location.href = targetUri;
    }

    return {
        maskDisplayNumber,
        dialRealPhoneCall
    };
})();

// Global helper for HTML buttons
function initiateDirectCall(realNumber, personName) {
    GharmitraCallMasking.dialRealPhoneCall(realNumber, personName);
}
