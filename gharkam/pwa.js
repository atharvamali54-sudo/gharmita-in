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

// --- 2. Check if Running in App / WebView / Standalone Mode ---
function isAppAlreadyInstalled() {
    try {
        // 1. Explicit native bridge injected by Android/iOS wrapper
        if (window.GharmitraNative || window.Android || window.AndroidBridge || 
            (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.GharmitraNative)) {
            return true;
        }

        // 2. URL query parameters (?app=true, ?mode=app, ?source=app, ?webview=true)
        if (window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('app') === 'true' || params.get('mode') === 'app' || 
                params.get('source') === 'app' || params.get('webview') === 'true') {
                try { sessionStorage.setItem('gharmitra_is_app', 'true'); } catch (e) {}
                return true;
            }
        }

        // 3. Persisted in sessionStorage across in-app navigations
        try {
            if (sessionStorage.getItem('gharmitra_is_app') === 'true') {
                return true;
            }
        } catch (e) {}

        // 4. PWA Standalone, Fullscreen, or Minimal-UI display modes
        if (window.matchMedia) {
            if (window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.matchMedia('(display-mode: minimal-ui)').matches) {
                return true;
            }
        }

        // 5. iOS standalone mode
        if (window.navigator && window.navigator.standalone === true) {
            return true;
        }

        // 6. Android App referrer (TWA / Intent launch)
        if (document.referrer && (document.referrer.includes('android-app://') || document.referrer.includes('com.gharmitra.app'))) {
            return true;
        }

        // 7. User Agent Inspection
        const ua = (window.navigator && window.navigator.userAgent) ? window.navigator.userAgent.toLowerCase() : '';
        if (ua.includes('gharmitraapp')) {
            return true;
        }
        // Standard Android System WebView tokens: '; wv' or 'Version/X.X' with 'Chrome'
        if (ua.includes('; wv') || ua.includes(';wv')) {
            return true;
        }
        // iOS WebViews (WKWebView or UIWebView inside an app: contains AppleWebKit and Mobile but not Safari product token)
        const isIOS = /iphone|ipod|ipad/i.test(ua);
        if (isIOS && !ua.includes('safari') && ua.includes('applewebkit')) {
            return true;
        }

    } catch (err) {
        console.warn('[Gharmitra PWA] App detection error:', err);
    }

    return false;
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
    showPwaToast("🎉 Great! Gharmitra App has been installed on your home screen.");
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
                    ⚡ Instant Web App (No Store Needed)
                </span>
                <h3 class="font-black text-slate-900 text-xl">Install Gharmitra App</h3>
                <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                    Save to your phone home screen with 1 click. Runs fast, smooth, and lightweight just like a mobile app!
                </p>
            </div>

            <!-- Feature list -->
            <div class="bg-slate-50 rounded-2xl p-3 text-left space-y-2 text-xs border border-slate-100 text-slate-700">
                <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-[11px] font-bold">⚡</span>
                    <span><strong>Superfast Speed:</strong> 1-click instant launch</span>
                </div>
                <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold">🔔</span>
                    <span><strong>Live Alerts:</strong> Real-time order & location tracking</span>
                </div>
                <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 text-[11px] font-bold">💾</span>
                    <span><strong>Lightweight:</strong> Uses minimal phone memory and storage</span>
                </div>
            </div>

            <!-- Action buttons -->
            <div class="space-y-2 pt-1">
                <a href="https://github.com/atharvamali54-sudo/gharmita-in/releases/download/v1.0.0-apk/Gharmitra-Secure.apk" target="_blank" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-lg transition text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-brands fa-android text-emerald-400 text-base"></i> <span>Download Android APK</span>
                </a>
                <button onclick="dismissPwaModal()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 px-4 rounded-xl transition text-xs cursor-pointer">
                    Maybe Later
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
                showPwaToast("🎉 App is installing...");
            }
            deferredInstallPrompt = null;
        });
    } else if (isIosSafari()) {
        hidePwaInstallModal();
        showIosInstructions();
    } else {
        alert("To install the app, tap your browser's menu (⋮ 3 dots) and select 'Install app' or 'Add to Home screen'.");
        hidePwaInstallModal();
    }
}

