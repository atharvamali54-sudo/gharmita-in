// =========================================================
// Gharmitra Super Admin & Owner Dashboard Logic (Hardened)
// =========================================================

// Security: Strict HTML escaping against Stored XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function computeSha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}


let allOrders = {};
let allWorkers = {};
let allUsers = {};
let allReviews = [];
let allBroadcastNotifications = {};
let weeklyChartInstance = null;
let selectedOrderForModal = null;
let selectedWorkerForRecharge = null;

// Hardcoded admin PIN removed for security hardening

// --- 1. Admin Backend Security Authentication & Route Guard (Dual Engine) ---

const ADMIN_API_BASE = window.GHARMITRA_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '');

const RECIPIENT_EMAILS = ["atharvamali54@gmail.com", "prathameshr361@gmail.com"];
const EMAILJS_PUBLIC_KEY = 'PfAaODZ_GPiBPHvOi';
const EMAILJS_SERVICE_ID = 'service_lst67g7';
const EMAILJS_TEMPLATE_ID = 'template_ope5xzi';

// Cryptographic salted hashes (Zero static plaintext credentials in frontend code)
const SALT_PREFIX = 'gharmitra_sec_v3_salt_9281_';
const EXPECTED_USER_HASH = 'cb5b7e4d61d58ebfe89e01c4425c3d141835a62b05446b9e29f1c33a0aa305de';
const EXPECTED_PASS_HASH = '4204e2fb238cb46c79bda63091754165edbe428c3df4d9236907764f9d9ec9f8';

const CLIENT_LOCKOUT_KEY = 'gharmitra_admin_lockout_v2';
const CLIENT_FAILURES_KEY = 'gharmitra_admin_fails_v2';

let adminOtpCountdownSeconds = 0;
let adminOtpTimerInterval = null;
let adminLockoutCountdownSeconds = 0;
let adminLockoutTimerInterval = null;
let isDashboardInitialized = false;
let clientActiveOtpState = null;
let usedBackendForOtp = false;
let selectedKycWorkerUid = null;
let selectedKycWorkerMobile = null;
let selectedKycAadharPhotoUrl = null;
let cachedWorkerList = [];
let selectedForceAssignOrderId = null;
let allQualityResolutions = {};
let isQualityHistoryOpen = false;

// Initialize EmailJS for dual browser-level mailer fallback
if (window.emailjs) {
    try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch(e) {}
}

function showAdminAuthStatus(msg, type = 'info') {
    const el = document.getElementById('adminAuthStatusMsg');
    if (!el) return;
    el.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200', 'bg-blue-50', 'text-blue-700', 'border-blue-200', 'bg-amber-50', 'text-amber-800', 'border-amber-200');
    
    if (type === 'error') {
        el.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
    } else if (type === 'success') {
        el.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    } else if (type === 'warning') {
        el.classList.add('bg-amber-50', 'text-amber-800', 'border-amber-200');
    } else {
        el.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-200');
    }
    el.innerHTML = msg;
}

function getClientLockoutState() {
    try {
        const lockedUntil = parseInt(localStorage.getItem(CLIENT_LOCKOUT_KEY) || '0', 10);
        const now = Date.now();
        if (lockedUntil && now < lockedUntil) {
            const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
            return {
                isLocked: true,
                remainingSeconds: remainingSeconds,
                remainingMinutes: Math.ceil(remainingSeconds / 60)
            };
        }
        if (lockedUntil && now >= lockedUntil) {
            localStorage.removeItem(CLIENT_LOCKOUT_KEY);
            localStorage.removeItem(CLIENT_FAILURES_KEY);
        }
    } catch(e) {}
    return { isLocked: false };
}

function recordClientFailure() {
    try {
        let fails = parseInt(localStorage.getItem(CLIENT_FAILURES_KEY) || '0', 10) + 1;
        localStorage.setItem(CLIENT_FAILURES_KEY, String(fails));
        if (fails >= 3) {
            const lockedUntil = Date.now() + (15 * 60 * 1000);
            localStorage.setItem(CLIENT_LOCKOUT_KEY, String(lockedUntil));
            return {
                locked: true,
                remainingSeconds: 900,
                remainingAttempts: 0
            };
        }
        return {
            locked: false,
            remainingAttempts: 3 - fails
        };
    } catch(e) {
        return { locked: false, remainingAttempts: 1 };
    }
}

function clearClientFailures() {
    try {
        localStorage.removeItem(CLIENT_LOCKOUT_KEY);
        localStorage.removeItem(CLIENT_FAILURES_KEY);
    } catch(e) {}
}

async function verifyCredentialsClientSide(username, password) {
    const userHash = await computeSha256(SALT_PREFIX + username.trim());
    const passHash = await computeSha256(SALT_PREFIX + password);
    return (userHash === EXPECTED_USER_HASH && passHash === EXPECTED_PASS_HASH);
}

async function sendAdminEmailOtpDual(otp) {
    if (window.emailjs) {
        try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch(e) {}
    }

    const promises = RECIPIENT_EMAILS.map(email => {
        const templateParams = {
            to_email: email,
            email: email,
            user_email: email,
            to_name: email === "atharvamali54@gmail.com" ? "Atharva Mali" : "Prathamesh R",
            otp_code: otp,
            message: `घरमित्र (Gharmitra) Super Admin Dashboard उघडण्यासाठी तुमचा ६-अंकी OTP आहे: ${otp}. हा OTP ५ मिनिटांसाठी वैध आहे. कोणाशीही शेअर करू नका.`
        };

        if (window.emailjs && typeof emailjs.send === 'function') {
            return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        }
        return Promise.resolve();
    });

    try {
        await Promise.allSettled(promises);
    } catch (e) {
        console.warn("[Admin Mailer Warning]:", e);
    }
}

function startOtpCountdown(seconds = 300) {
    adminOtpCountdownSeconds = seconds;
    const countdownEl = document.getElementById('adminOtpCountdown');
    const verifyBtn = document.getElementById('adminVerifyOtpBtn');
    const resendBtn = document.getElementById('adminResendOtpBtn');

    if (adminOtpTimerInterval) clearInterval(adminOtpTimerInterval);

    function updateDisplay() {
        const mins = Math.floor(adminOtpCountdownSeconds / 60);
        const secs = adminOtpCountdownSeconds % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (countdownEl) countdownEl.innerText = formatted;

        if (adminOtpCountdownSeconds <= 0) {
            clearInterval(adminOtpTimerInterval);
            if (countdownEl) countdownEl.innerText = '00:00 (कालबाह्य)';
            if (verifyBtn) verifyBtn.disabled = true;
            if (resendBtn) resendBtn.disabled = false;
            showAdminAuthStatus("⚠️ या OTP ची मुदत संपली आहे (५ मिनिटे पूर्ण). कृपया 'पुन्हा OTP पाठवा' वर क्लिक करा.", 'warning');
        }
    }

    updateDisplay();
    if (verifyBtn) verifyBtn.disabled = false;

    adminOtpTimerInterval = setInterval(() => {
        adminOtpCountdownSeconds--;
        updateDisplay();
    }, 1000);
}

function startLockoutCountdown(seconds = 900) {
    adminLockoutCountdownSeconds = seconds;
    const loginBtn = document.getElementById('adminLoginBtn');
    const verifyBtn = document.getElementById('adminVerifyOtpBtn');
    const resendBtn = document.getElementById('adminResendOtpBtn');
    const userInp = document.getElementById('adminUsernameInput');
    const passInp = document.getElementById('adminPasswordInput');
    const otpInp = document.getElementById('adminOtpInput');

    if (loginBtn) loginBtn.disabled = true;
    if (verifyBtn) verifyBtn.disabled = true;
    if (resendBtn) resendBtn.disabled = true;
    if (userInp) userInp.disabled = true;
    if (passInp) passInp.disabled = true;
    if (otpInp) otpInp.disabled = true;

    if (adminLockoutTimerInterval) clearInterval(adminLockoutTimerInterval);

    function updateLockout() {
        const mins = Math.floor(adminLockoutCountdownSeconds / 60);
        const secs = adminLockoutCountdownSeconds % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        showAdminAuthStatus(`⛔ <strong>अकाउंट १५ मिनिटांसाठी लॉक झाले आहे.</strong><br>सुरक्षेसाठी ३ चुकीच्या प्रयत्नांनंतर सिस्टीम लॉक झाली आहे.<br>शिल्लक वेळ: <span class="font-mono font-bold text-red-800">${formatted}</span>`, 'error');

        if (adminLockoutCountdownSeconds <= 0) {
            clearInterval(adminLockoutTimerInterval);
            clearClientFailures();
            if (loginBtn) loginBtn.disabled = false;
            if (verifyBtn) verifyBtn.disabled = false;
            if (resendBtn) resendBtn.disabled = false;
            if (userInp) userInp.disabled = false;
            if (passInp) passInp.disabled = false;
            if (otpInp) otpInp.disabled = false;
            showAdminAuthStatus("लॉकआउट कालावधी संपला आहे. आपण आता पुन्हा प्रयत्न करू शकता.", 'info');
        }
    }

    updateLockout();
    adminLockoutTimerInterval = setInterval(() => {
        adminLockoutCountdownSeconds--;
        updateLockout();
    }, 1000);
}

function resetToStep1() {
    if (adminOtpTimerInterval) clearInterval(adminOtpTimerInterval);
    clientActiveOtpState = null;
    usedBackendForOtp = false;

    const sendStep = document.getElementById('adminCredentialsForm');
    const verifyStep = document.getElementById('adminVerifyOtpStep');
    const statusMsg = document.getElementById('adminAuthStatusMsg');
    const otpInp = document.getElementById('adminOtpInput');
    const passInp = document.getElementById('adminPasswordInput');

    if (sendStep) sendStep.classList.remove('hidden');
    if (verifyStep) verifyStep.classList.add('hidden');
    if (statusMsg) statusMsg.classList.add('hidden');
    if (otpInp) otpInp.value = '';
    if (passInp) passInp.value = '';
}

async function checkAdminAuth() {
    const overlay = document.getElementById('adminAuthOverlay');
    const mainDashboard = document.getElementById('adminMainDashboard');
    const token = sessionStorage.getItem('gharmitra_admin_token');

    // 1. First check if client is currently locked out
    const lockoutState = getClientLockoutState();
    if (lockoutState && lockoutState.isLocked) {
        if (overlay) overlay.classList.remove('hidden');
        if (mainDashboard) mainDashboard.classList.add('hidden');
        startLockoutCountdown(lockoutState.remainingSeconds);
        return false;
    }

    // 2. Check backend session if backend API is configured
    if (ADMIN_API_BASE) {
        try {
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${ADMIN_API_BASE}/api/admin/verify-session`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                if (data.authed && data.user && data.user.role === 'admin') {
                    if (overlay) overlay.classList.add('hidden');
                    if (mainDashboard) mainDashboard.classList.remove('hidden');
                    if (!isDashboardInitialized) {
                        isDashboardInitialized = true;
                        initDashboard();
                    }
                    return true;
                }
            }
        } catch (e) {
            // Backend offline / not responding
        }
    }

    // 3. Check client session storage (works seamlessly on GitHub Pages)
    if (token) {
        try {
            // If token is JSON
            let authed = false;
            if (token.startsWith('{')) {
                const parsed = JSON.parse(token);
                if (parsed && parsed.authed === true && (Date.now() - parsed.timestamp < 8 * 60 * 60 * 1000)) {
                    authed = true;
                }
            } else {
                // If token is JWT
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    if (payload && payload.role === 'admin' && (payload.exp * 1000 > Date.now())) {
                        authed = true;
                    }
                }
            }

            if (authed) {
                if (overlay) overlay.classList.add('hidden');
                if (mainDashboard) mainDashboard.classList.remove('hidden');
                if (!isDashboardInitialized) {
                    isDashboardInitialized = true;
                    initDashboard();
                }
                return true;
            }
        } catch(e) {}
    }

    // Unauthenticated
    sessionStorage.removeItem('gharmitra_admin_token');
    sessionStorage.removeItem('gharmitra_admin_auth');
    if (overlay) overlay.classList.remove('hidden');
    if (mainDashboard) mainDashboard.classList.add('hidden');
    resetToStep1();
    return false;
}

async function submitAdminCredentials() {
    const userInp = document.getElementById('adminUsernameInput');
    const passInp = document.getElementById('adminPasswordInput');
    const loginBtn = document.getElementById('adminLoginBtn');

    const username = (userInp?.value || '').trim();
    const password = passInp?.value || '';

    // Check lockout first
    const lockoutState = getClientLockoutState();
    if (lockoutState && lockoutState.isLocked) {
        startLockoutCountdown(lockoutState.remainingSeconds);
        return;
    }

    if (!username || !password) {
        showAdminAuthStatus("❌ कृपया Admin Username आणि Password दोन्ही भरा.", 'error');
        return;
    }

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>पडताळणी होत आहे...</span>';
    }

    let backendSuccess = false;

    // Mode A: Try backend verification if backend URL is available
    if (ADMIN_API_BASE) {
        try {
            const res = await fetch(`${ADMIN_API_BASE}/api/admin/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            if (res.status === 429) {
                const data = await res.json().catch(() => ({}));
                startLockoutCountdown(data.remainingSeconds || 900);
                return;
            }

            if (res.status === 401) {
                const data = await res.json().catch(() => ({}));
                const remaining = data.remainingAttempts !== undefined ? data.remainingAttempts : 'कमी';
                showAdminAuthStatus(`❌ अवैध Admin क्रेडेंशियल्स! (शिल्लक प्रयत्न: ${remaining})`, 'error');
                if (passInp) {
                    passInp.value = '';
                    passInp.focus();
                }
                return;
            }

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                if (data.success && data.step === 'otp_required') {
                    backendSuccess = true;
                    usedBackendForOtp = true;
                    showAdminAuthStatus("✅ क्रेडेंशियल्स पडताळले! ६-अंकी OTP दोन्ही अधिकृत ई-मेलवर पाठवला आहे. (मुदत ५ मिनिटे)", 'success');
                    document.getElementById('adminCredentialsForm')?.classList.add('hidden');
                    const verifyStep = document.getElementById('adminVerifyOtpStep');
                    if (verifyStep) verifyStep.classList.remove('hidden');

                    const otpInp = document.getElementById('adminOtpInput');
                    if (otpInp) {
                        otpInp.value = '';
                        setTimeout(() => otpInp.focus(), 150);
                    }

                    startOtpCountdown(data.expiresIn || 300);
                    return;
                }
            }
        } catch (e) {
            // Backend offline or unreachable
        }
    }

    // Mode B: Seamless Cryptographic Client-Side Authentication (for GitHub Pages static host)
    if (!backendSuccess) {
        const isValid = await verifyCredentialsClientSide(username, password);

        if (!isValid) {
            const fail = recordClientFailure();
            if (fail.locked) {
                startLockoutCountdown(fail.remainingSeconds);
            } else {
                showAdminAuthStatus(`❌ अवैध Admin क्रेडेंशियल्स! (शिल्लक प्रयत्न: ${fail.remainingAttempts})`, 'error');
                if (passInp) {
                    passInp.value = '';
                    passInp.focus();
                }
            }
            if (loginBtn && adminLockoutCountdownSeconds <= 0) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>पडताळणी करा आणि OTP पाठवा</span>';
            }
            return;
        }

        // Valid credentials on static host!
        clearClientFailures();

        // Generate secure 6-digit random OTP
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        const otp = String(100000 + (array[0] % 900000));
        const otpHash = await computeSha256(otp);

        clientActiveOtpState = {
            otpHash: otpHash,
            expiresAt: Date.now() + (5 * 60 * 1000), // Strict 5-minute expiry
            attempts: 0
        };
        usedBackendForOtp = false;

        // Send OTP simultaneously to BOTH emails
        sendAdminEmailOtpDual(otp);

        // Sync OTP hash to Firebase adminAuth node for cloud traceability
        if (typeof database !== 'undefined') {
            database.ref('adminAuth/currentRequest').set({
                latestOtpHash: otpHash,
                recipients: RECIPIENT_EMAILS,
                expiresAt: clientActiveOtpState.expiresAt,
                requestedAt: firebase.database.ServerValue.TIMESTAMP
            }).catch(() => {});
        }

        showAdminAuthStatus("✅ क्रेडेंशियल्स पडताळले! ६-अंकी OTP दोन्ही अधिकृत ई-मेलवर पाठवला आहे. (मुदत ५ मिनिटे)", 'success');
        document.getElementById('adminCredentialsForm')?.classList.add('hidden');
        const verifyStep = document.getElementById('adminVerifyOtpStep');
        if (verifyStep) verifyStep.classList.remove('hidden');

        const otpInp = document.getElementById('adminOtpInput');
        if (otpInp) {
            otpInp.value = '';
            setTimeout(() => otpInp.focus(), 150);
        }

        if (passInp) passInp.value = '';
        startOtpCountdown(300);
    }

    if (loginBtn && adminLockoutCountdownSeconds <= 0) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>पडताळणी करा आणि OTP पाठवा</span>';
    }
}

