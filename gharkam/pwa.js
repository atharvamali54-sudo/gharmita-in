// =========================================================
// Gharmitra PWA Controller (Service Worker & Install Banner)
// =========================================================

let deferredInstallPrompt = null;
const PWA_DISMISSED_KEY = 'gharmitra_pwa_dismissed_time';

// --- 1. Register Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('[Gharmitra PWA] Service Worker registered with scope:', reg.scope);
            })
            .catch(err => {
                console.warn('[Gharmitra PWA] Service Worker registration failed:', err);
            });
    });
}

// --- 2. Check if already running in Standalone (App) Mode ---
function isAppAlreadyInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
}

// --- 3. Check if on iOS Safari ---
function isIosSafari() {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes('safari') && !ua.includes('crios') && !ua.includes('fxios');
    return isIOS && isSafari && !window.navigator.standalone;
}

// --- 4. Listen for beforeinstallprompt Event (Android/Chrome/Edge) ---
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default mini-infobar
    e.preventDefault();
    deferredInstallPrompt = e;

    // Show header install button if exists
    showInstallButtons();

    // Check if user recently dismissed banner (within 24 hours)
    const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
    const now = Date.now();
    if (dismissedTime && (now - Number(dismissedTime) < 24 * 60 * 60 * 1000)) {
        console.log('[Gharmitra PWA] Prompt deferred due to recent dismissal.');
        return;
    }

    // Auto display the install popup after a short comfortable delay
    setTimeout(() => {
        if (!isAppAlreadyInstalled()) {
            showPwaInstallModal();
        }
    }, 1500);
});

// --- 5. Handle App Installed Event ---
window.addEventListener('appinstalled', () => {
    console.log('[Gharmitra PWA] App was successfully installed!');
    deferredInstallPrompt = null;
    hidePwaInstallModal();
    hideInstallButtons();
    showPwaToast("🎉 अभिनंदन! Gharmitra ॲप आपल्या होम स्क्रीनवर इन्स्टॉल झाले आहे.");
});