function showIosInstructions() {
    alert("📱 To install Gharmitra App on iPhone:\n\n1. Tap the 'Share' (📤) button at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.\n3. Tap 'Add' in the top-right corner.");
}

function showInstallButtons() {
    if (isAppAlreadyInstalled()) return;
    document.querySelectorAll('.pwa-install-btn, [onclick*="showPwaInstallModal"]').forEach(btn => {
        btn.classList.remove('hidden');
        btn.style.display = '';
        btn.removeAttribute('aria-hidden');
    });
}

function hideInstallButtons() {
    document.querySelectorAll('.pwa-install-btn, [onclick*="showPwaInstallModal"]').forEach(btn => {
        btn.classList.add('hidden');
        btn.style.setProperty('display', 'none', 'important');
        btn.setAttribute('aria-hidden', 'true');
    });
}

function showShareButtons() {
    hideShareButtons();
}

function hideShareButtons() {
    document.querySelectorAll('.gharmitra-share-btn, [onclick*="shareGharmitraApp"], #pwaFloatingShareBtn').forEach(btn => {
        btn.classList.add('hidden');
        btn.style.setProperty('display', 'none', 'important');
        btn.setAttribute('aria-hidden', 'true');
    });
    const floatingShare = document.getElementById('pwaFloatingShareBtn');
    if (floatingShare) floatingShare.remove();
}

