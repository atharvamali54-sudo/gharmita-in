// =========================================================
// Gharmitra Progressive Web App (PWA) & Instant Share System
// =========================================================

let deferredInstallPrompt = null;
const PWA_DISMISSED_KEY = 'gharmitra_pwa_dismissed_time';
const DEFAULT_FALLBACK_URL = 'https://atharvamali54-sudo.github.io/gharmita-in/gharkam/index.html';

// --- 1. Register Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('[Gharmitra PWA] SW registered:', reg.scope);
            })
            .catch(err => {
                console.warn('[Gharmitra PWA] SW registration failed:', err);
            });
    });
}

// --- 2. Check if Running in Standalone Mode or Mobile App (Installed App / Android WebView) ---
function isAppAlreadyInstalled() {
    const ua = navigator.userAgent || '';
    const isApk = ua.includes('GharmitraApp') ||
                  ua.includes('SecureApp') ||
                  window.location.search.includes('app=1') ||
                  window.location.search.includes('mode=app');
    if (isApk) {
        document.documentElement.classList.add('is-mobile-app');
    }
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://') ||
           isApk;
}

// --- 3. Check if on iOS Safari ---
function isIosSafari() {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes('safari') && !ua.includes('crios') && !ua.includes('fxios');
    return isIOS && isSafari && !window.navigator.standalone;
}

// --- 4. Listen for beforeinstallprompt Event (Android/Chrome) ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    showInstallButtons();

    const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
    const now = Date.now();
    if (dismissedTime && (now - Number(dismissedTime) < 24 * 60 * 60 * 1000)) {
        return;
    }

    setTimeout(() => {
        if (!isAppAlreadyInstalled()) {
            showPwaInstallModal();
        }
    }, 1500);
});

// --- 5. App Installed Handler ---
window.addEventListener('appinstalled', () => {
    console.log('[Gharmitra PWA] App was successfully installed!');
    deferredInstallPrompt = null;
    hidePwaInstallModal();
    hideInstallButtons();
    showPwaToast("🎉 अभिनंदन! Gharmitra ॲप आपल्या होम स्क्रीनवर इन्स्टॉल झाले आहे.");
});