// --- 6. Render & Show Custom PWA Install Modal / Banner ---
function ensurePwaModalHtml() {
    if (document.getElementById('gharmitraPwaModal')) return;

    const modal = document.createElement('div');
    modal.id = 'gharmitraPwaModal';
    modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9999] hidden items-end sm:items-center justify-center p-3 sm:p-4 transition-all duration-300';
    
    modal.innerHTML = `
        <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in relative overflow-hidden">
            <!-- Decorative top banner -->
            <div class="absolute -top-10 -right-10 w-28 h-28 bg-blue-500/10 rounded-full pointer-events-none"></div>
            <div class="absolute -bottom-10 -left-10 w-28 h-28 bg-emerald-500/10 rounded-full pointer-events-none"></div>

            <button onclick="dismissPwaModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition">
                ✕
            </button>

            <!-- App Logo Preview -->
            <div class="relative mx-auto w-20 h-20 rounded-2xl shadow-lg border-2 border-blue-600/20 overflow-hidden bg-white p-1 flex items-center justify-center">
                <img src="icons/icon-192x192.png" alt="Gharmitra App" class="w-full h-full object-contain rounded-xl">
                <span class="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
                    ✓ PWA
                </span>
            </div>

            <div>
                <span class="bg-blue-50 text-blue-700 text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-1.5 border border-blue-200">
                    ⚡ Play Store शिवाय थेट ॲप
                </span>
                <h3 class="font-black text-slate-900 text-xl">Install Gharmitra App</h3>
                <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                    एका क्लिकवर मोबाईलच्या होम स्क्रीनवर सेव्ह करा. ॲपप्रमाणे वेगवान आणि सोपे चालेल!
                </p>
            </div>

            <!-- Feature list -->
            <div class="bg-slate-50 rounded-2xl p-3 text-left space-y-2 text-xs border border-slate-100 text-slate-700">
                <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-[11px] font-bold">⚡</span>
                    <span><strong>सुपर फास्ट स्पीड:</strong> 1-क्लिकमध्ये थेट उघडा</span>
                </div>
                <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold">🔔</span>
                    <span><strong>लाईव्ह अलर्ट्स:</strong> ऑर्डर्स आणि लोकेशन ट्रॅकिंग</span>
                </div>
                <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 text-[11px] font-bold">💾</span>
                    <span><strong>कमी जागा:</strong> फोनची मेमरी किंवा रॅम भरत नाही</span>
                </div>
            </div>

            <!-- Action buttons -->
            <div class="space-y-2 pt-1">
                <button onclick="triggerPwaInstall()" id="pwaInstallBtn" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2">
                    <i class="fa-solid fa-download"></i> 📲 आत्ताच इन्स्टॉल करा
                </button>
                <button onclick="dismissPwaModal()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl transition text-xs">
                    नंतर करा (Maybe Later)
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// --- 7. Show / Hide Modal Functions ---
function showPwaInstallModal() {
    if (isAppAlreadyInstalled()) return;
    ensurePwaModalHtml();
    const modal = document.getElementById('gharmitraPwaModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hidePwaInstallModal() {
    const modal = document.getElementById('gharmitraPwaModal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

function dismissPwaModal() {
    hidePwaInstallModal();
    // Remember dismissal for 24 hours
    localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now()));
}

// --- 8. Trigger Native Install Prompt ---
function triggerPwaInstall() {
    if (deferredInstallPrompt) {
        hidePwaInstallModal();
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('[Gharmitra PWA] User accepted the install prompt');
                showPwaToast("🎉 ॲप इन्स्टॉल होत आहे...");
            } else {
                console.log('[Gharmitra PWA] User dismissed the install prompt');
            }
            deferredInstallPrompt = null;
        });
    } else if (isIosSafari()) {
        hidePwaInstallModal();
        showIosInstructions();
    } else {
        // If browser already supports Add to Home Screen via menu
        alert("ॲप इन्स्टॉल करण्यासाठी ब्राऊझरच्या मेनू (⋮ तीन ठिपके) वर क्लिक करा आणि 'Install app' किंवा 'Add to Home screen' निवडा.");
        hidePwaInstallModal();
    }
}

// --- 9. iOS Safari Install Guide ---
function showIosInstructions() {
    alert("📱 iPhone वर Gharmitra ॲप सेव्ह करण्यासाठी:\n\n1. खालील 'Share' (शेअर) आयकॉनवर टॅप करा.\n2. खाली स्क्रोल करून 'Add to Home Screen' (होम स्क्रीनवर जोडा) निवडा.\n3. वर उजवीकडे 'Add' वर क्लिक करा.");
}

// --- 10. Install Button Controls in Navigation ---
function showInstallButtons() {
    document.querySelectorAll('.pwa-install-btn').forEach(btn => {
        btn.classList.remove('hidden');
    });
}

function hideInstallButtons() {
    document.querySelectorAll('.pwa-install-btn').forEach(btn => {
        btn.classList.add('hidden');
    });
}

// --- 11. Toast Notification Helper ---
function showPwaToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl z-[10000] border border-slate-700 animate-bounce flex items-center gap-2';
    toast.innerHTML = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- 12. Initialize on DOM Content Loaded ---
document.addEventListener('DOMContentLoaded', () => {
    ensurePwaModalHtml();

    if (isAppAlreadyInstalled()) {
        hideInstallButtons();
    } else {
        showInstallButtons();

        // Handle iOS Safari specific initial prompt if needed
        if (isIosSafari()) {
            const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
            const now = Date.now();
            if (!dismissedTime || (now - Number(dismissedTime) > 48 * 60 * 60 * 1000)) {
                setTimeout(() => showPwaInstallModal(), 2500);
            }
        }
    }
});