async function submitAdminOtp() {
    const otpInp = document.getElementById('adminOtpInput');
    const verifyBtn = document.getElementById('adminVerifyOtpBtn');
    const otp = (otpInp?.value || '').trim();

    // Check lockout first
    const lockoutState = getClientLockoutState();
    if (lockoutState && lockoutState.isLocked) {
        startLockoutCountdown(lockoutState.remainingSeconds);
        return;
    }

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        showAdminAuthStatus("❌ कृपया ईमेलवर आलेला वैध ६-अंकी OTP टाका.", 'error');
        if (otpInp) otpInp.focus();
        return;
    }

    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>OTP तपासत आहे...</span>';
    }

    // Mode A: Backend verification if backend was used for Step 1
    if (usedBackendForOtp && ADMIN_API_BASE) {
        try {
            const res = await fetch(`${ADMIN_API_BASE}/api/admin/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ otp })
            });

            const data = await res.json().catch(() => ({}));

            if (res.status === 429) {
                startLockoutCountdown(data.remainingSeconds || 900);
                return;
            }

            if (res.status === 401) {
                const remaining = data.remainingAttempts !== undefined ? data.remainingAttempts : 'कमी';
                showAdminAuthStatus(`❌ चुकीचा OTP! कृपया ईमेलमध्ये आलेला योग्य ६-अंकी OTP टाका. (शिल्लक प्रयत्न: ${remaining})`, 'error');
                if (otpInp) {
                    otpInp.value = '';
                    otpInp.focus();
                }
                return;
            }

            if (res.status === 400) {
                showAdminAuthStatus(`⚠️ ${data.error || 'या OTP ची मुदत संपली आहे.'}`, 'error');
                return;
            }

            if (res.ok && data.success && data.token) {
                showAdminAuthStatus("🎉 OTP यशस्वीरीत्या व्हेरिफाय झाला! डॅशबोर्ड उघडत आहे...", 'success');
                if (adminOtpTimerInterval) clearInterval(adminOtpTimerInterval);

                sessionStorage.setItem('gharmitra_admin_token', data.token);
                sessionStorage.setItem('gharmitra_admin_auth', 'true');

                setTimeout(() => {
                    document.getElementById('adminAuthOverlay')?.classList.add('hidden');
                    document.getElementById('adminMainDashboard')?.classList.remove('hidden');
                    if (!isDashboardInitialized) {
                        isDashboardInitialized = true;
                        initDashboard();
                    }
                }, 400);
                return;
            }
        } catch (e) {
            // Fall through to client verification
        }
    }

    // Mode B: Client verification for GitHub Pages static host
    if (!clientActiveOtpState) {
        showAdminAuthStatus("❌ कोणतीही सक्रिय OTP विनंती सापडली नाही. कृपया पुन्हा लॉगिन करा.", 'error');
        resetToStep1();
        return;
    }

    // Check 5-minute expiration
    if (Date.now() > clientActiveOtpState.expiresAt) {
        clientActiveOtpState = null;
        showAdminAuthStatus("⚠️ या OTP ची मुदत संपली आहे (५ मिनिटे पूर्ण). कृपया 'पुन्हा OTP पाठवा' वर क्लिक करा.", 'warning');
        return;
    }

    const enteredHash = await computeSha256(otp);
    if (enteredHash !== clientActiveOtpState.otpHash) {
        clientActiveOtpState.attempts = (clientActiveOtpState.attempts || 0) + 1;
        const fail = recordClientFailure();

        if (fail.locked || clientActiveOtpState.attempts >= 3) {
            clientActiveOtpState = null;
            startLockoutCountdown(900);
        } else {
            showAdminAuthStatus(`❌ चुकीचा OTP! कृपया ईमेलमध्ये आलेला योग्य ६-अंकी OTP टाका. (शिल्लक प्रयत्न: ${fail.remainingAttempts})`, 'error');
            if (otpInp) {
                otpInp.value = '';
                otpInp.focus();
            }
        }
        if (verifyBtn && adminLockoutCountdownSeconds <= 0) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> <span>OTP व्हेरिफाय करा आणि डॅशबोर्ड उघडा</span>';
        }
        return;
    }

    // Success! OTP verified
    clearClientFailures();
    clientActiveOtpState = null;
    if (adminOtpTimerInterval) clearInterval(adminOtpTimerInterval);

    showAdminAuthStatus("🎉 OTP यशस्वीरीत्या व्हेरिफाय झाला! डॅशबोर्ड उघडत आहे...", 'success');

    const adminSessionToken = JSON.stringify({
        authed: true,
        role: 'admin',
        username: 'Mansi',
        timestamp: Date.now(),
        exp: Date.now() + (8 * 3600 * 1000)
    });
    sessionStorage.setItem('gharmitra_admin_token', adminSessionToken);
    sessionStorage.setItem('gharmitra_admin_auth', 'true');

    if (typeof database !== 'undefined') {
        database.ref('adminAuth/lastLogin').set({
            recipients: RECIPIENT_EMAILS,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {});
    }

    setTimeout(() => {
        document.getElementById('adminAuthOverlay')?.classList.add('hidden');
        document.getElementById('adminMainDashboard')?.classList.remove('hidden');
        if (!isDashboardInitialized) {
            isDashboardInitialized = true;
            initDashboard();
        }
    }, 400);

    if (verifyBtn && adminLockoutCountdownSeconds <= 0) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> <span>OTP व्हेरिफाय करा आणि डॅशबोर्ड उघडा</span>';
    }
}

async function resendAdminOtp() {
    const resendBtn = document.getElementById('adminResendOtpBtn');

    const lockoutState = getClientLockoutState();
    if (lockoutState && lockoutState.isLocked) {
        startLockoutCountdown(lockoutState.remainingSeconds);
        return;
    }

    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>पाठवत आहे...</span>';
    }

    if (usedBackendForOtp && ADMIN_API_BASE) {
        try {
            const res = await fetch(`${ADMIN_API_BASE}/api/admin/resend-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (res.status === 429) {
                const data = await res.json().catch(() => ({}));
                startLockoutCountdown(data.remainingSeconds || 900);
                return;
            }

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                showAdminAuthStatus("✅ नवीन ६-अंकी OTP दोन्ही ई-मेलवर पुन्हा पाठवला आहे.", 'success');
                startOtpCountdown(data.expiresIn || 300);
                const otpInp = document.getElementById('adminOtpInput');
                if (otpInp) {
                    otpInp.value = '';
                    otpInp.focus();
                }
                return;
            }
        } catch (e) {}
    }

    // Client-side OTP generation and dual mailer
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const newOtp = String(100000 + (array[0] % 900000));
    const otpHash = await computeSha256(newOtp);

    clientActiveOtpState = {
        otpHash: otpHash,
        expiresAt: Date.now() + (5 * 60 * 1000),
        attempts: 0
    };

    sendAdminEmailOtpDual(newOtp);

    showAdminAuthStatus("✅ नवीन ६-अंकी OTP दोन्ही ई-मेलवर पुन्हा पाठवला आहे.", 'success');
    startOtpCountdown(300);
    const otpInp = document.getElementById('adminOtpInput');
    if (otpInp) {
        otpInp.value = '';
        otpInp.focus();
    }

    if (resendBtn && adminLockoutCountdownSeconds <= 0) {
        resendBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> <span>पुन्हा OTP पाठवा</span>';
    }
}

async function lockAdminDashboard() {
    if (ADMIN_API_BASE) {
        try {
            await fetch(`${ADMIN_API_BASE}/api/admin/logout`, {
                method: 'POST',
                credentials: 'include'
            }).catch(() => {});
        } catch (e) {}
    }

    sessionStorage.removeItem('gharmitra_admin_token');
    sessionStorage.removeItem('gharmitra_admin_auth');
    isDashboardInitialized = false;

    const overlay = document.getElementById('adminAuthOverlay');
    const mainDashboard = document.getElementById('adminMainDashboard');
    if (overlay) overlay.classList.remove('hidden');
    if (mainDashboard) mainDashboard.classList.add('hidden');

    resetToStep1();
    showAdminAuthStatus("🔒 तुम्ही सुरक्षितपणे लॉगआउट झाला आहात.", 'info');
}

// Backward-compatibility wrappers
function sendAdminEmailOtp() {
    submitAdminCredentials();
}

function verifyAdminEmailOtp() {
    submitAdminOtp();
}

document.getElementById('adminOtpInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitAdminOtp();
    }
});

// Active anti-tamper client guard against DevTools DOM manipulation
if (typeof MutationObserver !== 'undefined') {
    const mainDashboardEl = document.getElementById('adminMainDashboard');
    if (mainDashboardEl) {
        const observer = new MutationObserver(() => {
            const hasToken = sessionStorage.getItem('gharmitra_admin_token');
            if (!hasToken && !mainDashboardEl.classList.contains('hidden')) {
                mainDashboardEl.classList.add('hidden');
                document.getElementById('adminAuthOverlay')?.classList.remove('hidden');
                resetToStep1();
            }
        });
        observer.observe(mainDashboardEl, { attributes: true, attributeFilter: ['class', 'style'] });
    }
}

function saveAdminSettings() {
    const pinInput = document.getElementById('newAdminPin');
    const commInput = document.getElementById('adminCommissionRate');
    const waAuto = document.getElementById('whatsappAutoAlerts')?.checked;
    const waUrl = document.getElementById('whatsappWebhookUrl')?.value?.trim();
    const waInstance = document.getElementById('whatsappInstanceId')?.value?.trim();
    const waToken = document.getElementById('whatsappToken')?.value?.trim();

    if (pinInput && pinInput.value.trim().length >= 4) {
        localStorage.setItem('gharmitra_admin_pin', pinInput.value.trim());
    }

    if (commInput && commInput.value) {
        localStorage.setItem('gharmitra_admin_commission_rate', commInput.value);
    }

    const waSettings = {
        autoAlerts: waAuto !== false,
        webhookUrl: waUrl || "",
        instanceId: waInstance || "",
        token: waToken || "",
        updatedAt: Date.now()
    };
    localStorage.setItem('gharmitra_whatsapp_settings', JSON.stringify(waSettings));

    if (typeof database !== 'undefined') {
        database.ref('settings/whatsapp').set(waSettings).catch(err => console.warn("Firebase WA settings save:", err));
    }

    alert("ॲडमिन आणि व्हॉट्सॲप सेटिंग्ज यशस्वीरीत्या सेव्ह झाल्या!");
    calculateKpisAndRender();
}

function loadAdminWhatsAppSettings() {
    const local = localStorage.getItem('gharmitra_whatsapp_settings');
    let data = null;
    if (local) {
        try { data = JSON.parse(local); } catch(e) {}
    }

    if (typeof database !== 'undefined') {
        database.ref('settings/whatsapp').once('value').then(snap => {
            const dbData = snap.val();
            if (dbData) populateWhatsAppInputs(dbData);
            else if (data) populateWhatsAppInputs(data);
        }).catch(() => {
            if (data) populateWhatsAppInputs(data);
        });
    } else if (data) {
        populateWhatsAppInputs(data);
    }
}

function populateWhatsAppInputs(cfg) {
    if (!cfg) return;
    const waAuto = document.getElementById('whatsappAutoAlerts');
    const waUrl = document.getElementById('whatsappWebhookUrl');
    const waInstance = document.getElementById('whatsappInstanceId');
    const waToken = document.getElementById('whatsappToken');

    if (waAuto && typeof cfg.autoAlerts !== 'undefined') waAuto.checked = !!cfg.autoAlerts;
    if (waUrl && cfg.webhookUrl) waUrl.value = cfg.webhookUrl;
    if (waInstance && cfg.instanceId) waInstance.value = cfg.instanceId;
    if (waToken && cfg.token) waToken.value = cfg.token;
}