// --- 6. PWA Install Modal / Banner ---
function ensurePwaModalHtml() {
    if (document.getElementById('gharmitraPwaModal')) return;

    const modal = document.createElement('div');
    modal.id = 'gharmitraPwaModal';
    modal.className = 'fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-[99999] hidden items-end sm:items-center justify-center p-3 sm:p-4 transition-all duration-300';
    
    modal.innerHTML = `
        <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in relative overflow-hidden">
            <button onclick="dismissPwaModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition cursor-pointer">
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
                <a href="https://github.com/atharvamali54-sudo/gharmita-in/releases/download/v1.0.0-apk/Gharmitra-Secure.apk" target="_blank" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-lg transition text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-brands fa-android text-emerald-400 text-base"></i> <span>Android APK डाउनलोड करा (नो स्क्रीनशॉट)</span>
                </a>
                <button onclick="shareGharmitraApp()" class="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-brands fa-whatsapp text-base"></i> 📤 मित्रांना ॲप शेअर करा (Share)
                </button>
                <button onclick="dismissPwaModal()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 px-4 rounded-xl transition text-xs cursor-pointer">
                    नंतर करा (Maybe Later)
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

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
    localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now()));
}

function triggerPwaInstall() {
    if (deferredInstallPrompt) {
        hidePwaInstallModal();
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('[Gharmitra PWA] User accepted install prompt');
                showPwaToast("🎉 ॲप इन्स्टॉल होत आहे...");
            }
            deferredInstallPrompt = null;
        });
    } else if (isIosSafari()) {
        hidePwaInstallModal();
        showIosInstructions();
    } else {
        alert("ॲप इन्स्टॉल करण्यासाठी ब्राऊझरच्या मेनू (⋮ तीन ठिपके) वर क्लिक करा आणि 'Install app' किंवा 'Add to Home screen' निवडा.");
        hidePwaInstallModal();
    }
}

function showIosInstructions() {
    alert("📱 iPhone वर Gharmitra ॲप सेव्ह करण्यासाठी:\n\n1. खालील 'Share' (शेअर 📤) आयकॉनवर टॅप करा.\n2. खाली स्क्रोल करून 'Add to Home Screen' (होम स्क्रीनवर जोडा) निवडा.\n3. वर उजवीकडे 'Add' वर क्लिक करा.");
}

function showInstallButtons() {
    if (isAppAlreadyInstalled()) return;
    document.querySelectorAll('.pwa-install-btn').forEach(btn => btn.classList.remove('hidden'));
}

function hideInstallButtons() {
    document.querySelectorAll('.pwa-install-btn').forEach(btn => btn.classList.add('hidden'));
}

// --- 7. App Sharing System (Direct WhatsApp, Native Share, and Modal) ---

function getGharmitraShareUrl() {
    try {
        let loc = window.location;
        if (loc.protocol === 'file:') return DEFAULT_FALLBACK_URL;
        let origin = loc.origin;
        let path = loc.pathname;
        if (path.includes('/gharkam/')) {
            return origin + path.substring(0, path.indexOf('/gharkam/') + 9) + 'index.html';
        }
        return origin + path;
    } catch (e) {
        return DEFAULT_FALLBACK_URL;
    }
}

function getGharmitraShareMessage() {
    const appUrl = getGharmitraShareUrl();
    return `🏠 *घरमित्र (Gharmitra) - पुणे शहराची विश्वासू घरकाम सेवा!*\n\n⚡ क्लिनिंग, प्लंबिंग, इलेक्ट्रिशियन, पेंटिंग आणि घरगुती कामे आता एका मिनिटात बुक करा!\n\n✅ थेट लाईव्ह लोकेशन ट्रॅकिंग\n✅ पडताळणी झालेले व्यावसायिक कामगार\n✅ Play Store शिवाय थेट मोबाईलमध्ये ॲपसारखे चालवा!\n\n📲 *आत्ताच लिंक उघडा आणि होम स्क्रीनवर सेव्ह करा:*\n${appUrl}`;
}

// Main share trigger - opens the comprehensive share modal
function shareGharmitraApp() {
    openShareModal();
}

function ensureShareModalHtml() {
    if (document.getElementById('gharmitraShareModal')) return;

    const modal = document.createElement('div');
    modal.id = 'gharmitraShareModal';
    modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[99999] hidden items-end sm:items-center justify-center p-3 sm:p-4 transition-all duration-300';

    modal.innerHTML = `
        <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in relative">
            <button onclick="closeShareModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition cursor-pointer">
                ✕
            </button>

            <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-[#25D366] text-3xl flex items-center justify-center mx-auto shadow-sm">
                <i class="fa-brands fa-whatsapp"></i>
            </div>

            <div>
                <h3 class="font-black text-slate-900 text-xl">Gharmitra ॲप शेअर करा</h3>
                <p class="text-xs text-slate-500 mt-1">मित्रांना व नातेवाईकांना ॲप पाठवा (पुणे शहर)</p>
            </div>

            <!-- Share Buttons -->
            <div class="space-y-2.5 pt-2">
                <!-- 1. Primary WhatsApp Share -->
                <button type="button" onclick="shareViaWhatsApp()" class="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-black py-3.5 px-4 rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2.5 cursor-pointer">
                    <i class="fa-brands fa-whatsapp text-xl"></i> व्हॉट्सॲपवर पाठवा (WhatsApp)
                </button>

                <!-- 2. Native Mobile Share (Other Apps) -->
                <button type="button" onclick="triggerNativeShare()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-2xl shadow-md transition text-xs flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-share-nodes text-sm"></i> इतर ॲप्सवर शेअर करा (Share to Apps)
                </button>

                <!-- 3. Copy Link -->
                <button type="button" onclick="copyAppShareLink()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition text-xs flex items-center justify-center gap-2 border border-slate-200 cursor-pointer">
                    <i class="fa-solid fa-link text-slate-500"></i> लिंक कॉपी करा (Copy Link)
                </button>

                <!-- 4. SMS Share -->
                <button type="button" onclick="shareViaSms()" class="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold py-2 px-4 rounded-xl transition text-xs flex items-center justify-center gap-2 border border-slate-200 cursor-pointer">
                    <i class="fa-solid fa-message text-blue-500"></i> SMS द्वारे पाठवा
                </button>
            </div>

            <!-- App Link Display -->
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-600 text-left mt-2">
                <span id="shareLinkDisplay" class="truncate pr-2 font-mono text-slate-500">${DEFAULT_FALLBACK_URL}</span>
                <span class="text-blue-600 font-bold cursor-pointer shrink-0 hover:underline" onclick="copyAppShareLink()">कॉपी</span>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function openShareModal() {
    ensureShareModalHtml();
    const modal = document.getElementById('gharmitraShareModal');
    const linkDisplay = document.getElementById('shareLinkDisplay');
    if (linkDisplay) linkDisplay.innerText = getGharmitraShareUrl();

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeShareModal() {
    const modal = document.getElementById('gharmitraShareModal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

function shareViaWhatsApp() {
    const msg = getGharmitraShareMessage();
    // Direct WhatsApp share URL
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    closeShareModal();
}

function triggerNativeShare() {
    const appUrl = getGharmitraShareUrl();
    const shareText = `🏠 घरमित्र (Gharmitra) - पुणे शहराची विश्वासू घरकाम सेवा! Play Store शिवाय थेट मोबाईलमध्ये वापरा:\n${appUrl}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Gharmitra - घरकाम व सेवा',
            text: shareText,
            url: appUrl
        }).then(() => {
            closeShareModal();
        }).catch((err) => {
            console.log('[Gharmitra Share] Native share dismissed:', err);
        });
    } else {
        // Fallback to copying link
        copyAppShareLink();
    }
}

function shareViaSms() {
    const msg = getGharmitraShareMessage();
    window.location.href = `sms:?body=${encodeURIComponent(msg)}`;
    closeShareModal();
}

function copyAppShareLink() {
    const appUrl = getGharmitraShareUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(appUrl).then(() => {
            showPwaToast("✓ Gharmitra ॲपची लिंक क्लिपबोर्डवर कॉपी केली!");
            closeShareModal();
        }).catch(() => fallbackCopy(appUrl));
    } else {
        fallbackCopy(appUrl);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showPwaToast("✓ लिंक यशस्वीरीत्या कॉपी केली!");
        closeShareModal();
    } catch(e) {
        prompt("खालील लिंक कॉपी करा:", text);
    }
    document.body.removeChild(ta);
}

// --- 8. Floating WhatsApp Share Button (Available everywhere on Mobile) ---
function ensureFloatingShareButton() {
    if (document.getElementById('pwaFloatingShareBtn')) return;

    const btn = document.createElement('div');
    btn.id = 'pwaFloatingShareBtn';
    btn.className = 'fixed bottom-5 right-4 z-40 bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs py-2.5 px-3.5 rounded-full shadow-2xl flex items-center gap-2 cursor-pointer border-2 border-white transition transform active:scale-95 select-none';
    btn.onclick = () => shareGharmitraApp();
    btn.innerHTML = `
        <i class="fa-brands fa-whatsapp text-lg"></i>
        <span>ॲप शेअर करा</span>
    `;
    document.body.appendChild(btn);
}

function showPwaToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl z-[100000] border border-slate-700 animate-bounce flex items-center gap-2';
    toast.innerHTML = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- 9. Global Window Attachments ---
window.shareGharmitraApp = shareGharmitraApp;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.shareViaWhatsApp = shareViaWhatsApp;
window.triggerNativeShare = triggerNativeShare;
window.shareViaSms = shareViaSms;
window.copyAppShareLink = copyAppShareLink;
window.showPwaInstallModal = showPwaInstallModal;
window.hidePwaInstallModal = hidePwaInstallModal;
window.dismissPwaModal = dismissPwaModal;
window.triggerPwaInstall = triggerPwaInstall;

// --- 10. Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    ensurePwaModalHtml();
    ensureShareModalHtml();
    ensureFloatingShareButton();

    if (isAppAlreadyInstalled()) {
        hideInstallButtons();
    } else {
        showInstallButtons();

        if (isIosSafari()) {
            const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
            const now = Date.now();
            if (!dismissedTime || (now - Number(dismissedTime) > 48 * 60 * 60 * 1000)) {
                setTimeout(() => showPwaInstallModal(), 2500);
            }
        }
    }

    // Auto-open share modal if launched via Android shortcut (?action=share)
    if (window.location.search.includes('action=share')) {
        setTimeout(() => openShareModal(), 400);
    }
});

// =========================================================
// Anti-Screenshot & Screen Recording Prevention Suite
// =========================================================

(function initAntiScreenshotSecurity() {
    // Screen blur disabled: Ensures payment modals (Razorpay), iframes, and receipt screenshots work seamlessly
    document.body.classList.remove('screen-protected-blur');
    const shield = document.getElementById('securityScreenShield');
    if (shield) shield.remove();
})();