function applyAppOrBrowserVisibility() {
    const isApp = isAppAlreadyInstalled();
    if (isApp) {
        if (document.documentElement) document.documentElement.classList.add('is-app-env');
        if (document.body) document.body.classList.add('is-app-env');
        hideInstallButtons();
        hideShareButtons();
    } else {
        if (document.documentElement) document.documentElement.classList.remove('is-app-env');
        if (document.body) document.body.classList.remove('is-app-env');
        showInstallButtons();
        hideShareButtons();
    }
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
    return `🏠 *Gharmitra - Pune City's Trusted Home & Repair Services!*\n\n⚡ Book Cleaning, Plumbing, Electrician, Painting and Home Services in 1 minute!\n\n✅ Live order tracking\n✅ Verified professional local workers\n✅ Instant Web App - runs directly on your phone!\n\n📲 *Open link and save to your home screen now:*\n${appUrl}`;
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
                <h3 class="font-black text-slate-900 text-xl">Share Gharmitra App</h3>
                <p class="text-xs text-slate-500 mt-1">Share with friends and family (Pune City)</p>
            </div>

            <!-- Share Buttons -->
            <div class="space-y-2.5 pt-2">
                <!-- 1. Primary WhatsApp Share -->
                <button type="button" onclick="shareViaWhatsApp()" class="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-black py-3.5 px-4 rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2.5 cursor-pointer">
                    <i class="fa-brands fa-whatsapp text-xl"></i> Share on WhatsApp
                </button>

                <!-- 2. Native Mobile Share (Other Apps) -->
                <button type="button" onclick="triggerNativeShare()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-2xl shadow-md transition text-xs flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-share-nodes text-sm"></i> Share via other Apps
                </button>

                <!-- 3. Copy Link -->
                <button type="button" onclick="copyAppShareLink()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition text-xs flex items-center justify-center gap-2 border border-slate-200 cursor-pointer">
                    <i class="fa-solid fa-link text-slate-500"></i> Copy App Link
                </button>

                <!-- 4. SMS Share -->
                <button type="button" onclick="shareViaSms()" class="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold py-2 px-4 rounded-xl transition text-xs flex items-center justify-center gap-2 border border-slate-200 cursor-pointer">
                    <i class="fa-solid fa-message text-blue-500"></i> Send via SMS
                </button>
            </div>

            <!-- App Link Display -->
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-600 text-left mt-2">
                <span id="shareLinkDisplay" class="truncate pr-2 font-mono text-slate-500">${DEFAULT_FALLBACK_URL}</span>
                <span class="text-blue-600 font-bold cursor-pointer shrink-0 hover:underline" onclick="copyAppShareLink()">Copy</span>
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
    const shareText = `🏠 Gharmitra - Pune City's Trusted Home Services! Book cleaning, plumbing, repairs and more:\n${appUrl}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Gharmitra - Home Services & Repairs',
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
            showPwaToast("✓ Gharmitra app link copied to clipboard!");
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
        showPwaToast("✓ Link copied successfully!");
        closeShareModal();
    } catch(e) {
        prompt("Copy the link below:", text);
    }
    document.body.removeChild(ta);
}

// --- 8. Floating Share Button (Removed as requested) ---
function ensureFloatingShareButton() {
    const btn = document.getElementById('pwaFloatingShareBtn');
    if (btn) btn.remove();
}

function showPwaToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl z-[100000] border border-slate-700 animate-bounce flex items-center gap-2';
    toast.innerHTML = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- 9. Global Window Attachments ---
window.isAppAlreadyInstalled = isAppAlreadyInstalled;
window.applyAppOrBrowserVisibility = applyAppOrBrowserVisibility;
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

// --- 10. Initialization & App State Application ---
function initPwaAndAppState() {
    applyAppOrBrowserVisibility();
    ensurePwaModalHtml();
    ensureShareModalHtml();

    const floatingShare = document.getElementById('pwaFloatingShareBtn');
    if (floatingShare) floatingShare.remove();

    if (!isAppAlreadyInstalled()) {
        if (isIosSafari()) {
            const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
            const now = Date.now();
            if (!dismissedTime || (now - Number(dismissedTime) > 48 * 60 * 60 * 1000)) {
                setTimeout(() => showPwaInstallModal(), 2500);
            }
        }
    }

    // Auto-open share modal if launched via Android shortcut (?action=share) and not in app
    if (window.location.search.includes('action=share') && !isAppAlreadyInstalled()) {
        setTimeout(() => openShareModal(), 400);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPwaAndAppState);
} else {
    initPwaAndAppState();
}

// Immediate execution to prevent button flicker before DOMContentLoaded
applyAppOrBrowserVisibility();

// Listen for standalone display-mode changes dynamically
if (window.matchMedia) {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    if (standaloneQuery.addEventListener) {
        standaloneQuery.addEventListener('change', () => applyAppOrBrowserVisibility());
    } else if (standaloneQuery.addListener) {
        standaloneQuery.addListener(() => applyAppOrBrowserVisibility());
    }
}

// =========================================================
// 11. Global Zero-Horizontal-Movement & Touch Gesture Blocker
// Prevents Left/Right swipe from moving or sliding the page,
// while vertical scrolling (Up/Down) remains 100% smooth and native.
// =========================================================
(function initHorizontalSwipeBlocker() {
    let touchStartX = 0;
    let touchStartY = 0;

    window.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);

        // If gesture is primarily horizontal (Left-to-Right or Right-to-Left)
        if (deltaX > deltaY && deltaX > 8) {
            const target = e.target;
            // Allow native behavior inside interactive inputs or explicit horizontal scroll areas
            const isTextControl = target && (
                target.tagName === 'TEXTAREA' || 
                (target.tagName === 'INPUT' && (
                    target.type === 'text' || target.type === 'tel' || target.type === 'email' || 
                    target.type === 'password' || target.type === 'search' || target.type === 'number' || target.type === 'range'
                ))
            );
            const isExplicitHorizontalScroll = target && target.closest && target.closest('.allow-horizontal-scroll, [data-allow-horizontal="true"]');

            if (!isTextControl && !isExplicitHorizontalScroll) {
                if (e.cancelable) {
                    e.preventDefault();
                }
            }
        }
    }, { passive: false });

    // Lock window.scrollX to 0 at all times so the page never rests scrolled sideways
    window.addEventListener('scroll', () => {
        if (window.scrollX !== 0) {
            window.scrollTo(0, window.scrollY);
        }
    }, { passive: true });
})();

// =========================================================
// Anti-Screenshot & Screen Recording Prevention Suite
// =========================================================

(function initAntiScreenshotSecurity() {
    // Screen blur disabled: Ensures payment modals (Razorpay), iframes, and receipt screenshots work seamlessly
    document.body.classList.remove('screen-protected-blur');
    const shield = document.getElementById('securityScreenShield');
    if (shield) shield.remove();
})();