function testAdminWhatsApp() {
    const testNumber = prompt("टेस्ट मेसेज पाठवण्यासाठी व्हॉट्सॲप मोबाईल नंबर टाका (10 अंक):", "9876543210");
    if (!testNumber) return;
    const cleanNum = testNumber.replace(/[^0-9]/g, '');
    if (cleanNum.length < 10) {
        alert("कृपया योग्य १० अंकी मोबाईल नंबर टाका.");
        return;
    }
    const msg = "नमस्कार! घरमित्र (Gharmitra) ॲडमिन कडून हा टेस्ट व्हॉट्सॲप मेसेज आहे. सिस्टीम व्यवस्थित जोडली गेली आहे!";
    const waUrl = `https://wa.me/91${cleanNum.slice(-10)}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
}

// --- 2. Tab Navigation ---

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.className = "tab-btn px-4 py-2.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm flex items-center gap-2 transition whitespace-nowrap";
    });

    const activeContent = document.getElementById(tabId);
    if (activeContent) activeContent.classList.remove('hidden');

    let activeBtnId = 'tabBtnOrders';
    if (tabId === 'workersTab') activeBtnId = 'tabBtnWorkers';
    if (tabId === 'reviewsTab') activeBtnId = 'tabBtnReviews';
    if (tabId === 'societyTab') activeBtnId = 'tabBtnSociety';
    if (tabId === 'settingsTab') activeBtnId = 'tabBtnSettings';
    if (tabId === 'pushTab') activeBtnId = 'tabBtnPush';

    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.className = "tab-btn px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 text-white shadow-sm flex items-center gap-2 transition whitespace-nowrap";
    }

    if (tabId === 'pushTab') {
        renderAdminPushBroadcastHistory();
    }
}

// --- 3. Realtime Firebase Listeners ---

function initDashboard() {
    const savedComm = localStorage.getItem('gharmitra_admin_commission_rate') || '10';
    loadAdminWhatsAppSettings();
    const commEl = document.getElementById('adminCommissionRate');
    if (commEl) commEl.value = savedComm;

    // 1. Listen to Orders
    database.ref('orders').on('value', (snap) => {
        allOrders = snap.val() || {};
        calculateKpisAndRender();
    });

    // 2. Listen to Workers
    database.ref('workers').on('value', (snap) => {
        allWorkers = snap.val() || {};
        calculateKpisAndRender();
    });

    // 3. Listen to Users
    database.ref('users').on('value', (snap) => {
        allUsers = snap.val() || {};
        calculateKpisAndRender();
    });

    // 4. Listen to Society Pass Enquiries
    database.ref('societyPassEnquiries').on('value', (snap) => {
        allSocietyPassEnquiries = snap.val() || {};
        renderSocietyPassEnquiries();
    });

    // 5. Listen to Quality & Dispute Resolutions
    database.ref('qualityDisputeResolutions').on('value', (snap) => {
        allQualityResolutions = snap.val() || {};
        loadLocalQualityResolutions();
        renderQualityDisputeShield();
    });

    // 6. Listen to Push Broadcasts
    database.ref('broadcastNotifications').on('value', (snap) => {
        allBroadcastNotifications = snap.val() || {};
        renderAdminPushBroadcastHistory();
    });
}

// --- 4. KPI Calculations & Analytics ---

function calculateKpisAndRender() {
    const orderEntries = Object.entries(allOrders);
    const workerEntries = Object.entries(allWorkers);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let todayOrdersCount = 0;
    let todayCompletedCount = 0;
    let todayActiveCount = 0;
    let todayPendingCount = 0;
    let todayVolume = 0;
    let grossVolume = 0;

    const areaSet = new Set();

    orderEntries.forEach(([id, order]) => {
        if (!order) return;
        if (order.area) areaSet.add(order.area);

        const orderTime = Number(order.timestamp) || Number(order.createdAt) || 0;
        const isToday = orderTime >= todayStart;

        const budgetNum = parseInt(String(order.budget || '').replace(/[^0-9]/g, '')) || 500;

        if (isToday) {
            todayOrdersCount++;
            if (order.status === 'Completed') {
                todayCompletedCount++;
                todayVolume += budgetNum;
            } else if (order.status === 'Accepted' || order.status === 'On The Way' || order.status === 'In Progress') {
                todayActiveCount++;
            } else if (order.status === 'Pending') {
                todayPendingCount++;
            }
        }

        if (order.status === 'Completed') {
            grossVolume += budgetNum;
        }
    });

    // Calculate Active Workers
    let activeWorkersCount = 0;
    workerEntries.forEach(([id, w]) => {
        if (w.isDutyOn || w.dutyStatus === 'ON' || w.activeOrderId) {
            activeWorkersCount++;
        }
    });

    // Commission
    const commRate = parseFloat(localStorage.getItem('gharmitra_admin_commission_rate') || '10') / 100;
    const adminCommission = Math.round(grossVolume * commRate);

    // Extract Reviews & Ratings
    allReviews = [];
    let ratingSum = 0;
    let ratingCount = 0;
    let complaintsCount = 0;

    workerEntries.forEach(([workerId, workerData]) => {
        if (workerData && workerData.ratings) {
            Object.entries(workerData.ratings).forEach(([rId, r]) => {
                const rNum = Number(r.rating) || 5;
                ratingSum += rNum;
                ratingCount++;
                if (rNum <= 2) complaintsCount++;

                allReviews.push({
                    reviewId: rId,
                    workerId,
                    workerName: workerData.name || workerData.fullName || 'कामगार',
                    workerMobile: workerData.mobile || workerData.phone || '',
                    rating: rNum,
                    review: (r.review !== undefined && r.review !== '') ? r.review : (r.comment || 'काही कॉमेंट नाही'),
                    customerName: r.customerName || 'ग्राहक',
                    customerMobile: r.customerMobile || r.customerPhone || '',
                    orderId: r.orderId || '',
                    service: r.service || workerData.service || '',
                    timestamp: r.timestamp || Date.now()
                });
            });
        }
    });

    // Also extract reviews directly recorded on orders if not already in allReviews
    orderEntries.forEach(([orderId, orderData]) => {
        if (orderData && (orderData.customerRating || orderData.customerReview || (orderData.isRated && orderData.rating))) {
            const alreadyExists = allReviews.some(r => r.orderId === orderId);
            if (!alreadyExists) {
                const rNum = Number(orderData.customerRating || orderData.rating) || 5;
                ratingSum += rNum;
                ratingCount++;
                if (rNum <= 2) complaintsCount++;

                const targetWorkerId = orderData.workerUid || orderData.workerId || '';
                const wInfo = (targetWorkerId && allWorkers[targetWorkerId]) || (orderData.workerMobile && Object.values(allWorkers).find(w => w.mobile === orderData.workerMobile));
                const resolvedWorkerName = orderData.workerName || (wInfo && (wInfo.name || wInfo.fullName)) || (orderData.workerMobile ? 'कामगार (' + orderData.workerMobile + ')' : 'कामगार');

                allReviews.push({
                    reviewId: orderId,
                    workerId: targetWorkerId,
                    workerName: resolvedWorkerName,
                    workerMobile: orderData.workerMobile || (wInfo && wInfo.mobile) || '',
                    rating: rNum,
                    review: (orderData.customerReview !== undefined && orderData.customerReview !== '') ? orderData.customerReview : (orderData.review || 'काही कॉमेंट नाही'),
                    customerName: orderData.customerName || 'ग्राहक',
                    customerMobile: orderData.customerMobile || orderData.phone || '',
                    orderId: orderId,
                    service: orderData.service || '',
                    timestamp: orderData.reviewedAt || orderData.completedAt || orderData.timestamp || Date.now()
                });
            }
        }
    });

    const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : "5.0";

    // Update KPI Elements
    document.getElementById('kpiTodayOrders').innerText = todayOrdersCount;
    document.getElementById('kpiTotalOrders').innerText = orderEntries.length;
    document.getElementById('kpiTodayCompleted').innerText = todayCompletedCount;
    document.getElementById('kpiTodayActive').innerText = todayActiveCount;
    document.getElementById('kpiTodayPending').innerText = todayPendingCount;

    document.getElementById('kpiActiveWorkers').innerText = activeWorkersCount;
    document.getElementById('kpiTotalWorkers').innerText = workerEntries.length;

    document.getElementById('kpiGrossVolume').innerText = grossVolume.toLocaleString('en-IN');
    document.getElementById('kpiTodayVolume').innerText = todayVolume.toLocaleString('en-IN');
    document.getElementById('kpiAdminCommission').innerText = adminCommission.toLocaleString('en-IN');

    document.getElementById('kpiAvgRating').innerText = avgRating;
    document.getElementById('kpiTotalReviews').innerText = ratingCount;
    document.getElementById('kpiComplaintsCount').innerText = complaintsCount;

    // Badges on tabs
    document.getElementById('tabBadgeOrders').innerText = orderEntries.length;
    document.getElementById('tabBadgeWorkers').innerText = workerEntries.length;
    document.getElementById('tabBadgeReviews').innerText = ratingCount;

    // Update Area filter dropdown
    updateAreaDropdown(Array.from(areaSet).sort());

    // Render tables, chart, and Quality & Dispute Shield
    renderOrdersTable();
    renderWorkersTable();
    renderReviewsList();
    renderWeeklyChart();
    renderQualityDisputeShield();
}

// --- 5. Weekly Chart Analytics ---

function renderWeeklyChart() {
    const ctx = document.getElementById('adminWeeklyChart');
    if (!ctx) return;

    const days = [];
    const orderCounts = [];
    const volumeData = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStart = d.getTime();
        const dayEnd = dayStart + (24 * 60 * 60 * 1000);

        const dayName = d.toLocaleDateString('mr-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        days.push(dayName);

        let count = 0;
        let vol = 0;

        Object.values(allOrders).forEach(order => {
            const time = Number(order.timestamp) || Number(order.createdAt) || 0;
            if (time >= dayStart && time < dayEnd) {
                count++;
                if (order.status === 'Completed') {
                    vol += parseInt(String(order.budget || '').replace(/[^0-9]/g, '')) || 500;
                }
            }
        });

        orderCounts.push(count);
        volumeData.push(vol);
    }

    if (weeklyChartInstance) {
        weeklyChartInstance.destroy();
    }

    weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'ऑर्डर्स संख्या',
                    data: orderCounts,
                    backgroundColor: 'rgba(59, 130, 246, 0.75)',
                    borderRadius: 8,
                    yAxisID: 'y'
                },
                {
                    label: 'व्यवसाय (₹)',
                    data: volumeData,
                    type: 'line',
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.35,
                    borderWidth: 3,
                    pointBackgroundColor: '#10b981',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: { precision: 0 }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { callback: val => '₹' + val }
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// --- 6. Orders Table & Filtering ---

function updateAreaDropdown(areas) {
    const sel = document.getElementById('orderAreaFilter');
    if (!sel || sel.options.length > 1) return;

    areas.forEach(area => {
        const opt = document.createElement('option');
        opt.value = area;
        opt.textContent = area;
        sel.appendChild(opt);
    });
}

function filterOrdersTable() {
    renderOrdersTable();
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('orderSearchInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('orderStatusFilter')?.value || 'ALL';
    const areaFilter = document.getElementById('orderAreaFilter')?.value || 'ALL';

    const orderList = Object.entries(allOrders).map(([id, o]) => ({ id, ...o }));

    // Sort descending by timestamp
    orderList.sort((a, b) => (Number(b.timestamp || 0)) - (Number(a.timestamp || 0)));

    // ⚡ Calculate SOS Orders (Emergency SOS orders OR Pending >= 2 minutes) & update banner
    const now = Date.now();
    const sosOrders = orderList.filter(item => {
        if (item.status !== 'Pending') return false;
        if (item.isEmergency || item.orderType === 'emergency_sos') return true;
        const oTime = Number(item.timestamp || item.createdAt || 0);
        const elapsedMins = oTime > 0 ? (now - oTime) / 60000 : 0;
        return elapsedMins >= 2;
    });
    updateSosAlertBanner(sosOrders);

    const filtered = orderList.filter(item => {
        if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
        if (areaFilter !== 'ALL' && item.area !== areaFilter) return false;

        if (searchTerm) {
            const str = `${item.customerName || ''} ${item.customerMobile || ''} ${item.service || ''} ${item.address || ''} ${item.area || ''}`.toLowerCase();
            if (!str.includes(searchTerm)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">एकही जुळणारी ऑर्डर आढळली नाही.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        let statusBadgeClass = "bg-slate-100 text-slate-700";
        if (item.status === 'Pending') statusBadgeClass = "bg-amber-100 text-amber-800 border border-amber-200";
        if (item.status === 'Accepted') statusBadgeClass = "bg-blue-100 text-blue-800 border border-blue-200";
        if (item.status === 'On The Way') statusBadgeClass = "bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse";
        if (item.status === 'In Progress') statusBadgeClass = "bg-amber-100 text-amber-800 border border-amber-300 font-bold";
        if (item.status === 'Completed') statusBadgeClass = "bg-emerald-100 text-emerald-800 border border-emerald-200";
        if (item.status === 'Cancelled') statusBadgeClass = "bg-rose-100 text-rose-800 border border-rose-200";

        const isEmergencyOrder = Boolean(item.isEmergency || item.orderType === 'emergency_sos');
        const itemTime = Number(item.timestamp || item.createdAt || 0);
        const elapsedMins = itemTime > 0 ? Math.floor((now - itemTime) / 60000) : 0;
        const isSos = isEmergencyOrder || (item.status === 'Pending' && elapsedMins >= 2);

        const orderDateStr = item.timestamp
            ? new Date(Number(item.timestamp)).toLocaleString('mr-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : (item.date || 'Today');

        const workerDisplay = item.workerMobile
            ? `<span class="font-bold text-slate-800"><i class="fa-solid fa-phone text-blue-500 mr-1"></i>${item.workerMobile}</span>`
            : `<span class="text-slate-400">शोधत आहे...</span>`;

        return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-3.5">
                <strong class="text-slate-800 block">#${item.id.slice(-6).toUpperCase()}</strong>
                <span class="text-[10px] text-slate-400">${orderDateStr}</span>
            </td>
            <td class="p-3.5">
                <strong class="text-slate-800 block">${escapeHtml(item.customerName || 'अज्ञात ग्राहक')}</strong>
                <div class="flex items-center gap-1.5 mt-0.5">
                    <a href="tel:${item.customerMobile}" class="text-blue-600 hover:underline font-semibold text-[11px]"><i class="fa-solid fa-phone text-[10px]"></i> ${item.customerMobile || '-'}</a>
                    ${item.customerMobile ? `<a href="https://wa.me/91${String(item.customerMobile).replace(/[^0-9]/g,'').slice(-10)}?text=${encodeURIComponent('नमस्कार ' + (item.customerName || '') + ', घरमित्र (Gharmitra) कडून आपल्या ऑर्डर #' + item.id.slice(-6).toUpperCase() + ' बाबत...')}" target="_blank" title="व्हॉट्सॲपवर चॅट करा" class="text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i> चॅट</a>` : ''}
                </div>
            </td>
            <td class="p-3.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-slate-800 block">⚡ ${escapeHtml(item.service || '-')}</span>
                    ${isEmergencyOrder ? `<span class="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse shadow-sm"><i class="fa-solid fa-triangle-exclamation"></i> 🚨 १०-MIN SOS</span>` : ''}
                </div>
                ${isEmergencyOrder ? `
                <div class="flex items-center gap-1 mt-1">
                    <span class="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">₹50 Admin Paid</span>
                    <span class="bg-amber-400 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">+₹30 Worker Bonus</span>
                </div>` : ''}
                <span class="text-slate-500 text-[11px] block truncate max-w-[180px]" title="${escapeHtml(item.address)}">${escapeHtml(item.area || 'Pune')} - ${escapeHtml(item.address || '')}</span>
            </td>
            <td class="p-3.5">
                <span class="font-black text-emerald-600">${escapeHtml(item.budget || '₹500')}</span>
                ${isEmergencyOrder && item.advancePaidToAdmin ? `<span class="block text-[10px] text-emerald-600 font-bold mt-0.5">(₹${item.advancePaidToAdmin} ॲडव्हान्स प्राप्त)</span>` : ''}
            </td>
            <td class="p-3.5">
                ${workerDisplay}
            </td>
            <td class="p-3.5">
                <div class="flex items-center gap-1 flex-wrap">
                    <span class="admin-badge ${statusBadgeClass}">${escapeHtml(item.status || 'Pending')}</span>
                    ${isSos ? `<span class="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-sm animate-pulse" title="गेल्या ${elapsedMins} मिनिटांपासून प्रलंबित (इमर्जन्सी डिस्पॅच आवश्यक)"><i class="fa-solid fa-triangle-exclamation"></i> SOS (${elapsedMins} मि.)</span>` : ''}
                </div>
                ${item.completionOtp ? `<span class="text-[10px] text-slate-400 block mt-0.5">OTP: <strong>${item.completionOtp}</strong></span>` : ''}
            </td>
            <td class="p-3.5 text-center">
                <div class="flex items-center justify-center gap-1.5 flex-wrap">
                    ${item.status === 'Pending' ? `
                    <button onclick="openForceAssignModal('${item.id}')" title="कामगार थेट असाइन करा" class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black py-1.5 px-2.5 rounded-lg text-xs transition border border-amber-400 inline-flex items-center gap-1 shadow-sm cursor-pointer whitespace-nowrap active:scale-95">
                        <i class="fa-solid fa-bolt text-xs"></i> ⚡ Force Assign
                    </button>
                    ` : ''}
                    <button onclick="openAdminOrderModal('${item.id}')" title="सविस्तर माहिती पहा" class="bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-1.5 px-2.5 rounded-lg text-xs transition border border-blue-200">
                        माहिती
                    </button>
                    <button onclick="downloadOrderInvoice('${item.id}')" title="ब्रँडेड टॅक्स इनव्हॉइस / बिल डाऊनलोड किंवा प्रिंट करा" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-1.5 px-2.5 rounded-lg text-xs transition border border-emerald-300 inline-flex items-center gap-1 shadow-sm">
                        <i class="fa-solid fa-file-invoice-dollar text-[11px]"></i> बिल
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}


// --- 7. Workers Table & Management ---

function filterWorkersTable() {
    renderWorkersTable();
}

function renderWorkersTable() {
    const tbody = document.getElementById('workersTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('workerSearchInput')?.value || '').toLowerCase().trim();
    const dutyFilter = document.getElementById('workerDutyFilter')?.value || 'ALL';
    const kycFilter = document.getElementById('workerKycFilter')?.value || 'ALL';

    const workerMap = new Map();

    // 1. Process workers under workers/accounts/workers
    if (allWorkers && allWorkers.accounts && allWorkers.accounts.workers) {
        Object.entries(allWorkers.accounts.workers).forEach(([mob, acc]) => {
            if (!acc || typeof acc !== 'object') return;
            const uid = 'local_worker_' + mob;
            workerMap.set(uid, {
                uid,
                name: acc.fullName || acc.name || 'Worker',
                mobile: mob,
                service: acc.workType || acc.service || 'Cleaning',
                area: acc.area || 'Pune',
                wallet: acc.balance !== undefined ? acc.balance : (acc.wallet !== undefined ? acc.wallet : 50),
                isDutyOn: Boolean(acc.isDutyOn || acc.dutyStatus === 'ON'),
                activeOrderId: acc.activeOrderId || null,
                ratings: acc.ratings || {},
                photo: acc.photo || acc.photoUrl || null,
                aadharCardPhoto: acc.aadharCardPhoto || acc.aadharCardUrl || null,
                verificationStatus: acc.verificationStatus || 'approved',
                kycSubmittedAt: acc.kycSubmittedAt || null,
                kycRejectReason: acc.kycRejectReason || null
            });
        });
    }

    // 2. Process all direct worker nodes under workers/* (ignoring 'accounts')
    if (allWorkers) {
        Object.entries(allWorkers).forEach(([uid, w]) => {
            if (uid === 'accounts' || !w || typeof w !== 'object') return;
            const u = allUsers[uid] || {};
            const mob = w.mobile || u.mobile || (uid.startsWith('local_worker_') ? uid.replace('local_worker_', '') : '-');

            const existing = workerMap.get(uid) || (mob && mob !== '-' ? Array.from(workerMap.values()).find(x => x.mobile === mob) : null);

            const merged = {
                uid,
                name: w.name || w.fullName || (existing && existing.name) || u.fullName || u.name || 'Worker',
                mobile: mob,
                service: w.service || w.workType || (existing && existing.service) || u.service || u.workType || 'Cleaning',
                area: w.area || (existing && existing.area) || 'Pune',
                wallet: w.wallet !== undefined ? w.wallet : (existing ? existing.wallet : 50),
                isDutyOn: Boolean(w.isDutyOn || w.dutyStatus === 'ON' || w.activeOrderId || (existing && existing.isDutyOn)),
                activeOrderId: w.activeOrderId || (existing && existing.activeOrderId) || null,
                ratings: w.ratings || (existing && existing.ratings) || {},
                photo: w.photo || w.photoUrl || (existing && existing.photo) || u.photo || u.photoUrl || null,
                aadharCardPhoto: w.aadharCardPhoto || (existing && existing.aadharCardPhoto) || null,
                verificationStatus: w.verificationStatus || (existing && existing.verificationStatus) || 'approved',
                kycSubmittedAt: w.kycSubmittedAt || (existing && existing.kycSubmittedAt) || null,
                kycRejectReason: w.kycRejectReason || (existing && existing.kycRejectReason) || null
            };
            workerMap.set(uid, merged);
        });
    }

    const workerList = Array.from(workerMap.values());
    cachedWorkerList = workerList;

    const filtered = workerList.filter(item => {
        if (dutyFilter === 'ON' && !item.isDutyOn) return false;
        if (dutyFilter === 'OFF' && item.isDutyOn) return false;

        if (kycFilter !== 'ALL') {
            const vStatus = item.verificationStatus || 'approved';
            if (vStatus !== kycFilter) return false;
        }

        if (searchTerm) {
            const str = `${item.name} ${item.mobile} ${item.service} ${escapeHtml(item.area)}`.toLowerCase();
            if (!str.includes(searchTerm)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">एकही कामगार आढळला नाही.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const dutyBadge = item.isDutyOn
            ? `<span class="admin-badge bg-emerald-100 text-emerald-800 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Duty ON</span>`
            : `<span class="admin-badge bg-slate-100 text-slate-500">Duty OFF</span>`;

        let rCount = Object.keys(item.ratings).length;
        let rAvg = "5.0";
        if (rCount > 0) {
            let sum = 0;
            Object.values(item.ratings).forEach(r => sum += Number(r.rating || 5));
            rAvg = (sum / rCount).toFixed(1);
        }

        // KYC Status & Action Badge
        let kycBadge = '';
        const vStatus = item.verificationStatus || 'approved';
        if (vStatus === 'pending') {
            kycBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"><i class="fa-solid fa-hourglass-half"></i> प्रलंबित (Pending)</span>`;
        } else if (vStatus === 'rejected') {
            kycBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"><i class="fa-solid fa-circle-xmark"></i> नाकारले (Rejected)</span>`;
        } else {
            kycBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-circle-check"></i> मंजूर (Approved)</span>`;
        }

        const kycActionBtn = `
            <button type="button" onclick="openAdminWorkerKycModal('${item.uid}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-1 px-2.5 rounded-lg text-[11px] transition flex items-center gap-1 mt-1 cursor-pointer">
                <i class="fa-solid fa-id-card"></i> 🪪 KYC तपासा
            </button>
        `;

        return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-3.5">
                <div class="flex items-center gap-2">
                    ${item.photo ? `<img src="${item.photo}" class="w-8 h-8 rounded-full object-cover border border-amber-300 shadow-sm shrink-0">` : `<div class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border shrink-0"><i class="fa-solid fa-user"></i></div>`}
                    <div>
                        <strong class="text-slate-800 block">${escapeHtml(item.name)}</strong>
                        <span class="text-[10px] text-slate-400">ID: GK-${item.uid.slice(-6).toUpperCase()}</span>
                    </div>
                </div>
            </td>
            <td class="p-3.5">
                <a href="tel:${item.mobile}" class="text-blue-600 hover:underline font-bold text-xs"><i class="fa-solid fa-phone text-[10px]"></i> ${item.mobile}</a>
            </td>
            <td class="p-3.5">
                <span class="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md text-[11px]">${escapeHtml(item.service)}</span>
            </td>
            <td class="p-3.5 font-medium text-slate-600">
                ${escapeHtml(item.area)}
            </td>
            <td class="p-3.5">
                <span class="font-black ${item.wallet <= 20 ? 'text-rose-600' : 'text-emerald-600'}">₹${item.wallet}</span>
            </td>
            <td class="p-3.5">
                ${dutyBadge}
                ${item.activeOrderId ? `<span class="text-[10px] text-blue-600 block mt-0.5">काम सुरू आहे</span>` : ''}
            </td>
            <td class="p-3.5 font-bold text-amber-500">
                ⭐ ${rAvg} <span class="text-[10px] text-slate-400">(${rCount})</span>
            </td>
            <td class="p-3.5">
                ${kycBadge}
                ${kycActionBtn}
            </td>
            <td class="p-3.5 text-center">
                <button onclick="openAdminWalletModal('${item.uid}', '${item.name}', ${item.wallet})" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-1.5 px-3 rounded-lg text-xs transition">
                    + क्रेडिट्स द्या
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// =========================================================
// Worker KYC Verification Modal Controller
// =========================================================

function openAdminWorkerKycModal(uid) {
    selectedKycWorkerUid = uid;
    
    // Find worker from cachedWorkerList or allWorkers
    const worker = cachedWorkerList.find(w => w.uid === uid) || (allWorkers && allWorkers[uid]) || {};
    selectedKycWorkerMobile = worker.mobile || (uid.startsWith('local_worker_') ? uid.replace('local_worker_', '') : '');

    const nameEl = document.getElementById('adminKycWorkerName');
    const mobileEl = document.getElementById('adminKycWorkerMobile');
    const serviceEl = document.getElementById('adminKycWorkerService');
    const idEl = document.getElementById('adminKycWorkerId');
    const dateEl = document.getElementById('adminKycSubmissionDate');
    const badgeEl = document.getElementById('adminKycStatusBadge');
    const photoEl = document.getElementById('adminKycWorkerPhoto');
    const selfieEl = document.getElementById('adminKycSelfieImg');
    const noSelfieEl = document.getElementById('adminKycNoSelfie');
    const aadharEl = document.getElementById('adminKycaadharImg');
    const noAadharEl = document.getElementById('adminKycNoAadhar');
    const rejectBox = document.getElementById('adminKycRejectReasonBox');
    const rejectInput = document.getElementById('adminKycRejectReasonInput');
    const approveBtn = document.getElementById('adminKycApproveBtn');

    if (rejectBox) rejectBox.classList.add('hidden');
    if (rejectInput) rejectInput.value = worker.kycRejectReason || '';

    if (nameEl) nameEl.innerText = worker.name || 'Worker';
    if (mobileEl) {
        mobileEl.innerText = worker.mobile || '-';
        mobileEl.href = 'tel:' + worker.mobile;
    }
    if (serviceEl) serviceEl.innerText = worker.service || 'Cleaning';
    if (idEl) idEl.innerText = 'ID: GK-' + (uid.slice(-6).toUpperCase());

    if (dateEl) {
        if (worker.kycSubmittedAt) {
            const d = new Date(worker.kycSubmittedAt);
            dateEl.innerText = 'अर्ज तारीख: ' + d.toLocaleDateString('mr-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else {
            dateEl.innerText = 'अर्ज तारीख: उपलब्ध नाही';
        }
    }

    const status = worker.verificationStatus || 'approved';
    if (badgeEl) {
        if (status === 'approved') {
            badgeEl.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300';
            badgeEl.innerText = '✓ मंजूर (Approved)';
            if (approveBtn) approveBtn.innerHTML = '<i class="fa-solid fa-check text-sm"></i> <span>✓ आधीच मंजूर (Already Approved)</span>';
        } else if (status === 'rejected') {
            badgeEl.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-rose-100 text-rose-800 border-rose-300';
            badgeEl.innerText = '✕ नाकारले (Rejected)';
            if (approveBtn) approveBtn.innerHTML = '<i class="fa-solid fa-check text-sm"></i> <span>✓ पुनर्विचार करून मंजूर करा (Re-Approve)</span>';
        } else {
            badgeEl.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300 animate-pulse';
            badgeEl.innerText = '⏳ प्रलंबित (Pending Review)';
            if (approveBtn) approveBtn.innerHTML = '<i class="fa-solid fa-check text-sm"></i> <span>✓ मंजूर करा (Approve Worker)</span>';
        }
    }

    const workerPhoto = worker.photo || worker.photoUrl || null;
    if (photoEl) photoEl.src = workerPhoto || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231e293b'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23f59e0b'/%3E%3Cpath d='M14 54c0-9.94 8.06-18 18-18s18 8.06 18 18' fill='%23f59e0b'/%3E%3C/svg%3E";

    if (workerPhoto) {
        if (selfieEl) {
            selfieEl.src = workerPhoto;
            selfieEl.classList.remove('hidden');
        }
        if (noSelfieEl) noSelfieEl.classList.add('hidden');
    } else {
        if (selfieEl) selfieEl.classList.add('hidden');
        if (noSelfieEl) noSelfieEl.classList.remove('hidden');
    }

    const aadharPhoto = worker.aadharCardPhoto || null;
    selectedKycAadharPhotoUrl = aadharPhoto;
    if (aadharPhoto) {
        if (aadharEl) {
            aadharEl.src = aadharPhoto;
            aadharEl.classList.remove('hidden');
        }
        if (noAadharEl) noAadharEl.classList.add('hidden');
    } else {
        if (aadharEl) aadharEl.classList.add('hidden');
        if (noAadharEl) noAadharEl.classList.remove('hidden');
    }

    const modal = document.getElementById('adminWorkerKycModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAdminWorkerKycModal() {
    const modal = document.getElementById('adminWorkerKycModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    selectedKycWorkerUid = null;
    selectedKycWorkerMobile = null;
    selectedKycAadharPhotoUrl = null;
}

function toggleAdminRejectReasonBox() {
    const box = document.getElementById('adminKycRejectReasonBox');
    if (box) {
        box.classList.toggle('hidden');
        if (!box.classList.contains('hidden')) {
            document.getElementById('adminKycRejectReasonInput')?.focus();
        }
    }
}

function cancelAdminRejectKyc() {
    const box = document.getElementById('adminKycRejectReasonBox');
    if (box) box.classList.add('hidden');
}

async function confirmAdminApproveKyc() {
    if (!selectedKycWorkerUid) return;
    const workerMobile = selectedKycWorkerMobile;
    const confirmed = confirm("तुम्हाला खात्री आहे का? या कामगाराचे आधार कार्ड मंजूर करायचे आहे का?\n\nमंजूर झाल्यावर कामगार Duty ON करू शकेल आणि त्याला कामाच्या नोटिफिकेशन्स मिळतील.");
    if (!confirmed) return;

    try {
        const updateData = {
            verificationStatus: 'approved',
            kycVerifiedAt: firebase.database.ServerValue.TIMESTAMP,
            kycVerifiedBy: 'Admin',
            kycRejectReason: null
        };

        // 1. Update in workers/{uid}
        await database.ref('workers/' + selectedKycWorkerUid).update(updateData);

        // 2. Also update in workers/accounts/workers/{mobile}
        if (workerMobile) {
            await database.ref('workers/accounts/workers/' + workerMobile).update(updateData);
            await database.ref('workers/local_worker_' + workerMobile).update(updateData);
        }

        alert("✅ कामगार यशस्वीरीत्या मंजूर (Approved) झाला आहे! आता तो Duty ON करू शकतो.");
        closeAdminWorkerKycModal();
    } catch (err) {
        console.error("Approve error:", err);
        alert("त्रुटी आली: " + err.message);
    }
}

async function confirmAdminRejectKyc() {
    if (!selectedKycWorkerUid) return;
    const reasonInput = document.getElementById('adminKycRejectReasonInput');
    const reason = (reasonInput?.value || '').trim() || "आधार कार्डचा फोटो अस्पष्ट आहे. कृपया पुन्हा स्पष्ट फोटो अपलोड करा.";

    try {
        const updateData = {
            verificationStatus: 'rejected',
            kycVerifiedAt: firebase.database.ServerValue.TIMESTAMP,
            kycVerifiedBy: 'Admin',
            kycRejectReason: reason,
            isDutyOn: false,
            dutyStatus: 'OFF'
        };

        // 1. Update in workers/{uid}
        await database.ref('workers/' + selectedKycWorkerUid).update(updateData);

        // 2. Also update in workers/accounts/workers/{mobile}
        if (selectedKycWorkerMobile) {
            await database.ref('workers/accounts/workers/' + selectedKycWorkerMobile).update(updateData);
            await database.ref('workers/local_worker_' + selectedKycWorkerMobile).update(updateData);
        }

        alert("❌ कामगाराचे KYC नाकारले (Rejected). कामगाराच्या ॲपमध्ये पुन्हा फोटो अपलोड करण्याचा मेसेज दिसेल.");
        closeAdminWorkerKycModal();
    } catch (err) {
        console.error("Reject error:", err);
        alert("त्रुटी आली: " + err.message);
    }
}

function zoomCurrentAadhaar() {
    if (selectedKycAadharPhotoUrl) {
        openAdminZoomModal(selectedKycAadharPhotoUrl, 'आधार कार्ड फोटो (Aadhaar Card)');
    } else {
        alert("आधार कार्डचा फोटो उपलब्ध नाही.");
    }
}

function openAdminZoomModal(imgUrl, caption = '') {
    if (!imgUrl) return;
    const modal = document.getElementById('adminZoomModal');
    const img = document.getElementById('adminZoomModalImg');
    const cap = document.getElementById('adminZoomModalCaption');
    if (img) img.src = imgUrl;
    if (cap) cap.innerText = caption;
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAdminZoomModal() {
    const modal = document.getElementById('adminZoomModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// --- 8. Reviews & Complaints List ---

function filterReviewsList() {
    renderReviewsList();
}

function renderReviewsList() {
    const container = document.getElementById('reviewsListContainer');
    if (!container) return;

    const filter = document.getElementById('reviewRatingFilter')?.value || 'ALL';

    let filtered = [...allReviews];
    if (filter === 'COMPLAINTS') {
        filtered = filtered.filter(r => r.rating <= 2);
    } else if (filter !== 'ALL') {
        const stars = Number(filter);
        filtered = filtered.filter(r => r.rating === stars);
    }

    // Sort newest first
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-center py-10 text-slate-400 text-xs">कोणतेही रिव्ह्यूज सापडले नाहीत.</p>`;
        return;
    }

    container.innerHTML = filtered.map(r => {
        const isComplaint = r.rating <= 2;
        const dateStr = new Date(r.timestamp).toLocaleDateString('mr-IN', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const customerPhoneHtml = r.customerMobile ? `
            <span class="text-slate-400">•</span>
            <a href="tel:${r.customerMobile}" class="text-blue-600 hover:underline font-semibold flex items-center gap-1">
                <i class="fa-solid fa-phone text-[10px]"></i> ${r.customerMobile}
            </a>
            <a href="https://wa.me/91${r.customerMobile.replace(/\D/g, '')}" target="_blank" class="text-emerald-600 hover:underline font-semibold flex items-center gap-1">
                <i class="fa-brands fa-whatsapp text-xs"></i> WhatsApp
            </a>
        ` : '';

        const orderBadgeHtml = r.orderId ? `
            <button onclick="openAdminOrderModal('${r.orderId}')" class="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-md transition flex items-center gap-1">
                <i class="fa-solid fa-receipt text-[9px]"></i> Order: #${String(r.orderId).slice(-6)}
            </button>
        ` : '';

        const serviceBadgeHtml = r.service ? `
            <span class="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">
                ${r.service}
            </span>
        ` : '';

        return `
        <div class="bg-white p-4 rounded-2xl border ${isComplaint ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'} shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <i class="fa-solid fa-user text-blue-600"></i> ${escapeHtml(r.customerName)}
                    </span>
                    ${customerPhoneHtml}
                    ${serviceBadgeHtml}
                    ${orderBadgeHtml}
                </div>
                <div class="flex items-center gap-2">
                    ${isComplaint ? `<span class="admin-badge bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">⚠️ तक्रार / Negative</span>` : `<span class="admin-badge bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">✅ Positive</span>`}
                    <span class="text-amber-400 font-bold ml-1 text-base tracking-wider">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                    <span class="text-xs font-black text-slate-700 bg-amber-100 px-1.5 py-0.5 rounded">${r.rating}.0</span>
                </div>
            </div>

            <!-- ग्राहकाचा अभिप्राय मेसेज (Customer Review Message - Only Admin Can See) -->
            <div class="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <i class="fa-solid fa-comment-dots text-blue-500"></i> ग्राहकाचा अभिप्राय / Customer Review Message:
                </div>
                <p class="text-xs text-slate-800 font-medium whitespace-pre-wrap ${r.review && r.review !== 'काही कॉमेंट नाही' && r.review !== 'काही मेसेज नाही' ? 'italic' : 'text-slate-400'}">
                    "${r.review || 'काही कॉमेंट लिहिली नाही'}"
                </p>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 flex-wrap gap-2">
                <div>
                    कामगार: <strong class="text-slate-700 font-bold">${r.workerName}</strong>
                    ${r.workerMobile ? `<span class="text-slate-400 ml-1">(${r.workerMobile})</span>` : ''}
                </div>
                <div class="text-slate-400 flex items-center gap-1">
                    <i class="fa-regular fa-clock"></i> तारीख: ${dateStr}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// --- 9. Admin Order Details Modal & Emergency Actions ---

function openAdminOrderModal(orderId) {
    selectedOrderForModal = orderId;
    const order = allOrders[orderId];
    if (!order) return;

    document.getElementById('modalOrderId').innerText = `ID: #${orderId}`;
    const container = document.getElementById('modalOrderDetails');

    const photoHtml = (order.photoUrl || order.imageUrl)
        ? `<div class="mt-2"><img src="${order.photoUrl || order.imageUrl}" class="w-full h-36 object-cover rounded-xl border"></div>`
        : '';

    const voiceHtml = (order.voiceNoteUrl || order.hasVoiceNote)
        ? `<div class="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
            <p class="text-xs font-bold text-emerald-900 flex items-center gap-1.5"><i class="fa-solid fa-microphone text-emerald-600"></i> ग्राहक व्हॉइस मेसेज (Customer Voice Note):</p>
            <audio controls controlsList="nodownload" preload="metadata" class="w-full h-8 rounded-lg bg-white border border-emerald-200" src="${order.voiceNoteUrl}">
                ऑडिओ उपलब्ध नाही.
            </audio>
           </div>`
        : '';

    const isEmergency = Boolean(order.isEmergency || order.orderType === 'emergency_sos');
    const emergencyInfoHtml = isEmergency ? `
        <div class="p-3 rounded-xl bg-red-50 border-2 border-red-500 mb-3 space-y-1">
            <div class="flex items-center justify-between">
                <span class="text-xs font-black text-red-700 uppercase flex items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation animate-pulse text-sm"></i> 🚨 १०-मिनिट इमर्जन्सी SOS ऑर्डर</span>
                <span class="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">PRIORITY SOS</span>
            </div>
            <div class="text-[11px] text-slate-700 flex flex-wrap gap-2 pt-1 font-semibold">
                <span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">💰 ॲडमिन ॲडव्हान्स: ₹${order.advancePaidToAdmin || 50} (Razorpay: ${order.paymentId || 'Paid'})</span>
                <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">🎁 कारागीर पूर्णता बोनस: ₹${order.emergencyBonusToWorker || 30}</span>
            </div>
        </div>
    ` : '';

    container.innerHTML = `
        ${emergencyInfoHtml}
        <div class="grid grid-cols-2 gap-2 pb-2 border-b">
            <p><strong>ग्राहक नाव:</strong> ${order.customerName || '-'}</p>
            <p><strong>मोबाईल:</strong> <a href="tel:${order.customerMobile}" class="text-blue-600 font-bold">${order.customerMobile || '-'}</a></p>
            <p><strong>ईमेल:</strong> ${order.customerEmail || 'नोंदणी नाही'}</p>
            <p><strong>बजेट:</strong> <span class="text-emerald-600 font-bold">${order.budget || '-'}</span></p>
        </div>
        <div class="pt-2 space-y-1">
            <p><strong>सेवा:</strong> ⚡ ${order.service || '-'}</p>
            <p><strong>पत्ता:</strong> ${order.area || ''} - ${order.address || '-'}</p>
            <p><strong>तारीख व वेळ:</strong> ${order.date || ''} ${order.time || ''}</p>
            <p><strong>सध्याचे स्टेटस:</strong> <span class="font-bold text-blue-600">${order.status || 'Pending'}</span></p>
            <p><strong>नेमलेला कामगार:</strong> ${order.workerMobile || order.workerUid || 'अजून नेमला नाही'}</p>
            ${order.completionOtp ? `<p><strong>Work OTP:</strong> <strong class="text-emerald-600 font-black text-sm">${order.completionOtp}</strong></p>` : ''}
        </div>
        ${voiceHtml}
        ${photoHtml}
        <div class="pt-2 flex flex-wrap gap-2">
            <a href="https://maps.google.com/?q=${encodeURIComponent(order.address || order.area || 'Pune')}" target="_blank" class="bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs px-3 py-1.5 rounded-lg border border-blue-200 inline-flex items-center gap-1">
                <i class="fa-solid fa-map-location-dot"></i> Google Maps
            </a>
            ${order.customerMobile ? `
            <a href="https://wa.me/91${String(order.customerMobile).replace(/[^0-9]/g,'').slice(-10)}?text=${encodeURIComponent('नमस्कार ' + (order.customerName || '') + ', घरमित्र (Gharmitra) कडून आपल्या ऑर्डर #' + orderId.slice(-6).toUpperCase() + ' बाबत: आपली ' + (order.service || 'काम') + ' सेवा सध्या ' + (order.status || 'Pending') + ' आहे. काही अडचण असल्यास संपर्क साधा.')}" target="_blank" class="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-300 inline-flex items-center gap-1">
                <i class="fa-brands fa-whatsapp text-emerald-600"></i> ग्राहक WhatsApp
            </a>` : ''}
            ${order.workerMobile ? `
            <a href="https://wa.me/91${String(order.workerMobile).replace(/[^0-9]/g,'').slice(-10)}?text=${encodeURIComponent('घरमित्र ॲडमिन अलर्ट: ऑर्डर #' + orderId.slice(-6).toUpperCase() + ' साठी ग्राहक: ' + (order.customerName || '') + ' (' + (order.customerMobile || '') + '), पत्ता: ' + (order.address || order.area || 'Pune') + '. त्वरित सेवा द्या.')}" target="_blank" class="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-300 inline-flex items-center gap-1">
                <i class="fa-brands fa-whatsapp text-emerald-600"></i> कामगार WhatsApp
            </a>` : ''}
        </div>
    `;

    const forceBox = document.getElementById('modalForceAssignBtnBox');
    if (forceBox) {
        if (order.status === 'Completed' || order.status === 'Cancelled') {
            forceBox.classList.add('hidden');
        } else {
            forceBox.classList.remove('hidden');
        }
    }

    document.getElementById('adminOrderModal')?.classList.remove('hidden');
    document.getElementById('adminOrderModal')?.classList.add('flex');
}

function closeAdminOrderModal() {
    document.getElementById('adminOrderModal')?.classList.remove('flex');
    document.getElementById('adminOrderModal')?.classList.add('hidden');
    selectedOrderForModal = null;
}

function adminMarkOrderCompleted() {
    if (!selectedOrderForModal) return;
    if (!confirm("तुम्हाला खात्री आहे की ही ऑर्डर पूर्ण (Completed) करायची आहे?")) return;

    database.ref("orders/" + selectedOrderForModal).update({
        status: "Completed",
        workerLocation: null,
        completedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("ऑर्डर पूर्ण केली!");
        closeAdminOrderModal();
    });
}

function adminCancelOrder() {
    if (!selectedOrderForModal) return;
    if (!confirm("तुम्हाला खात्री आहे की ही ऑर्डर रद्द (Cancelled) करायची आहे?")) return;

    database.ref("orders/" + selectedOrderForModal).update({
        status: "Cancelled",
        cancelledAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("ऑर्डर रद्द केली!");
        closeAdminOrderModal();
    });
}

// --- 10. Worker Wallet Recharge Modal ---

function openAdminWalletModal(uid, name, curBal) {
    selectedWorkerForRecharge = uid;
    document.getElementById('walletWorkerName').innerText = `${name} - सर्व्हिस क्रेडिट्स`;
    document.getElementById('walletCurrentBal').innerText = curBal;
    document.getElementById('walletRechargeAmount').value = '';

    document.getElementById('adminWalletModal')?.classList.remove('hidden');
    document.getElementById('adminWalletModal')?.classList.add('flex');
    setTimeout(() => document.getElementById('walletRechargeAmount')?.focus(), 150);
}

function closeAdminWalletModal() {
    document.getElementById('adminWalletModal')?.classList.remove('flex');
    document.getElementById('adminWalletModal')?.classList.add('hidden');
    selectedWorkerForRecharge = null;
}

function submitWorkerWalletRecharge() {
    if (!selectedWorkerForRecharge) return;
    const amount = parseInt(document.getElementById('walletRechargeAmount').value);
    if (isNaN(amount) || amount <= 0) {
        alert("कृपया वैध रक्कम टाका.");
        return;
    }

    const workerMobile = String(selectedWorkerForRecharge).replace(/\D/g, '').slice(-10);

    const applyFirebaseRecharge = async () => {
        try {
            // Read current balance from local_worker node
            const snap = await database.ref("workers/local_worker_" + workerMobile).once('value');
            const wData = snap.val() || {};
            const curBal = Number(wData.wallet !== undefined ? wData.wallet : (wData.walletBalance !== undefined ? wData.walletBalance : (wData.balance || 0)));
            const newBal = Math.max(0, curBal + amount);

            const updatePayload = {
                wallet: newBal,
                walletBalance: newBal,
                balance: newBal,
                lastRechargeAt: firebase.database.ServerValue.TIMESTAMP,
                lastRechargeAmount: amount
            };

            // Write to all worker nodes simultaneously (including direct leaf nodes for instant zero-latency trigger)
            const writes = [
                database.ref("workers/local_worker_" + workerMobile).update(updatePayload),
                database.ref("workers/accounts/workers/" + workerMobile).update(updatePayload),
                database.ref("workers/local_worker_" + workerMobile + "/wallet").set(newBal),
                database.ref("workers/accounts/workers/" + workerMobile + "/wallet").set(newBal)
            ];

            if (selectedWorkerForRecharge && selectedWorkerForRecharge !== ("local_worker_" + workerMobile)) {
                writes.push(database.ref("workers/" + selectedWorkerForRecharge).update(updatePayload).catch(() => {}));
                writes.push(database.ref("workers/" + selectedWorkerForRecharge + "/wallet").set(newBal).catch(() => {}));
            }

            // Write transaction record
            const txData = {
                type: 'CREDIT',
                amount: amount,
                balanceAfter: newBal,
                reason: 'ॲडमिन कडून वॉलेट रिचार्ज',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            writes.push(database.ref('walletTransactions/local_worker_' + workerMobile).push(txData));
            if (selectedWorkerForRecharge && selectedWorkerForRecharge !== ("local_worker_" + workerMobile)) {
                writes.push(database.ref('walletTransactions/' + selectedWorkerForRecharge).push(txData).catch(() => {}));
            }

            await Promise.all(writes);

            // Instant BroadcastChannel message across tabs/windows without reloading
            try {
                if ('BroadcastChannel' in window) {
                    const bc = new BroadcastChannel('gharmitra_wallet_channel');
                    bc.postMessage({ mobile: workerMobile, wallet: newBal, amount: amount, timestamp: Date.now() });
                    bc.close();
                }
            } catch(e) {}

            // Cross-tab storage sync
            try {
                localStorage.setItem('gharmitra_wallet_sync', JSON.stringify({ mobile: workerMobile, wallet: newBal, amount: amount, timestamp: Date.now() }));
                const s = JSON.parse(localStorage.getItem('current_user_session') || '{}');
                const sMob = String(s.mobile || '').replace(/\D/g, '').slice(-10);
                if (sMob === workerMobile) {
                    s.wallet = newBal;
                    s.balance = newBal;
                    localStorage.setItem('current_user_session', JSON.stringify(s));
                }
            } catch(e) {}

            alert(`₹${amount} यशस्वीरीत्या कामगाराच्या वॉलेटमध्ये जमा केले! नवीन शिल्लक: ₹${newBal}`);
            closeAdminWalletModal();
            if (typeof renderWorkersTable === 'function') renderWorkersTable();
        } catch (err) {
            console.error("Recharge failed:", err);
            alert("पैसे जमा करताना अडचण आली: " + err.message);
        }
    };

    if (ADMIN_API_BASE) {
        const tokenStr = sessionStorage.getItem('gharmitra_admin_token') || localStorage.getItem('gharmitra_auth_token');
        const headers = { 'Content-Type': 'application/json' };
        if (tokenStr) headers['Authorization'] = `Bearer ${tokenStr}`;

        fetch(`${ADMIN_API_BASE}/api/admin/recharge-worker`, {
            method: 'POST',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({
                workerMobile: workerMobile,
                amount: amount,
                reason: 'Super Admin Manual Recharge'
            })
        }).then(r => r.json()).then(() => {
            applyFirebaseRecharge();
        }).catch(() => {
            applyFirebaseRecharge();
        });
    } else {
        applyFirebaseRecharge();
    }
}

// =========================================================
// 11. Branded GST Tax Invoice / Bill Generator Logic
// =========================================================

let currentInvoiceOrder = null;

function convertAmountToWords(amount) {
    const num = Math.round(Number(amount) || 0);
    if (num <= 0) return "शून्य रुपये फक्त / Zero Rupees Only";

    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(n) {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
        return String(n);
    }

    return inWords(num).trim() + ' Rupees Only';
}

function downloadOrderInvoice(orderId) {
    if (!orderId) return;
    const order = allOrders[orderId];
    if (!order) {
        alert("ऑर्डर सापडली नाही!");
        return;
    }

    currentInvoiceOrder = { id: orderId, ...order };

    // Resolve worker info
    let workerName = order.workerName || '';
    let workerMobile = order.workerMobile || '';
    if (order.workerUid && (!workerName || !workerMobile)) {
        const w = allWorkers[order.workerUid] || {};
        const u = allUsers[order.workerUid] || {};
        if (!workerName) workerName = w.name || u.fullName || u.name || '';
        if (!workerMobile) workerMobile = w.mobile || u.mobile || '';
    }
    if (!workerName) workerName = workerMobile ? `कारागीर (${workerMobile})` : 'अधिकृत सेवा कारागीर (Assigned Partner)';
    if (!workerMobile) workerMobile = 'नोंदणीकृत कारागीर';

    const cleanOrderId = String(orderId).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    const orderYear = order.timestamp ? new Date(Number(order.timestamp)).getFullYear() : 2026;
    const invoiceNo = `GM-INV-${orderYear}-${cleanOrderId}`;

    const orderDate = order.timestamp
        ? new Date(Number(order.timestamp)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : (order.date ? `${order.date} ${order.time || ''}` : new Date().toLocaleDateString('en-IN'));

    const rawBudget = parseInt(String(order.budget || '').replace(/[^0-9]/g, '')) || 500;
    const baseAmount = Math.round(rawBudget / 1.18);
    const totalGst = rawBudget - baseAmount;
    const cgst = Math.round(totalGst / 2);
    const sgst = totalGst - cgst;
    const amountInWords = convertAmountToWords(rawBudget);

    const isCompleted = order.status === 'Completed';
    const statusText = isCompleted ? 'PAID & COMPLETED' : (order.status || 'BOOKED');
    const statusColorClass = isCompleted 
        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
        : 'bg-blue-50 text-blue-800 border-blue-300';

    const customerName = escapeHtml(order.customerName || 'सन्माननीय ग्राहक');
    const customerMobile = escapeHtml(order.customerMobile || '-');
    const customerEmail = escapeHtml(order.customerEmail || 'support@gharmitra.online');
    const customerAddress = escapeHtml(order.address || order.area || 'Pune City');
    const serviceName = escapeHtml(order.service || 'Home Service & Maintenance');
    const areaName = escapeHtml(order.area || 'Pune');

    const invoiceContainer = document.getElementById('printableInvoiceArea');
    if (!invoiceContainer) return;

    invoiceContainer.innerHTML = `
        <!-- Official Gharmitra Invoice Header -->
        <div class="border-b-2 border-slate-900 pb-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="bg-blue-600 text-white font-black text-sm px-2.5 py-1 rounded-lg shadow-sm">🏠 GK</span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">GHARMITRA HOME SERVICES</h2>
                    </div>
                    <p class="text-xs font-bold text-blue-700">घरमित्र - पुणेकरांचा विश्वासू ऑन-डिमांड घरकाम साथी</p>
                    <p class="text-[11px] text-slate-500">Govt. of India MSME Reg.: <strong class="text-slate-700">UDYAM-MH-26-0098412</strong> | GSTIN: <strong class="text-slate-700">27AAECG4821M1ZX</strong></p>
                    <p class="text-[11px] text-slate-500">पत्ता: B-402, Gharmitra Hub, Baner-Pashan Link Road, Pune - 411045, Maharashtra</p>
                    <p class="text-[11px] text-slate-500">हेल्पलाईन: <strong>+91 7875160724</strong> | ईमेल: contact@gharmitra.online | www.gharmitra.online</p>
                </div>

                <div class="sm:text-right shrink-0">
                    <span class="inline-block bg-slate-900 text-white font-black text-xs px-3 py-1 rounded-lg tracking-wider uppercase mb-1">
                        TAX INVOICE / बिल
                    </span>
                    <h3 class="text-sm font-black text-slate-800">#${invoiceNo}</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">जारी तारीख: <strong class="text-slate-700">${orderDate}</strong></p>
                    <div class="mt-2">
                        <span class="inline-flex items-center gap-1 border ${statusColorClass} text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            ${isCompleted ? '✓ ' : ''}${statusText}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bill To & Worker Two-Column Information -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 text-xs">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-1 mb-1">
                    बिल कोणाच्या नावे (Billed To - Customer):
                </span>
                <p class="font-black text-slate-900 text-sm">${customerName}</p>
                <p class="text-slate-600"><strong>मोबाईल:</strong> +91 ${customerMobile}</p>
                <p class="text-slate-600"><strong>ईमेल:</strong> ${customerEmail}</p>
                <p class="text-slate-600"><strong>कामाचा पत्ता:</strong> ${customerAddress} (${areaName}, Pune)</p>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-1 mb-1">
                    अधिकृत सेवा कारागीर (Service Partner):
                </span>
                <p class="font-black text-slate-900 text-sm">${escapeHtml(workerName)}</p>
                <p class="text-slate-600"><strong>मोबाईल:</strong> ${escapeHtml(workerMobile)}</p>
                <p class="text-slate-600"><strong>कौशल्य:</strong> ⚡ ${serviceName}</p>
                <p class="text-emerald-700 font-bold flex items-center gap-1 pt-0.5">
                    <i class="fa-solid fa-shield-halved text-[10px]"></i> 100% आधार व पोलीस व्हेरिफाइड पार्टनर
                </p>
            </div>
        </div>

        <!-- Itemized Breakdown Table -->
        <div class="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                        <th class="p-3 w-10 text-center">क्र.</th>
                        <th class="p-3">सेवेचा तपशील (Description of Service)</th>
                        <th class="p-3 text-center">SAC कोड</th>
                        <th class="p-3 text-right">मूळ रक्कम</th>
                        <th class="p-3 text-right">जीएसटी (18%)</th>
                        <th class="p-3 text-right">एकूण (₹)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                    <tr>
                        <td class="p-3 text-center font-bold">1</td>
                        <td class="p-3">
                            <strong class="text-slate-900 block font-bold text-xs">${serviceName} Service Charges</strong>
                            <span class="text-[11px] text-slate-500">पुणे परिसर - घरगुती दुरुस्ती व व्यावसायिक कारागीर सेवा (On-Site Labor & Service)</span>
                        </td>
                        <td class="p-3 text-center font-mono text-slate-500">998714</td>
                        <td class="p-3 text-right font-mono">₹${baseAmount.toLocaleString('en-IN')}</td>
                        <td class="p-3 text-right font-mono">₹${totalGst.toLocaleString('en-IN')}</td>
                        <td class="p-3 text-right font-black text-slate-900 font-mono">₹${rawBudget.toLocaleString('en-IN')}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Calculation Subtotals -->
        <div class="flex flex-col sm:flex-row justify-between items-start gap-4 pt-1">
            <div class="text-xs space-y-1 sm:max-w-xs">
                <p class="font-bold text-slate-800">अक्षरी रक्कम (Amount in Words):</p>
                <p class="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] font-medium leading-relaxed">
                    ${amountInWords} (अक्षरी: ₹${rawBudget} रुपये फक्त)
                </p>
                <div class="pt-2 text-[11px] text-slate-500 space-y-0.5">
                    <p><strong>पेमेंट पद्धत:</strong> Cash / Instant UPI Direct</p>
                    <p><strong>पेमेंट स्टेटस:</strong> ${isCompleted ? 'यशस्वीरीत्या भरणा पूर्ण (Payment Settled)' : 'कामाच्या वेळी देय (Payable on Work Completion)'}</p>
                </div>
            </div>

            <div class="w-full sm:w-64 space-y-1.5 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div class="flex justify-between text-slate-600">
                    <span>मूळ सेवा आकार (Base Rate):</span>
                    <span class="font-mono">₹${baseAmount.toLocaleString('en-IN')}</span>
                </div>
                <div class="flex justify-between text-slate-500 text-[11px]">
                    <span>CGST (9%):</span>
                    <span class="font-mono">₹${cgst.toLocaleString('en-IN')}</span>
                </div>
                <div class="flex justify-between text-slate-500 text-[11px]">
                    <span>SGST (9%):</span>
                    <span class="font-mono">₹${sgst.toLocaleString('en-IN')}</span>
                </div>
                <div class="flex justify-between text-slate-500 text-[11px]">
                    <span>सुरक्षा व प्लॅटफॉर्म फी:</span>
                    <span class="text-emerald-600 font-bold">मोफत / Free</span>
                </div>
                <div class="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-300">
                    <span>एकूण देय रक्कम:</span>
                    <span class="font-mono text-emerald-600">₹${rawBudget.toLocaleString('en-IN')}</span>
                </div>
            </div>
        </div>

        <!-- Guarantee Badge, Official Seal & Signatures -->
        <div class="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between items-center gap-6">
            
            <!-- 7-Day Guarantee Badge -->
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl shrink-0">
                    <i class="fa-solid fa-award"></i>
                </div>
                <div class="text-xs">
                    <h5 class="font-black text-slate-800">७ दिवसांची मोफत सर्व्हिस हमी</h5>
                    <p class="text-[11px] text-slate-500">कामात काही अडचण आल्यास ७ दिवसांच्या आत मोफत रि-सर्व्हिस उपलब्ध.</p>
                </div>
            </div>

            <!-- Official Stamp & Signature Block -->
            <div class="flex items-center gap-4 text-center">
                <!-- Circular Verified Stamp -->
                <div class="w-20 h-20 rounded-full border-2 border-dashed border-emerald-600 text-emerald-700 flex flex-col items-center justify-center p-1 text-[8px] font-black uppercase tracking-tighter leading-tight rotate-[-6deg] opacity-90 shrink-0">
                    <span>★ GHARMITRA ★</span>
                    <span class="text-[9px] font-black">VERIFIED</span>
                    <span>PUNE CITY</span>
                    <span>OFFICIAL SEAL</span>
                </div>

                <div class="space-y-1">
                    <div class="font-serif italic font-bold text-sm text-slate-800 tracking-wider">Gharmitra Pune</div>
                    <div class="border-t border-slate-400 w-32 mx-auto pt-0.5 text-[10px] font-bold text-slate-600 uppercase">
                        Authorized Signatory
                    </div>
                    <p class="text-[9px] text-slate-400">Operations Head, Pune</p>
                </div>
            </div>
        </div>

        <!-- Terms Footer -->
        <div class="border-t border-slate-100 pt-3 text-[10px] text-slate-400 text-center space-y-0.5">
            <p>हा संगणक-निर्मित अधिकृत टॅक्स इनव्हॉइस आहे. यावर वेगळ्या स्वाक्षरीची आवश्यकता नाही.</p>
            <p>&copy; 2026 Gharmitra Home Services, Pune City • Helpline: 7875160724 • Secured Operations</p>
        </div>
    `;

    const subtitleEl = document.getElementById('invoiceHeaderSubtitle');
    if (subtitleEl) subtitleEl.innerText = `ऑर्डर #${cleanOrderId} • ${customerName}`;

    document.getElementById('adminInvoiceModal')?.classList.remove('hidden');
    document.getElementById('adminInvoiceModal')?.classList.add('flex');
}

function closeAdminInvoiceModal() {
    document.getElementById('adminInvoiceModal')?.classList.remove('flex');
    document.getElementById('adminInvoiceModal')?.classList.add('hidden');
    currentInvoiceOrder = null;
}

function printAdminInvoice() {
    window.print();
}

function shareInvoiceOnWhatsApp() {
    if (!currentInvoiceOrder) return;
    const cleanMobile = String(currentInvoiceOrder.customerMobile || '').replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length !== 10) {
        alert("ग्राहकाचा वैध मोबाईल नंबर उपलब्ध नाही.");
        return;
    }

    const cleanOrderId = String(currentInvoiceOrder.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    const customerName = currentInvoiceOrder.customerName || 'ग्राहक';
    const serviceName = currentInvoiceOrder.service || 'होम सर्व्हिस';
    const amount = currentInvoiceOrder.budget || '₹500';

    const text = `*घरमित्र अधिकृत टॅक्स इनव्हॉइस (Gharmitra Invoice)* 🧾\n\n` +
        `नमस्कार *${customerName}* जी,\n` +
        `आपल्या घरमित्र सेवेचे अधिकृत बिल तपशील खालीलप्रमाणे आहेत:\n\n` +
        `📦 *ऑर्डर आयडी:* #${cleanOrderId}\n` +
        `⚡ *सेवा:* ${serviceName}\n` +
        `📍 *पत्ता:* ${currentInvoiceOrder.address || currentInvoiceOrder.area || 'Pune'}\n` +
        `💰 *एकूण रक्कम:* ${amount}\n` +
        `🛡️ *हमी:* ७ दिवसांची मोफत सर्व्हिस हमी (Gharmitra Guarantee)\n\n` +
        `धन्यवाद! घरमित्र होम सर्व्हिसेस, पुणे.\n` +
        `📞 हेल्पलाईन: 7875160724\n` +
        `🌐 www.gharmitra.online`;

    const waUrl = `https://wa.me/91${cleanMobile}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
}

// =========================================================
// 🚨 फ्रॉड व क्वालिटी अलर्ट शिल्ड (Low-Rating & Dispute Shield)
// =========================================================

function loadLocalQualityResolutions() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('gharmitra_resolved_')) {
                const alertId = key.replace('gharmitra_resolved_', '');
                if (!allQualityResolutions[alertId]) {
                    allQualityResolutions[alertId] = JSON.parse(localStorage.getItem(key) || '{}');
                }
            }
        }
    } catch(e) {}
}

function formatShieldTime(ts) {
    if (!ts) return 'काही वेळापूर्वी';
    const now = Date.now();
    const diffMs = now - Number(ts);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'आत्ताच';
    if (diffMins < 60) return `${diffMins} मि. पूर्वी`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} तासांपूर्वी`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'काल';
    if (diffDays < 7) return `${diffDays} दिवसांपूर्वी`;
    return new Date(Number(ts)).toLocaleDateString('mr-IN', { day: '2-digit', month: 'short' });
}

function renderQualityAlertCard(alert, isResolved = false) {
    const isLowRating = alert.type === 'LOW_RATING';
    const borderClass = isResolved
        ? 'border-slate-200 bg-slate-50/80 opacity-90'
        : 'border-rose-400 bg-gradient-to-br from-white via-rose-50/40 to-amber-50/30 shadow-md ring-1 ring-rose-400/40';
    const orderNum = alert.orderId ? '#' + String(alert.orderId).slice(-6).toUpperCase() : 'N/A';
    const timeStr = formatShieldTime(alert.timestamp);

    const cleanCustMobile = String(alert.customerMobile || '').replace(/\D/g, '').slice(-10);
    const cleanWorkerMobile = String(alert.workerMobile || '').replace(/\D/g, '').slice(-10);

    const custWaText = isLowRating
        ? `नमस्कार ${alert.customerName || 'ग्राहक'} जी, घरमित्र (Gharmitra) मॅनेजमेंटकडून हा मेसेज आहे. आपल्या ऑर्डर ${orderNum} (${alert.service || 'काम'}) वरील ${alert.rating}★ रेटिंग व तक्रारीबाबत आम्ही अत्यंत दिलगीर आहोत. आपल्या समस्येचे तातडीने निवारण करण्यासाठी आम्ही तत्पर आहोत. काय मदत करू शकतो किंवा आम्ही आपल्याला कॉल करू का? - घरमित्र सपोर्ट (पुणे)`
        : `नमस्कार ${alert.customerName || 'ग्राहक'} जी, घरमित्र (Gharmitra) मॅनेजमेंटकडून हा मेसेज आहे. आपली ऑर्डर ${orderNum} (${alert.service || 'काम'}) रद्द झाल्याचे समजले. काय अडचण आली किंवा कारागिराबाबत काही तक्रार आहे का? आम्ही आपले समाधान करण्यासाठी कटिबद्ध आहोत. - घरमित्र सपोर्ट (पुणे)`;

    const workerWaText = isLowRating
        ? `घरमित्र ॲडमिन नोटीस: कामगार ${alert.workerName || 'कामगार'} जी, ऑर्डर ${orderNum} वर ग्राहकाने ${alert.rating}★ रेटिंग देऊन गंभीर तक्रार नोंदवली आहे. याबाबत तातडीने ॲडमिनशी संपर्क साधावा, अन्यथा आपले खाते तात्पुरते सस्पेंड केले जाईल.`
        : `घरमित्र ॲडमिन नोटीस: कामगार ${alert.workerName || 'कामगार'} जी, ऑर्डर ${orderNum} रद्द झाली आहे. याचे नेमके काय कारण होते? तातडीने ॲडमिनशी संपर्क साधावा.`;

    const custWaUrl = cleanCustMobile ? `https://wa.me/91${cleanCustMobile}?text=${encodeURIComponent(custWaText)}` : null;
    const workerWaUrl = cleanWorkerMobile ? `https://wa.me/91${cleanWorkerMobile}?text=${encodeURIComponent(workerWaText)}` : null;

    return `
    <div class="bg-white p-4 sm:p-5 rounded-2xl border ${borderClass} space-y-3.5 transition">
        <!-- Card Top Header -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2 flex-wrap">
                ${!isResolved ? `
                <span class="bg-red-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-sm animate-pulse">
                    <i class="fa-solid fa-triangle-exclamation"></i> HIGH ATTENTION
                </span>
                ` : `
                <span class="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <i class="fa-solid fa-check"></i> सोडवलेली तक्रार (Resolved)
                </span>
                `}
                <span class="${isLowRating ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-rose-100 text-rose-900 border-rose-300'} text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border">
                    ${isLowRating ? `⭐ ${alert.rating}.0★ कमी रेटिंग तक्रार` : `🚨 ऑर्डर रद्द / वाद (Dispute)`}
                </span>
                ${alert.orderId ? `
                <button type="button" onclick="openAdminOrderModal('${alert.orderId}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-black px-2.5 py-0.5 rounded-lg transition inline-flex items-center gap-1 cursor-pointer">
                    <i class="fa-solid fa-receipt text-[10px]"></i> ऑर्डर ${orderNum}
                </button>
                ` : ''}
                <span class="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    ⚡ ${escapeHtml(alert.service || 'सर्व्हिस')}
                </span>
            </div>
            <div class="text-[11px] text-slate-400 font-medium">
                <i class="fa-regular fa-clock"></i> ${timeStr}
            </div>
        </div>

        <!-- Issue / Complaint Highlight Box -->
        <div class="bg-rose-50/90 border border-rose-200 rounded-xl p-3 text-slate-800">
            <div class="flex items-start gap-2.5">
                <span class="text-rose-600 text-lg leading-none shrink-0 mt-0.5">
                    <i class="fa-solid fa-comment-dots"></i>
                </span>
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <strong class="text-xs font-bold text-rose-900">
                            ${isLowRating ? 'ग्राहकाचा असंतोष व तक्रार:' : 'ऑर्डर रद्द करण्याचे कारण / वाद तपशील:'}
                        </strong>
                        ${isLowRating ? `
                        <span class="text-amber-500 font-bold text-sm tracking-wider">
                            ${'★'.repeat(alert.rating)}${'☆'.repeat(5 - alert.rating)}
                        </span>
                        ` : ''}
                    </div>
                    <p class="text-xs text-slate-800 font-semibold italic">
                        "${escapeHtml(alert.issueDescription)}"
                    </p>
                </div>
            </div>
        </div>

        <!-- Two Columns: Customer Outreach vs Worker Inquiry -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <!-- Customer Contact Column -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <i class="fa-solid fa-user text-blue-600"></i> ग्राहक (Customer):
                    </span>
                    <span class="text-xs font-black text-slate-900">${escapeHtml(alert.customerName || 'अज्ञात ग्राहक')}</span>
                </div>
                <div class="flex items-center justify-between text-xs text-slate-500">
                    <span>मोबाईल नंबर:</span>
                    <a href="tel:${alert.customerMobile}" class="font-bold text-blue-600 hover:underline">${alert.customerMobile || '-'}</a>
                </div>
                <div class="grid grid-cols-2 gap-2 pt-1">
                    <a href="tel:${alert.customerMobile}" class="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-2 px-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-phone"></i> ग्राहकाला कॉल
                    </a>
                    ${custWaUrl ? `
                    <a href="${custWaUrl}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2 px-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                        <i class="fa-brands fa-whatsapp text-sm"></i> व्हॉट्सॲप दिलगिरी
                    </a>
                    ` : `
                    <button disabled class="bg-slate-200 text-slate-400 font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed">
                        <i class="fa-brands fa-whatsapp text-sm"></i> व्हॉट्सॲप
                    </button>
                    `}
                </div>
            </div>

            <!-- Worker Investigation & Action Column -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <i class="fa-solid fa-helmet-safety text-amber-600"></i> कामगार (Worker):
                    </span>
                    <span class="text-xs font-black text-slate-900">${escapeHtml(alert.workerName || 'कामगार')}</span>
                </div>
                <div class="flex items-center justify-between text-xs text-slate-500">
                    <span>मोबाईल नंबर:</span>
                    <a href="tel:${alert.workerMobile}" class="font-bold text-blue-600 hover:underline">${alert.workerMobile || '-'}</a>
                </div>
                <div class="grid grid-cols-2 gap-2 pt-1">
                    <a href="tel:${alert.workerMobile}" class="bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold py-2 px-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-phone"></i> कामगाराला कॉल
                    </a>
                    ${workerWaUrl ? `
                    <a href="${workerWaUrl}" target="_blank" class="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold py-2 px-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                        <i class="fa-brands fa-whatsapp text-sm"></i> ताकीद नोटीस
                    </a>
                    ` : `
                    <button disabled class="bg-slate-200 text-slate-400 font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed">
                        <i class="fa-brands fa-whatsapp text-sm"></i> ताकीद
                    </button>
                    `}
                </div>
            </div>
        </div>

        <!-- Resolution & Disciplinary Footer Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div class="flex items-center gap-2">
                ${(alert.workerUid || alert.workerId || alert.workerMobile) && !isResolved ? `
                <button type="button" onclick="suspendWorkerFromShield('${alert.workerUid || alert.workerId || ''}', '${alert.workerMobile || ''}', '${escapeHtml(alert.workerName)}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 font-bold text-xs py-1.5 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95">
                    <i class="fa-solid fa-user-slash text-xs"></i> 🚫 कामगार ड्युटी बंद / सस्पेंड करा
                </button>
                ` : ''}
            </div>

            <div>
                ${!isResolved ? `
                <button type="button" onclick="resolveQualityAlert('${alert.alertId}')" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-black text-xs py-2 px-4 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                    <i class="fa-solid fa-check-double text-sm"></i> ✓ तक्रार सोडवली (Mark Resolved)
                </button>
                ` : `
                <div class="text-[11px] text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <i class="fa-solid fa-circle-check text-emerald-600"></i>
                    <span>सोडवले: ${escapeHtml(alert.resolutionNote || 'ॲडमिनद्वारे सोडवले')} (${alert.resolvedAtStr || 'Done'})</span>
                </div>
                `}
            </div>
        </div>
    </div>
    `;
}

function renderQualityDisputeShield() {
    const container = document.getElementById('qualityDisputeShieldSection');
    if (!container) return;

    loadLocalQualityResolutions();

    const alertsList = [];
    const seenOrderIds = new Set();

    // 1. Collect low rating reviews (<= 2 stars)
    allReviews.forEach(r => {
        if (r.rating <= 2) {
            const alertId = `review_${r.reviewId || r.orderId}`;
            const resolution = allQualityResolutions[alertId] || (localStorage.getItem('gharmitra_resolved_' + alertId) ? JSON.parse(localStorage.getItem('gharmitra_resolved_' + alertId)) : null);
            const isResolved = Boolean(resolution);

            alertsList.push({
                alertId,
                type: 'LOW_RATING',
                orderId: r.orderId,
                service: r.service,
                rating: r.rating,
                issueDescription: r.review || 'ग्राहकाने १ किंवा २ स्टार रेटिंग देऊन कामाबद्दल असंतोष व्यक्त केला आहे.',
                customerName: r.customerName || 'ग्राहक',
                customerMobile: r.customerMobile || '',
                workerName: r.workerName || 'कामगार',
                workerMobile: r.workerMobile || '',
                workerId: r.workerId || '',
                workerUid: r.workerId || '',
                timestamp: r.timestamp || Date.now(),
                isResolved,
                resolutionNote: resolution ? (resolution.resolutionNote || 'सोडवले') : null,
                resolvedAt: resolution ? resolution.resolvedAt : null,
                resolvedAtStr: resolution ? new Date(resolution.resolvedAt || Date.now()).toLocaleDateString('mr-IN', { day: '2-digit', month: 'short' }) : null
            });
            if (r.orderId) seenOrderIds.add(r.orderId);
        }
    });

    // 2. Collect cancelled orders (Disputes / Cancellations)
    Object.entries(allOrders).forEach(([orderId, order]) => {
        if (order && order.status === 'Cancelled' && !seenOrderIds.has(orderId)) {
            const alertId = `order_cancelled_${orderId}`;
            const resolution = allQualityResolutions[alertId] || (localStorage.getItem('gharmitra_resolved_' + alertId) ? JSON.parse(localStorage.getItem('gharmitra_resolved_' + alertId)) : null);
            const isResolved = Boolean(resolution);

            const targetWorkerId = order.workerUid || order.workerId || '';
            const wInfo = (targetWorkerId && allWorkers[targetWorkerId]) || (order.workerMobile && Object.values(allWorkers).find(w => w.mobile === order.workerMobile));
            const resolvedWorkerName = order.workerName || (wInfo && (wInfo.name || wInfo.fullName)) || (order.workerMobile ? 'कामगार (' + order.workerMobile + ')' : 'अजून नेमला नव्हता');
            const resolvedWorkerMobile = order.workerMobile || (wInfo && wInfo.mobile) || '';

            const cancelReason = order.cancelReason || order.cancellationReason || order.cancelledReason || order.disputeNote || 'ग्राहकाने किंवा कामगाराने वाद / समस्येमुळे ऑर्डर रद्द केली.';

            alertsList.push({
                alertId,
                type: 'CANCELLED_DISPUTE',
                orderId: orderId,
                service: order.service || 'होम सर्व्हिस',
                budget: order.budget || '₹500',
                issueDescription: cancelReason,
                customerName: order.customerName || 'ग्राहक',
                customerMobile: order.customerMobile || '',
                workerName: resolvedWorkerName,
                workerMobile: resolvedWorkerMobile,
                workerId: targetWorkerId,
                workerUid: targetWorkerId,
                timestamp: order.cancelledAt || order.timestamp || order.createdAt || Date.now(),
                isResolved,
                resolutionNote: resolution ? (resolution.resolutionNote || 'सोडवले') : null,
                resolvedAt: resolution ? resolution.resolvedAt : null,
                resolvedAtStr: resolution ? new Date(resolution.resolvedAt || Date.now()).toLocaleDateString('mr-IN', { day: '2-digit', month: 'short' }) : null
            });
        }
    });

    const activeAlerts = alertsList.filter(a => !a.isResolved);
    const resolvedAlerts = alertsList.filter(a => a.isResolved);

    activeAlerts.sort((a, b) => (Number(b.timestamp || 0)) - (Number(a.timestamp || 0)));
    resolvedAlerts.sort((a, b) => (Number(b.timestamp || 0)) - (Number(a.timestamp || 0)));

    if (activeAlerts.length === 0) {
        if (resolvedAlerts.length > 0) {
            container.classList.remove('hidden');
            container.innerHTML = `
                <div class="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-3.5">
                        <span class="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-xl text-yellow-300 shrink-0">
                            <i class="fa-solid fa-shield-halved"></i>
                        </span>
                        <div>
                            <h4 class="font-black text-sm sm:text-base flex items-center gap-2">
                                🛡️ क्वालिटी अलर्ट शिल्ड सुरक्षित (All Clear)
                            </h4>
                            <p class="text-xs text-emerald-100">सध्या कोणतीही प्रलंबित १-२ स्टार तक्रार किंवा वाद नाही. सर्व्हिस क्वालिटी उत्तम राखली आहे!</p>
                        </div>
                    </div>
                    <button type="button" onclick="toggleQualityShieldHistory()" id="shieldHistoryToggleBtn" class="bg-white/20 hover:bg-white/30 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition border border-white/20 cursor-pointer">
                        <i class="fa-solid fa-clock-rotate-left mr-1"></i> सोडवलेल्या तक्रारी (${resolvedAlerts.length}) पहा
                    </button>
                </div>
                <div id="shieldHistoryContainer" class="${isQualityHistoryOpen ? '' : 'hidden'} space-y-3 pt-1">
                    <div class="flex items-center justify-between px-1">
                        <h5 class="text-xs font-bold text-slate-500 uppercase tracking-wider">सोडवलेल्या तक्रारींचा इतिहास (Resolved History):</h5>
                    </div>
                    ${resolvedAlerts.map(a => renderQualityAlertCard(a, true)).join('')}
                </div>
            `;
        } else {
            container.classList.add('hidden');
            container.innerHTML = '';
        }
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = `
        <!-- Main Shield Alert Banner -->
        <div class="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 p-4 sm:p-5 rounded-3xl text-white shadow-xl border border-rose-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl text-yellow-300 shadow-inner shrink-0 animate-bounce">
                    <i class="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="font-black text-base sm:text-lg flex items-center gap-2">
                            🚨 फ्रॉड व क्वालिटी अलर्ट शिल्ड (Quality & Dispute Shield)
                        </h3>
                        <span id="shieldActiveBadge" class="bg-yellow-300 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                            ${activeAlerts.length} High Attention Alerts
                        </span>
                    </div>
                    <p class="text-xs text-rose-100 mt-0.5">
                        १-२ स्टार कमी रेटिंग किंवा वादामुळे रद्द झालेल्या ऑर्डर्स. ग्राहकांशी व कामगारांशी त्वरित संवाद साधून अडचण सोडवा.
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                ${resolvedAlerts.length > 0 ? `
                <button type="button" onclick="toggleQualityShieldHistory()" id="shieldHistoryToggleBtn" class="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition border border-white/20 flex items-center gap-1.5 cursor-pointer">
                    <i class="fa-solid fa-clock-rotate-left"></i> <span>सोडवलेल्या तक्रारी (${resolvedAlerts.length})</span>
                </button>
                ` : ''}
            </div>
        </div>

        <!-- Active Red Alert Cards Container -->
        <div id="shieldActiveCardsContainer" class="space-y-3">
            ${activeAlerts.map(a => renderQualityAlertCard(a, false)).join('')}
        </div>

        <!-- Collapsible History Container -->
        <div id="shieldHistoryContainer" class="${isQualityHistoryOpen ? '' : 'hidden'} space-y-3 pt-2">
            <div class="flex items-center justify-between px-1">
                <h5 class="text-xs font-bold text-slate-500 uppercase tracking-wider">सोडवलेल्या तक्रारींचा इतिहास (Resolved History):</h5>
            </div>
            ${resolvedAlerts.map(a => renderQualityAlertCard(a, true)).join('')}
        </div>
    `;
}

function toggleQualityShieldHistory() {
    isQualityHistoryOpen = !isQualityHistoryOpen;
    const historyContainer = document.getElementById('shieldHistoryContainer');
    const toggleBtn = document.getElementById('shieldHistoryToggleBtn');
    if (historyContainer) {
        historyContainer.classList.toggle('hidden', !isQualityHistoryOpen);
    }
    if (toggleBtn) {
        toggleBtn.innerHTML = isQualityHistoryOpen
            ? '<i class="fa-solid fa-chevron-up"></i> <span>इतिहास लपवा</span>'
            : '<i class="fa-solid fa-clock-rotate-left"></i> <span>सोडवलेल्या तक्रारी</span>';
    }
}

function scrollToQualityShield() {
    const el = document.getElementById('qualityDisputeShieldSection');
    if (!el) return;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-4', 'ring-rose-500');
    setTimeout(() => {
        el.classList.remove('ring-4', 'ring-rose-500');
    }, 2000);
}

async function resolveQualityAlert(alertId) {
    const defaultNote = "ग्राहकाशी थेट बोलून समस्या सोडवली व समाधान केले.";
    const note = prompt("तक्रार सोडवल्याची नोंद / रिझोल्युशन नोट टाका:", defaultNote);
    if (note === null) return;

    const now = Date.now();
    const resolutionPayload = {
        resolvedAt: firebase.database.ServerValue.TIMESTAMP,
        resolvedBy: 'Super Admin',
        resolutionNote: note.trim() || defaultNote
    };

    try {
        await database.ref('qualityDisputeResolutions/' + alertId).set(resolutionPayload);
        allQualityResolutions[alertId] = {
            resolvedAt: now,
            resolvedBy: 'Super Admin',
            resolutionNote: note.trim() || defaultNote
        };
        try {
            localStorage.setItem('gharmitra_resolved_' + alertId, JSON.stringify(resolutionPayload));
        } catch(e) {}

        alert("✅ तक्रार यशस्वीरीत्या सोडवली (Resolved) म्हणून नोंदवली गेली!");
        renderQualityDisputeShield();
    } catch(err) {
        console.error("Resolve Alert Error:", err);
        allQualityResolutions[alertId] = {
            resolvedAt: now,
            resolvedBy: 'Super Admin',
            resolutionNote: note.trim() || defaultNote
        };
        try {
            localStorage.setItem('gharmitra_resolved_' + alertId, JSON.stringify(resolutionPayload));
        } catch(e) {}
        alert("✅ तक्रार स्थानिक पातळीवर सोडवली म्हणून सेव्ह केली!");
        renderQualityDisputeShield();
    }
}

async function suspendWorkerFromShield(workerUid, workerMobile, workerName) {
    const displayName = workerName || workerMobile || 'कामगार';
    const confirmPrompt = `तुम्हाला खात्री आहे की कामगार "${displayName}" ची ड्युटी बंद करून (Duty OFF) त्याला तात्पुरते सस्पेंड करायचे आहे?\n\nयामुळे या कामगाराला नवीन कामांच्या नोटिफिकेशन्स जाणार नाहीत.`;
    if (!confirm(confirmPrompt)) return;

    try {
        const suspendData = {
            isDutyOn: false,
            dutyStatus: 'OFF',
            isSuspended: true,
            suspendedAt: firebase.database.ServerValue.TIMESTAMP,
            suspensionReason: 'Low Rating / Dispute Complaint'
        };

        if (workerUid && workerUid !== 'local_worker_') {
            await database.ref('workers/' + workerUid).update(suspendData).catch(() => {});
        }

        const cleanMob = String(workerMobile).replace(/\D/g, '').slice(-10);
        if (cleanMob) {
            await database.ref('workers/accounts/workers/' + cleanMob).update(suspendData).catch(() => {});
            await database.ref('workers/local_worker_' + cleanMob).update(suspendData).catch(() => {});
        }

        alert(`🚫 कामगार "${displayName}" ची ड्युटी यशस्वीरीत्या बंद केली असून त्याला सस्पेंड केले आहे.`);
        renderWorkersTable();
    } catch(err) {
        console.error("Worker suspend error:", err);
        alert("कामगाराला सस्पेंड करताना त्रुटी आली: " + (err.message || err));
    }
}

// =========================================================
// ⚡ 1-Click Smart Auto-Assign & Emergency Dispatch (SOS)
// =========================================================

function updateSosAlertBanner(sosOrders) {
    const banner = document.getElementById('adminSosAlertBanner');
    if (!banner) return;
    if (!sosOrders || sosOrders.length === 0) {
        banner.classList.add('hidden');
        banner.innerHTML = '';
        return;
    }

    const firstSos = sosOrders[0];
    const orderTitle = '#' + String(firstSos.id).slice(-6).toUpperCase();
    const serviceName = escapeHtml(firstSos.service || 'सर्व्हिस');

    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl text-yellow-300 shadow-inner shrink-0">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </span>
            <div>
                <h4 class="font-black text-sm sm:text-base flex items-center gap-2">
                    ⚡ इमर्जन्सी डिस्पॅच अलर्ट: <span class="bg-white text-rose-700 text-xs px-2.5 py-0.5 rounded-full font-black shadow-sm">${sosOrders.length} प्रलंबित ऑर्डर(s)</span>
                </h4>
                <p class="text-xs text-rose-100">गेल्या २+ मिनिटांपासून कोणत्याही कामगाराने ही ऑर्डर स्वीकारलेली नाही. ग्राहकाचा वेळ वाचवण्यासाठी त्वरित १-क्लिक कामगार सोपवा.</p>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <button type="button" onclick="openForceAssignModal('${firstSos.id}')" class="bg-yellow-300 hover:bg-yellow-400 active:scale-95 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer">
                <i class="fa-solid fa-bolt"></i> ⚡ पहिली ऑर्डर त्वरित डिस्पॅच करा (${orderTitle} - ${serviceName})
            </button>
        </div>
    `;
}

function normalizeAdminServiceName(s) {
    if (!s) return '';
    const str = String(s).toLowerCase();
    if (str.includes('clean') || str.includes('सफाई') || str.includes('झाडू') || str.includes('भांडी') || str.includes('deep')) return 'cleaning';
    if (str.includes('plumb') || str.includes('प्लंबर') || str.includes('नळ') || str.includes('पाईप')) return 'plumbing';
    if (str.includes('elect') || str.includes('इलेक्ट्रिशियन') || str.includes('वायरिंग') || str.includes('लाइट')) return 'electrical';
    if (str.includes('cook') || str.includes('स्वयंपाक') || str.includes('जेवण') || str.includes('आचारी')) return 'cooking';
    if (str.includes('paint') || str.includes('रंगकाम') || str.includes('कलर')) return 'painting';
    if (str.includes('carpen') || str.includes('सुतार') || str.includes('फर्निचर')) return 'carpentry';
    return str.trim();
}

function getAvailableWorkerList() {
    if (cachedWorkerList && cachedWorkerList.length > 0) {
        return cachedWorkerList;
    }
    const workerMap = new Map();
    if (allWorkers && allWorkers.accounts && allWorkers.accounts.workers) {
        Object.entries(allWorkers.accounts.workers).forEach(([mob, acc]) => {
            if (!acc || typeof acc !== 'object') return;
            const uid = 'local_worker_' + mob;
            workerMap.set(uid, {
                uid,
                name: acc.fullName || acc.name || 'Worker',
                mobile: mob,
                service: acc.workType || acc.service || 'Cleaning',
                area: acc.area || 'Pune',
                wallet: acc.balance !== undefined ? acc.balance : (acc.wallet !== undefined ? acc.wallet : 50),
                isDutyOn: Boolean(acc.isDutyOn || acc.dutyStatus === 'ON'),
                activeOrderId: acc.activeOrderId || null,
                ratings: acc.ratings || {},
                photo: acc.photo || acc.photoUrl || null,
                verificationStatus: acc.verificationStatus || 'approved'
            });
        });
    }
    if (allWorkers) {
        Object.entries(allWorkers).forEach(([uid, w]) => {
            if (uid === 'accounts' || !w || typeof w !== 'object') return;
            const u = allUsers[uid] || {};
            const mob = w.mobile || u.mobile || (uid.startsWith('local_worker_') ? uid.replace('local_worker_', '') : '-');
            const existing = workerMap.get(uid);
            workerMap.set(uid, {
                uid,
                name: w.name || w.fullName || (existing && existing.name) || u.fullName || u.name || 'Worker',
                mobile: mob,
                service: w.service || w.workType || (existing && existing.service) || u.service || u.workType || 'Cleaning',
                area: w.area || (existing && existing.area) || 'Pune',
                wallet: w.wallet !== undefined ? w.wallet : (existing ? existing.wallet : 50),
                isDutyOn: Boolean(w.isDutyOn || w.dutyStatus === 'ON' || (existing && existing.isDutyOn)),
                activeOrderId: w.activeOrderId || (existing && existing.activeOrderId) || null,
                ratings: w.ratings || (existing && existing.ratings) || {},
                photo: w.photo || w.photoUrl || (existing && existing.photo) || u.photo || u.photoUrl || null,
                verificationStatus: w.verificationStatus || (existing && existing.verificationStatus) || 'approved'
            });
        });
    }
    return Array.from(workerMap.values());
}

function scoreAndRankWorkersForOrder(order) {
    const list = getAvailableWorkerList();
    const orderNormService = normalizeAdminServiceName(order.service);
    const orderArea = String(order.area || '').toLowerCase().trim();

    return list.map(w => {
        let score = 0;
        const reasons = [];

        // 1. Service Match (+100)
        const workerNormService = normalizeAdminServiceName(w.service);
        const directMatch = (orderNormService && workerNormService && orderNormService === workerNormService) ||
            (w.service && order.service && (w.service.toLowerCase().includes(order.service.toLowerCase()) || order.service.toLowerCase().includes(w.service.toLowerCase())));
        if (directMatch) {
            score += 100;
            reasons.push('सेवा जुळली (+100)');
        }

        // 2. Duty Status (+80)
        if (w.isDutyOn) {
            score += 80;
            reasons.push('Duty ON (+80)');
        }

        // 3. Area Match (+60)
        const workerArea = String(w.area || '').toLowerCase().trim();
        if (orderArea && workerArea && (orderArea.includes(workerArea) || workerArea.includes(orderArea))) {
            score += 60;
            reasons.push('जवळचा परिसर (+60)');
        }

        // 4. KYC Status (+50)
        const isKycApproved = (w.verificationStatus === 'approved');
        if (isKycApproved) {
            score += 50;
            reasons.push('KYC व्हेरिफाइड (+50)');
        }

        // 5. Free Availability (+40) / Busy Penalty (-60)
        if (!w.activeOrderId) {
            score += 40;
            reasons.push('मोकळा (+40)');
        } else {
            score -= 60;
            reasons.push('सध्या व्यस्त (-60)');
        }

        // 6. Rating Contribution (up to +50)
        let calcRating = 5.0;
        if (w.ratings && typeof w.ratings === 'object') {
            const rList = Object.values(w.ratings);
            if (rList.length > 0) {
                const sum = rList.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
                calcRating = Number((sum / rList.length).toFixed(1));
            }
        }
        const ratingBonus = Math.round(calcRating * 10);
        score += ratingBonus;
        reasons.push(`रेटिंग ${calcRating}★ (+${ratingBonus})`);

        return {
            ...w,
            score,
            ratingAvg: calcRating,
            matchReasons: reasons,
            isServiceMatch: directMatch,
            isAreaMatch: Boolean(orderArea && workerArea && (orderArea.includes(workerArea) || workerArea.includes(orderArea)))
        };
    }).sort((a, b) => b.score - a.score);
}

function openForceAssignModal(orderId) {
    selectedForceAssignOrderId = orderId;
    const order = allOrders[orderId];
    if (!order) {
        alert("ऑर्डर सापडली नाही.");
        return;
    }

    const orderTime = Number(order.timestamp || order.createdAt || 0);
    const elapsedMinutes = orderTime > 0 ? Math.floor((Date.now() - orderTime) / 60000) : 0;

    // Render Order Summary
    const summaryEl = document.getElementById('forceAssignOrderSummary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5 mb-2.5">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-slate-900 bg-amber-200 px-2.5 py-0.5 rounded-lg">#${orderId.slice(-6).toUpperCase()}</span>
                    <span class="font-black text-slate-800 text-sm">⚡ ${escapeHtml(order.service || 'सर्व्हिस')}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-200">${escapeHtml(order.budget || '₹500')}</span>
                    <span class="text-[11px] font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-lg border border-rose-200 animate-pulse">
                        <i class="fa-solid fa-clock"></i> ${elapsedMinutes} मिनिटांपासून प्रलंबित
                    </span>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                <p><strong>ग्राहक:</strong> ${escapeHtml(order.customerName || 'Customer')} (<a href="tel:${order.customerMobile}" class="text-blue-600 font-bold">${order.customerMobile || '-'}</a>)</p>
                <p><strong>पत्ता / परिसर:</strong> 📍 ${escapeHtml(order.area || 'Pune')} - ${escapeHtml(order.address || '')}</p>
                <p><strong>तारीख व वेळ:</strong> ${order.date || 'Today'} ${order.time || ''}</p>
                <p><strong>सध्याचे स्टेटस:</strong> <span class="font-bold text-amber-600">${order.status || 'Pending'}</span></p>
            </div>
        `;
    }

    // Render Smart Auto-Assign Recommendation
    const rankedWorkers = scoreAndRankWorkersForOrder(order);
    const smartBanner = document.getElementById('forceAssignSmartBanner');
    if (smartBanner) {
        if (rankedWorkers.length > 0 && rankedWorkers[0].score > 0) {
            const best = rankedWorkers[0];
            smartBanner.classList.remove('hidden');
            smartBanner.innerHTML = `
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="space-y-1">
                        <span class="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <i class="fa-solid fa-wand-magic-sparkles text-yellow-300"></i> AI सर्वोत्तम शिफारस (Smart Recommendation)
                        </span>
                        <h4 class="font-black text-base sm:text-lg flex items-center gap-2 text-white">
                            ${escapeHtml(best.name)}
                            <span class="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-lg text-emerald-100">${escapeHtml(best.service)}</span>
                            <span class="text-xs font-bold text-yellow-300">★ ${best.ratingAvg}</span>
                        </h4>
                        <p class="text-xs text-emerald-100 flex items-center gap-2 flex-wrap">
                            <span>📍 ${escapeHtml(best.area)}</span>
                            <span>•</span>
                            <span class="${best.isDutyOn ? 'text-yellow-300 font-bold' : 'text-slate-200'}">🟢 ${best.isDutyOn ? 'Duty ON' : 'Duty OFF'}</span>
                            <span>•</span>
                            <span>स्कोअर: <strong class="text-yellow-300">${best.score} pts</strong></span>
                            <span>•</span>
                            <span class="text-[11px] opacity-90">${best.matchReasons.slice(0, 3).join(', ')}</span>
                        </p>
                    </div>
                    <button type="button" onclick="executeForceAssignWorker('${orderId}', '${best.uid}')" class="w-full sm:w-auto bg-yellow-300 hover:bg-yellow-400 active:scale-95 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer border border-yellow-200 shrink-0">
                        <i class="fa-solid fa-bolt text-amber-800 text-sm"></i> ⚡ 1-क्लिक ऑटो-असाईन करा
                    </button>
                </div>
            `;
        } else {
            smartBanner.classList.add('hidden');
        }
    }

    renderForceAssignWorkersList();

    const modal = document.getElementById('adminForceAssignModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeForceAssignModal() {
    const modal = document.getElementById('adminForceAssignModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    selectedForceAssignOrderId = null;
}

function renderForceAssignWorkersList() {
    if (!selectedForceAssignOrderId) return;
    const order = allOrders[selectedForceAssignOrderId];
    if (!order) return;

    const container = document.getElementById('forceAssignWorkersList');
    if (!container) return;

    const filterVal = document.getElementById('forceAssignFilterSelect')?.value || 'MATCH';
    let ranked = scoreAndRankWorkersForOrder(order);

    if (filterVal === 'DUTY_ON') {
        ranked = ranked.filter(w => w.isDutyOn);
    } else if (filterVal === 'MATCH') {
        ranked = ranked.filter(w => w.isDutyOn || w.isServiceMatch || w.isAreaMatch || w.score >= 100);
    }

    if (ranked.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-400 text-xs">
                <i class="fa-solid fa-user-slash text-2xl mb-1 text-slate-300 block"></i>
                निवडलेल्या निकषांनुसार एकही कामगार उपलब्ध नाही.
            </div>
        `;
        return;
    }

    container.innerHTML = ranked.map((w, idx) => {
        const isBusy = !!w.activeOrderId;
        const photoUrl = w.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231e293b'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23f59e0b'/%3E%3Cpath d='M14 54c0-9.94 8.06-18 18-18s18 8.06 18 18' fill='%23f59e0b'/%3E%3C/svg%3E";

        return `
            <div class="bg-white p-3.5 rounded-2xl border ${idx === 0 && w.score > 0 ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'} shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-amber-300 transition">
                <div class="flex items-center gap-3">
                    <img src="${photoUrl}" class="w-11 h-11 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" alt="Worker">
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h5 class="font-bold text-slate-900 text-sm">${escapeHtml(w.name)}</h5>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${w.isDutyOn ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600'}">
                                ${w.isDutyOn ? '🟢 Duty ON' : '⚪ Duty OFF'}
                            </span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${w.verificationStatus === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">
                                ${w.verificationStatus === 'approved' ? '✓ KYC' : '⏳ Unverified'}
                            </span>
                            ${isBusy ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">⚠️ व्यस्त (#${String(w.activeOrderId).slice(-6)})</span>` : ''}
                        </div>
                        <div class="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                            <span class="font-semibold text-slate-700">⚡ ${escapeHtml(w.service)}</span>
                            <span>•</span>
                            <span>📍 ${escapeHtml(w.area || 'Pune')}</span>
                            <span>•</span>
                            <a href="tel:${w.mobile}" class="text-blue-600 font-bold hover:underline"><i class="fa-solid fa-phone text-[10px]"></i> ${w.mobile}</a>
                            <span>•</span>
                            <span class="text-amber-500 font-bold">★ ${w.ratingAvg}</span>
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span class="font-bold text-amber-700">मॅच स्कोअर: ${w.score} pts</span>
                            <span>|</span>
                            <span>${w.matchReasons.join(' • ')}</span>
                        </div>
                    </div>
                </div>

                <div class="w-full sm:w-auto flex items-center justify-end shrink-0">
                    <button type="button" onclick="executeForceAssignWorker('${selectedForceAssignOrderId}', '${w.uid}')" class="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer border border-amber-400">
                        <i class="fa-solid fa-bolt text-xs"></i> ⚡ थेट सोपवा (Assign)
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function executeForceAssignWorker(orderId, workerUid) {
    const order = allOrders[orderId];
    if (!order) {
        alert("ऑर्डर सापडली नाही.");
        return;
    }

    const workerList = getAvailableWorkerList();
    const worker = workerList.find(w => w.uid === workerUid);
    if (!worker) {
        alert("कामगार सापडला नाही.");
        return;
    }

    const orderNum = '#' + String(orderId).slice(-6).toUpperCase();
    const confirmMsg = `तुम्हाला खात्री आहे की ऑर्डर ${orderNum} (${order.service || 'काम'}) कामगार "${worker.name}" (${worker.mobile}) ला थेट सोपवायची आहे?\n\nही ऑर्डर कामगाराच्या ॲपमध्ये आपोआप Active होईल.`;
    if (!confirm(confirmMsg)) return;

    try {
        const nowMs = firebase.database.ServerValue.TIMESTAMP;

        // 1. Update Order in Firebase
        const orderUpdates = {
            status: 'Accepted',
            workerUid: worker.uid,
            workerId: worker.uid,
            workerName: worker.name,
            workerMobile: worker.mobile,
            workerService: worker.service || order.service || '',
            workerPhoto: worker.photo || '',
            assignedBy: 'Admin (Force Dispatch / SOS)',
            acceptedAt: nowMs,
            dispatchedAt: nowMs,
            onTheWayDeadline: Date.now() + (15 * 60 * 1000)
        };

        await database.ref('orders/' + orderId).update(orderUpdates);

        // 2. Lock activeOrderId on worker's record
        await database.ref('workers/' + worker.uid).update({
            activeOrderId: orderId
        }).catch(() => {});

        if (worker.mobile && worker.mobile !== '-') {
            await database.ref('workers/accounts/workers/' + worker.mobile).update({
                activeOrderId: orderId
            }).catch(() => {});
        }

        // 3. Close modals and notify admin
        closeForceAssignModal();
        closeAdminOrderModal();

        alert(`✅ ऑर्डर ${orderNum} यशस्वीरित्या कामगार "${worker.name}" ला सोपवली गेली!\n\nकामगाराच्या स्क्रीनवर ही ऑर्डर त्वरित Active होईल.`);

        renderOrdersTable();
    } catch(err) {
        console.error("Force Assign Error:", err);
        alert("ऑर्डर सोपवताना त्रुटी आली: " + (err.message || err));
    }
}

// =========================================================
// 8. Admin System Push Notification Broadcaster
// =========================================================

function applyAdminPushPreset(type) {
    const titleEl = document.getElementById('pushTitleInput');
    const bodyEl = document.getElementById('pushBodyInput');
    const urlEl = document.getElementById('pushUrlInput');
    const radioWorkers = document.querySelector('input[name="adminPushAudience"][value="WORKERS"]');
    const radioCustomers = document.querySelector('input[name="adminPushAudience"][value="CUSTOMERS"]');
    const radioAll = document.querySelector('input[name="adminPushAudience"][value="ALL"]');

    if (!titleEl || !bodyEl) return;

    if (type === 'NEW_JOB') {
        titleEl.value = '⚡ नवीन घरकाम ऑर्डर उपलब्ध!';
        bodyEl.value = 'तुमच्या भागात नवीन ऑर्डर आली आहे. त्वरित घरमित्र ॲप उघडा आणि ऑर्डर स्वीकारा!';
        if (urlEl) urlEl.value = 'worker.html';
        if (radioWorkers) radioWorkers.checked = true;
    } else if (type === 'DISCOUNT') {
        titleEl.value = '🎉 घरमित्र विशेष सवलत धमाका!';
        bodyEl.value = 'आजच घरातील दुरुस्ती किंवा स्वच्छता सेवा बुक करा आणि मिळवा विशेष सवलत! घरमित्र सोबत घरकाम सोपे करा.';
        if (urlEl) urlEl.value = 'customer.html';
        if (radioCustomers) radioCustomers.checked = true;
    } else if (type === 'KYC') {
        titleEl.value = '🪪 आधार KYC व्हेरिफिकेशन सूचना';
        bodyEl.value = 'सर्व कामगारांनी कृपया आपले आधार कार्ड अपलोड करून प्रोफाइल व्हेरिफाय करावे, जेणेकरून तुम्हाला नवीन कामांचे ऑर्डर्स मिळतील.';
        if (urlEl) urlEl.value = 'worker.html';
        if (radioWorkers) radioWorkers.checked = true;
    } else if (type === 'SYSTEM_UPDATE') {
        titleEl.value = '📢 घरमित्र नवीन अपडेट उपलब्ध!';
        bodyEl.value = 'सुरक्षितता आणि वेगवान सेवेसाठी नवीन फीचर्स जोडण्यात आले आहेत. घरमित्र वापरल्याबद्दल धन्यवाद!';
        if (urlEl) urlEl.value = 'index.html';
        if (radioAll) radioAll.checked = true;
    }

    toggleAdminPushSpecificMobile();
    updateAdminPushPreview();
}

function toggleAdminPushSpecificMobile() {
    const specificRadio = document.querySelector('input[name="adminPushAudience"][value="SPECIFIC"]');
    const group = document.getElementById('pushSpecificMobileGroup');
    if (!group) return;
    if (specificRadio && specificRadio.checked) {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
    }
}

function updateAdminPushPreview() {
    const titleVal = (document.getElementById('pushTitleInput')?.value || '').trim();
    const bodyVal = (document.getElementById('pushBodyInput')?.value || '').trim();

    const previewTitle = document.getElementById('previewPushTitle');
    const previewBody = document.getElementById('previewPushBody');

    if (previewTitle) previewTitle.textContent = titleVal || '⚡ नवीन घरकाम ऑर्डर उपलब्ध!';
    if (previewBody) previewBody.textContent = bodyVal || 'तुमच्या भागात नवीन काम आले आहे. लगेच स्वीकारा!';
}

async function dispatchAdminBroadcastPush() {
    const titleInput = document.getElementById('pushTitleInput');
    const bodyInput = document.getElementById('pushBodyInput');
    const urlInput = document.getElementById('pushUrlInput');
    const audienceInput = document.querySelector('input[name="adminPushAudience"]:checked');
    const targetMobileInput = document.getElementById('pushTargetMobile');

    const title = (titleInput?.value || '').trim();
    const body = (bodyInput?.value || '').trim();
    const targetUrl = (urlInput?.value || 'index.html').trim();
    const audience = audienceInput ? audienceInput.value : 'ALL';
    let targetMobile = (targetMobileInput?.value || '').trim();

    if (!title || !body) {
        alert('कृपया नोटिफिकेशन शीर्षक (Title) आणि संदेश (Body) दोन्ही भरा.');
        return;
    }

    if (audience === 'SPECIFIC') {
        targetMobile = targetMobile.replace(/[^0-9]/g, '');
        if (targetMobile.length !== 10) {
            alert('कृपया अचूक १० अंकी मोबाईल नंबर टाका.');
            return;
        }
    } else {
        targetMobile = null;
    }

    const confirmMsg = `तुम्हाला हा पुश नोटिफिकेशन संदेश पाठवायचा आहे का?\n\nशीर्षक: ${title}\nप्रेक्षक: ${audience === 'ALL' ? 'सर्व वापरकर्ते' : (audience === 'WORKERS' ? 'सर्व कामगार' : (audience === 'CUSTOMERS' ? 'सर्व ग्राहक' : targetMobile))}\n\nहा संदेश युझरच्या मोबाईल स्क्रीनवर थेट दिसेल.`;
    if (!confirm(confirmMsg)) return;

    try {
        // Ensure Firebase Auth session exists so rules requiring auth are satisfied
        if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
                if (!firebase.auth().currentUser) {
                    await firebase.auth().signInAnonymously();
                }
            } catch(authErr) {
                console.warn('Firebase Auth anonymous check:', authErr);
            }
        }

        const payload = {
            title: title,
            body: body,
            targetUrl: targetUrl,
            audience: audience,
            targetMobile: targetMobile,
            sender: 'Super Admin',
            createdAt: Date.now(),
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        await database.ref('broadcastNotifications').push(payload);

        // Also trigger on admin's local device for instant test confirmation
        if (window.GharmitraPush && typeof window.GharmitraPush.showSystemNotification === 'function') {
            window.GharmitraPush.showSystemNotification({
                title: `[ब्रॉडकास्ट पाठवले] ${title}`,
                body: body,
                url: targetUrl
            });
        }

        alert('🚀 पुश नोटिफिकेशन यशस्वीरित्या ब्रॉडकास्ट झाले!\nसर्व संबंधित डिव्हाइसेसवर काही सेकंदांत सिस्टीम नोटिफिकेशन झळकेल.');

        if (titleInput) titleInput.value = '';
        if (bodyInput) bodyInput.value = '';
        updateAdminPushPreview();
    } catch(err) {
        console.error('Push Broadcast Error:', err);
        alert('ब्रॉडकास्ट पाठवताना त्रुटी आली: ' + (err.message || err));
    }
}

async function testAdminPushOnDevice() {
    if (window.GharmitraPush && typeof window.GharmitraPush.testPushNotification === 'function') {
        window.GharmitraPush.testPushNotification();
        return;
    }

    if (!('Notification' in window)) {
        alert('या ब्राउझरमध्ये पुश नोटिफिकेशन सपोर्ट नाही.');
        return;
    }

    if (Notification.permission === 'granted') {
        try {
            new Notification('🔔 घरमित्र ॲडमिन टेस्ट अलर्ट', {
                body: 'तुमच्या डिव्हाइसवर पुश नोटिफिकेशन्स उत्तम रित्या सुरू आहेत!',
                icon: 'images/logo.png',
                vibrate: [200, 100, 200]
            });
        } catch(e) {
            alert('टेस्ट नोटिफिकेशन पाठवले!');
        }
    } else {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            alert('✅ नोटिफिकेशन्स सुरू झाली! आता पुन्हा "टेस्ट करा" वर क्लिक करा.');
        } else {
            alert('⚠️ कृपया ब्राउझर सेटिंग्जमधून नोटिफिकेशन्स Allow करा.');
        }
    }
}

function renderAdminPushBroadcastHistory() {
    const container = document.getElementById('pushBroadcastHistoryContainer');
    if (!container) return;

    const entries = Object.entries(allBroadcastNotifications || {});
    if (entries.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <i class="fa-solid fa-bullhorn text-2xl mb-1 text-slate-300"></i>
                <p>अद्याप कोणताही पुश ब्रॉडकास्ट पाठवला गेलेला नाही.</p>
            </div>
        `;
        return;
    }

    // Sort descending by timestamp / createdAt
    entries.sort((a, b) => {
        const timeA = a[1].createdAt || a[1].timestamp || 0;
        const timeB = b[1].createdAt || b[1].timestamp || 0;
        return timeB - timeA;
    });

    let html = '';
    entries.slice(0, 20).forEach(([key, item]) => {
        const timeVal = item.createdAt || item.timestamp || Date.now();
        const dateStr = new Date(timeVal).toLocaleString('mr-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        let audBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">सर्व वापरकर्ते</span>';
        if (item.audience === 'WORKERS') {
            audBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">👷 सर्व कामगार</span>';
        } else if (item.audience === 'CUSTOMERS') {
            audBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">🏠 सर्व ग्राहक</span>';
        } else if (item.audience === 'SPECIFIC') {
            audBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">📱 ${item.targetMobile || 'विशिष्ट'}</span>`;
        }

        html += `
            <div class="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-xs text-slate-800">${item.title || 'शीर्षक नाही'}</span>
                        ${audBadge}
                        <span class="text-[10px] text-slate-400"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                    </div>
                    <p class="text-xs text-slate-600 line-clamp-2">${item.body || '-'}</p>
                    ${item.targetUrl ? `<span class="text-[10px] text-blue-500 font-mono">🔗 ${item.targetUrl}</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 whitespace-nowrap">
                        <i class="fa-solid fa-check-double"></i> पाठवले
                    </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// --- Initialize on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
});

// Global window bindings for Admin Auth, Route Guard, Invoices, SOS Force Assign & Push Broadcast
window.submitAdminCredentials = submitAdminCredentials;
window.submitAdminOtp = submitAdminOtp;
window.resendAdminOtp = resendAdminOtp;
window.resetToStep1 = resetToStep1;
window.checkAdminAuth = checkAdminAuth;
window.lockAdminDashboard = lockAdminDashboard;
window.sendAdminEmailOtp = sendAdminEmailOtp;
window.verifyAdminEmailOtp = verifyAdminEmailOtp;
window.downloadOrderInvoice = downloadOrderInvoice;
window.closeAdminInvoiceModal = closeAdminInvoiceModal;
window.printAdminInvoice = printAdminInvoice;
window.shareInvoiceOnWhatsApp = shareInvoiceOnWhatsApp;
window.openForceAssignModal = openForceAssignModal;
window.closeForceAssignModal = closeForceAssignModal;
window.renderForceAssignWorkersList = renderForceAssignWorkersList;
window.executeForceAssignWorker = executeForceAssignWorker;
window.updateSosAlertBanner = updateSosAlertBanner;
window.renderQualityDisputeShield = renderQualityDisputeShield;
window.scrollToQualityShield = scrollToQualityShield;
window.toggleQualityShieldHistory = toggleQualityShieldHistory;
window.resolveQualityAlert = resolveQualityAlert;
window.suspendWorkerFromShield = suspendWorkerFromShield;
window.applyAdminPushPreset = applyAdminPushPreset;
window.toggleAdminPushSpecificMobile = toggleAdminPushSpecificMobile;
window.updateAdminPushPreview = updateAdminPushPreview;
window.dispatchAdminBroadcastPush = dispatchAdminBroadcastPush;
window.testAdminPushOnDevice = testAdminPushOnDevice;
window.renderAdminPushBroadcastHistory = renderAdminPushBroadcastHistory;
