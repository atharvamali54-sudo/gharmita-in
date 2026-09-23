// =========================================================
// Cryptographic Password Hashing & Security Helpers
// =========================================================
async function hashPasswordWithSalt(password, mobile) {
    if (!password) return '';
    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    const salt = "gharmitra_sec_salt_2026_" + cleanMobile;
    const enc = new TextEncoder().encode(password + salt);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return "sha256$" + hash;
}

async function verifyPasswordMatch(enteredPassword, storedPassword, mobile) {
    if (!enteredPassword || !storedPassword) return false;
    if (storedPassword.startsWith('sha256$')) {
        const expected = await hashPasswordWithSalt(enteredPassword, mobile);
        return storedPassword === expected;
    }
    // Backward compatibility for legacy plaintext records
    return storedPassword === enteredPassword;
}

(function() {
            emailjs.init("PfAaODZ_GPiBPHvOi"); 
        })();

let currentRole = 'customer'; 
        let isSignupMode = true;      
        let isForgotPasswordMode = false;
        let generatedOTP = null;
        let pendingUserData = null;
        let resetPasswordMobile = null;
        let resetPasswordRole = null;

        const otpDigitInputs = Array.from(document.querySelectorAll('.otp-digit'));

        /*
         * Keep customer and worker accounts in separate namespaces.
         *
         * Older versions stored every account under gharmitra_user_<mobile>
         * and then changed the role during sign in. That allowed a customer
         * record to be opened from the Worker tab. The role is now part of
         * the storage key and the stored role is always validated as well.
         */
        function roleStorageKey(role, mobile) {
            const safeRole = role === 'worker' ? 'worker' : 'customer';
            return 'gharmitra_user_' + safeRole + '_' + mobile;
        }

        function saveUserToLocalStorageOnly(role, user) {
            if (!user || !user.mobile) return;
            const serializedUser = JSON.stringify({ ...user, role });
            localStorage.setItem(roleStorageKey(role, user.mobile), serializedUser);
            const legacyRoleKey = role === 'worker' ? 'gharkam_user_' : 'gharmitra_user_';
            localStorage.setItem(legacyRoleKey + user.mobile, serializedUser);
        }

        // =========================================================
        // CENTRAL CLOUD DATABASE SYNC (Firebase Realtime Database)
        // This ensures accounts created on ANY phone work on ALL phones!
        // =========================================================
        function saveUserForRole(role, user) {
            if (!user || !user.mobile) return;
            const safeRole = role === 'worker' ? 'worker' : 'customer';
            const cleanMobile = String(user.mobile).replace(/\D/g, '').slice(-10);
            const enrichedUser = { ...user, role: safeRole, mobile: cleanMobile };

            // 1. Save to local device cache
            saveUserToLocalStorageOnly(safeRole, enrichedUser);

            // 2. Save to Firebase Realtime Database across all devices
            if (typeof database !== 'undefined') {
                const roleNode = safeRole === 'worker' ? 'workers' : 'customers';
                const cloudData = {
                    fullName: enrichedUser.fullName || enrichedUser.name || '',
                    name: enrichedUser.name || enrichedUser.fullName || '',
                    mobile: cleanMobile,
                    email: enrichedUser.email || '',
                    password: enrichedUser.password || '',
                    role: safeRole,
                    workType: enrichedUser.workType || enrichedUser.service || null,
                    service: enrichedUser.service || enrichedUser.workType || null,
                    balance: typeof enrichedUser.balance !== 'undefined' ? enrichedUser.balance : 50,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                };

                // Store in central accounts registry
                database.ref('workers/accounts/' + roleNode + '/' + cleanMobile).set(cloudData)
                    .catch(err => console.warn('Cloud account sync error:', err));

                // If worker, also sync with workers/local_worker_<mobile>
                if (safeRole === 'worker') {
                    database.ref('workers/local_worker_' + cleanMobile).update({
                        fullName: cloudData.fullName,
                        name: cloudData.name,
                        mobile: cleanMobile,
                        workType: cloudData.workType || 'Cleaning',
                        service: cloudData.service || 'Cleaning',
                        wallet: cloudData.balance || 50
                    }).catch(err => console.warn('Worker sync error:', err));
                }
            }
        }

        function readUserFromStorage(key, role) {
            const rawUser = localStorage.getItem(key);
            if (!rawUser) return null;

            try {
                const user = JSON.parse(rawUser);
                return user && user.role === role ? user : null;
            } catch (error) {
                console.error('Invalid saved account data:', error);
                return null;
            }
        }

        function getUserForRole(role, mobile) {
            const canonicalKey = roleStorageKey(role, mobile);
            const roleSpecificLegacyKey = role === 'worker'
                ? 'gharkam_user_' + mobile
                : 'gharmitra_user_' + mobile;

            const keysToCheck = [
                canonicalKey,
                roleSpecificLegacyKey,
                'gharmitra_user_' + mobile,
                'gharkam_user_' + mobile
            ];
            const checkedKeys = new Set();

            for (const key of keysToCheck) {
                if (checkedKeys.has(key)) continue;
                checkedKeys.add(key);

                const user = readUserFromStorage(key, role);
                if (user) {
                    if (key !== canonicalKey) {
                        localStorage.setItem(canonicalKey, JSON.stringify(user));
                    }
                    return user;
                }
            }

            return null;
        }

        // Asynchronously check both Local Storage AND Firebase Cloud Database
        async function getUserForRoleAsync(role, mobile) {
            const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
            if (!cleanMobile) return null;

            const safeRole = role === 'worker' ? 'worker' : 'customer';
            const localUser = getUserForRole(safeRole, cleanMobile);

            if (typeof database === 'undefined') {
                return localUser;
            }

            try {
                const roleNode = safeRole === 'worker' ? 'workers' : 'customers';
                const snap = await database.ref('workers/accounts/' + roleNode + '/' + cleanMobile).once('value');
                const cloudUser = snap.val();

                if (cloudUser && cloudUser.mobile) {
                    // Update local storage so this phone has it cached too
                    const merged = { ...(localUser || {}), ...cloudUser, role: safeRole };
                    saveUserToLocalStorageOnly(safeRole, merged);
                    return merged;
                }

                // Fallback for workers: check workers/local_worker_<mobile>
                if (safeRole === 'worker') {
                    const workerSnap = await database.ref('workers/local_worker_' + cleanMobile).once('value');
                    const wData = workerSnap.val();
                    if (wData) {
                        const recovered = {
                            fullName: wData.fullName || wData.name || 'Worker',
                            name: wData.name || wData.fullName || 'Worker',
                            mobile: cleanMobile,
                            email: wData.email || (localUser ? localUser.email : ''),
                            password: wData.password || (localUser ? localUser.password : ''),
                            role: 'worker',
                            workType: wData.workType || wData.service || 'Cleaning',
                            service: wData.service || wData.workType || 'Cleaning',
                            balance: typeof wData.wallet !== 'undefined' ? wData.wallet : 50
                        };
                        saveUserToLocalStorageOnly('worker', recovered);
                        return recovered;
                    }
                }
            } catch (e) {
                console.warn('Firebase user lookup error, using local fallback:', e);
            }

            return localUser;
        }

        // Auto-sync any previously stored local accounts on this phone up to Firebase
        function syncExistingLocalAccountsToCloud() {
            if (typeof database === 'undefined') return;
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('gharmitra_user_') || key.startsWith('gharkam_user_'))) {
                        const raw = localStorage.getItem(key);
                        if (!raw) continue;
                        try {
                            const u = JSON.parse(raw);
                            if (u && u.mobile && u.mobile.length === 10 && u.password) {
                                const role = u.role === 'worker' ? 'worker' : 'customer';
                                const cleanMobile = String(u.mobile).replace(/\D/g, '').slice(-10);
                                const roleNode = role === 'worker' ? 'workers' : 'customers';
                                database.ref('workers/accounts/' + roleNode + '/' + cleanMobile).update({
                                    fullName: u.fullName || u.name || '',
                                    name: u.name || u.fullName || '',
                                    mobile: cleanMobile,
                                    email: u.email || '',
                                    password: u.password,
                                    role: role,
                                    workType: u.workType || u.service || null,
                                    service: u.service || u.workType || null,
                                    balance: typeof u.balance !== 'undefined' ? u.balance : 50,
                                    syncedFromLocal: true
                                }).catch(() => {});
                            }
                        } catch(e) {}
                    }
                }
            } catch(e) {}
        }

        function syncOtpValue() {
            document.getElementById('otpInput').value = otpDigitInputs.map(input => input.value).join('');
        }

        function resetOtpUI() {
            const otpContainer = document.getElementById('otpContainer');
            const otpBoxes = document.getElementById('otpBoxes');
            const success = document.getElementById('otpSuccess');
            const progress = document.getElementById('otpProgress');
            const verifyBtn = document.getElementById('verifyOtpBtn');

            otpDigitInputs.forEach(input => {
                input.value = '';
                input.classList.remove('filled');
                input.disabled = false;
            });
            syncOtpValue();
            otpContainer.classList.remove('is-verifying');
            otpBoxes.classList.remove('otp-error');
            success.classList.add('hidden');
            progress.classList.add('hidden');
            verifyBtn.disabled = false;
            verifyBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }

        function showOtpPanel(mode) {
            const otpContainer = document.getElementById('otpContainer');
            const verifyBtn = document.getElementById('verifyOtpBtn');
            const label = document.getElementById('otpLabel');

            resetOtpUI();
            otpContainer.classList.remove('hidden');
            verifyBtn.onclick = mode === 'reset' ? verifyResetOTP : verifyOTPAndRegister;
            verifyBtn.innerText = mode === 'reset' ? 'Verify OTP' : 'Verify & Signup';
            label.innerText = mode === 'reset'
                ? "We've sent a 4-digit reset code to your email. It will auto-verify once entered."
                : "We've sent a 4-digit code to your email. It will auto-verify once entered.";
            setTimeout(() => otpDigitInputs[0]?.focus(), 80);
        }

        function handleOtpInput(event, index) {
            const input = event.target;
            input.value = input.value.replace(/\D/g, '').slice(-1);
            input.classList.toggle('filled', Boolean(input.value));
            syncOtpValue();

            if (input.value && otpDigitInputs[index + 1]) {
                otpDigitInputs[index + 1].focus();
            }

            if (otpDigitInputs.every(digit => digit.value)) {
                setTimeout(() => document.getElementById('verifyOtpBtn').click(), 180);
            }
        }

        function handleOtpKeydown(event, index) {
            if (event.key === 'Backspace' && !event.target.value && otpDigitInputs[index - 1]) {
                otpDigitInputs[index - 1].focus();
            }
            if (event.key === 'ArrowLeft' && otpDigitInputs[index - 1]) {
                otpDigitInputs[index - 1].focus();
            }
            if (event.key === 'ArrowRight' && otpDigitInputs[index + 1]) {
                otpDigitInputs[index + 1].focus();
            }
        }

        function createOtpParticles() {
            const particles = document.getElementById('otpParticles');
            particles.innerHTML = '';
            for (let i = 0; i < 14; i++) {
                const particle = document.createElement('span');
                const angle = (Math.PI * 2 * i) / 14;
                const distance = 42 + Math.random() * 22;
                particle.className = 'otp-particle';
                particle.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
                particle.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
                particles.appendChild(particle);
            }
        }

        function animateOtpVerification(onComplete) {
            const otpContainer = document.getElementById('otpContainer');
            const otpBoxes = document.getElementById('otpBoxes');
            const progress = document.getElementById('otpProgress');
            const verifyBtn = document.getElementById('verifyOtpBtn');
            const success = document.getElementById('otpSuccess');

            otpContainer.classList.add('is-verifying');
            progress.classList.remove('hidden');
            verifyBtn.disabled = true;
            verifyBtn.classList.add('opacity-60', 'cursor-not-allowed');
            otpDigitInputs.forEach(input => input.disabled = true);

            setTimeout(() => {
                otpContainer.classList.remove('is-verifying');
                progress.classList.add('hidden');
                success.classList.remove('hidden');
                createOtpParticles();
                setTimeout(onComplete, 850);
            }, 700);
        }

        function showOtpError(message) {
            const otpBoxes = document.getElementById('otpBoxes');
            otpBoxes.classList.remove('otp-error');
            void otpBoxes.offsetWidth;
            otpBoxes.classList.add('otp-error');
            showStatus(message, 'error');
        }

        otpDigitInputs.forEach((input, index) => {
            input.addEventListener('input', event => handleOtpInput(event, index));
            input.addEventListener('keydown', event => handleOtpKeydown(event, index));
            input.addEventListener('paste', event => {
                event.preventDefault();
                const pasted = (event.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, otpDigitInputs.length);
                pasted.split('').forEach((digit, offset) => {
                    if (otpDigitInputs[offset]) {
                        otpDigitInputs[offset].value = digit;
                        otpDigitInputs[offset].classList.add('filled');
                    }
                });
                syncOtpValue();
                otpDigitInputs[Math.min(pasted.length, otpDigitInputs.length) - 1]?.focus();
                if (pasted.length === otpDigitInputs.length) {
                    setTimeout(() => document.getElementById('verifyOtpBtn').click(), 180);
                }
            });
        });

        function setRole(role) {
            currentRole = role;
            const tabC = document.getElementById('tabCustomer');
            const tabW = document.getElementById('tabWorker');

            if (role === 'customer') {
                tabC.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white transition";
                tabW.className = "flex-1 py-2 text-sm font-bold rounded-lg text-gray-700 transition";
            } else {
                tabW.className = "flex-1 py-2 text-sm font-bold rounded-lg bg-yellow-500 text-gray-900 transition";
                tabC.className = "flex-1 py-2 text-sm font-bold rounded-lg text-gray-700 transition";
            }
            if(!isForgotPasswordMode) updateFormUI();
        }

        function toggleMode() {
            isSignupMode = !isSignupMode;
            isForgotPasswordMode = false;
            showStatus('', 'hidden');
            document.getElementById('otpContainer').classList.add('hidden');
            document.getElementById('newPasswordContainer').classList.add('hidden');
            document.getElementById('submitBtn').classList.remove('hidden');
            updateFormUI();
        }

        function updateFormUI() {
            const title = document.getElementById('formTitle');
            const sub = document.getElementById('formSub');
            const btn = document.getElementById('submitBtn');
            const toggleTxt = document.getElementById('toggleText');
            const workTypeContainer = document.getElementById('workTypeContainer');
            const fullNameContainer = document.getElementById('fullNameContainer');
            const fullNameInput = document.getElementById('fullName');
            const emailContainer = document.getElementById('emailContainer');
            const emailInput = document.getElementById('email');
            const passwordContainer = document.getElementById('passwordContainer');
            const passwordInput = document.getElementById('password');
            const forgotLinkContainer = document.getElementById('forgotPasswordLinkContainer');

            let roleName = currentRole === 'customer' ? 'Customer' : 'Worker';

            if (isSignupMode && currentRole === 'worker') {
                workTypeContainer.classList.remove('hidden');
            } else {
                workTypeContainer.classList.add('hidden');
            }

            if (isSignupMode) {
                title.innerText = roleName + " Signup";
                sub.innerText = "Create account using Email OTP & Password";
                btn.innerText = "Send OTP & Verify";
                fullNameContainer.classList.remove('hidden');
                fullNameInput.required = true;
                emailContainer.classList.remove('hidden');
                emailInput.required = true;
                passwordContainer.classList.remove('hidden');
                passwordInput.required = true;
                forgotLinkContainer.classList.add('hidden');
                btn.className = currentRole === 'customer' ? "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition" : "w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-xl shadow-lg transition";
                toggleTxt.innerHTML = `Already have an account? <a href="#" onclick="toggleMode()" class="text-blue-600 font-bold hover:underline">Sign In</a>`;
            } else {
                title.innerText = roleName + " Sign In";
                sub.innerText = "Enter Mobile & Password to Sign In";
                btn.innerText = "Sign In";
                fullNameContainer.classList.add('hidden');
                fullNameInput.required = false;
                emailContainer.classList.add('hidden'); 
                emailInput.required = false;
                passwordContainer.classList.remove('hidden');
                passwordInput.required = true;
                forgotLinkContainer.classList.remove('hidden');
                btn.className = currentRole === 'customer' ? "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition" : "w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-xl shadow-lg transition";
                toggleTxt.innerHTML = `Don't have an account? <a href="#" onclick="toggleMode()" class="text-blue-600 font-bold hover:underline">Sign Up</a>`;
            }
        }

        function showStatus(msg, type) {
            const el = document.getElementById('statusMsg');
            if (type === 'hidden') {
                el.classList.add('hidden');
                return;
            }
            el.innerText = msg;
            el.className = "mb-4 p-3 rounded-xl text-center text-xs font-semibold " + 
                (type === 'success' ? "bg-green-100 border border-green-400 text-green-700" : 
                 type === 'error' ? "bg-red-100 border border-red-400 text-red-700" : "bg-blue-100 border border-blue-400 text-blue-700");
            el.classList.remove('hidden');
        }

        async function showForgotPasswordUI() {
            let mobile = document.getElementById('mobile').value.trim().replace(/\D/g, '').slice(-10);
            if (!mobile || mobile.length !== 10) {
                showStatus("❌ आधी बरोबर १० अंकी Mobile Number टाका!", "error");
                return;
            }

            showStatus("⏳ खाते शोधत आहे...", "info");
            let savedUser = await getUserForRoleAsync(currentRole, mobile);
            if (!savedUser || !savedUser.email) {
                showStatus("❌ हा मोबाईल नंबर रजिस्टर नाही! आधी Signup करा.", "error");
                return;
            }

            showStatus("", "hidden");
            resetPasswordMobile = mobile;
            resetPasswordRole = currentRole;
            isForgotPasswordMode = true;

            document.getElementById('formTitle').innerText = "Reset Password";
            document.getElementById('formSub').innerText = "OTP will be sent to: " + savedUser.email;
            document.getElementById('fullNameContainer').classList.add('hidden');
            document.getElementById('email').value = savedUser.email;
            document.getElementById('emailContainer').classList.remove('hidden');
            document.getElementById('email').readOnly = true;
            document.getElementById('passwordContainer').classList.add('hidden');
            document.getElementById('forgotPasswordLinkContainer').classList.add('hidden');
            document.getElementById('submitBtn').classList.add('hidden');

            generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
            sendEmailOTPForReset(savedUser.email, generatedOTP);
        }

        function sendEmailOTPForReset(email, otp) {
            showStatus("⏳ Sending Password Reset OTP to " + email + "...", "info");

            const serviceID = 'service_lst67g7';
            const templateID = 'template_ope5xzi';

            const templateParams = {
                to_email: email,
                email: email,
                user_email: email,
                otp_code: otp,
                message: "Your Gharmitra.online Password Reset OTP Code is: " + otp
            };

            emailjs.send(serviceID, templateID, templateParams)
                .then(() => {
                    showStatus("📩 Reset OTP pathavla ahe! Krupaya check kara.", "success");
                    showOtpPanel('reset');
                })
                .catch((err) => {
                    console.error("EmailJS Error:", err);
                    showStatus("❌ Email send fails.", "error");
                });
        }

        function verifyResetOTP(event) {
            if(event) event.preventDefault();
            syncOtpValue();
            let userEnteredOTP = document.getElementById('otpInput').value.trim();

            if (userEnteredOTP === generatedOTP) {
                showStatus("⏳ OTP verify hot ahe...", "info");
                animateOtpVerification(() => {
                    showStatus("✅ OTP verified successfully! Now enter your new password.", "success");
                    document.getElementById('otpContainer').classList.add('hidden');
                    document.getElementById('newPasswordContainer').classList.remove('hidden');
                });
            } else {
                showOtpError("❌ चुकीचा OTP! Correct code taka.");
            }
        }

        async function updateNewPassword() {
            let newPass = document.getElementById('newPassword').value.trim();
            let confirmPass = document.getElementById('confirmNewPassword').value.trim();

            if (!newPass || newPass.length < 6) {
                showStatus("❌ Password कमीत कमी ६ अक्षरी असावा.", "error");
                return;
            }

            if (newPass !== confirmPass) {
                showStatus("❌ New Password आणि Confirm Password जुळत नाहीत!", "error");
                return;
            }

            showStatus("⏳ पासवर्ड बदलत आहे...", "info");
            let savedUser = await getUserForRoleAsync(resetPasswordRole, resetPasswordMobile);
            if (savedUser) {
                const hashedNewPass = await hashPasswordWithSalt(newPass, resetPasswordMobile);
                savedUser.password = hashedNewPass;
                saveUserForRole(resetPasswordRole, savedUser);

                if (typeof database !== 'undefined') {
                    const cleanMobile = String(resetPasswordMobile).replace(/\D/g, '').slice(-10);
                    const roleNode = resetPasswordRole === 'worker' ? 'workers' : 'customers';
                    database.ref('workers/accounts/' + roleNode + '/' + cleanMobile).update({
                        password: hashedNewPass,
                        updatedAt: firebase.database.ServerValue.TIMESTAMP
                    }).catch(() => {});
                }

                showStatus("🎉 Password successfully changed! Now Sign In.", "success");
                
                setTimeout(() => {
                    isForgotPasswordMode = false;
                    document.getElementById('newPasswordContainer').classList.add('hidden');
                    document.getElementById('email').readOnly = false;
                    document.getElementById('email').value = "";
                    document.getElementById('password').value = "";
                    toggleMode(); 
                }, 1500);
            }
        }

        async function handleSubmit(event) {
            event.preventDefault();

            let mobile = document.getElementById('mobile').value.trim().replace(/\D/g, '').slice(-10);
            let password = document.getElementById('password').value.trim();

            if (!mobile || mobile.length !== 10) {
                showStatus("❌ कृपया बरोबर १० अंकी मोबाईल नंबर टाका!", "error");
                return;
            }

            if (isSignupMode) {
                let fullName = document.getElementById('fullName').value.trim();
                let email = document.getElementById('email').value.trim().toLowerCase();

                if (!fullName) {
                    showStatus("कृपया पूर्ण नाव टाका!", "error");
                    return;
                }

                if (!password || password.length < 6) {
                    showStatus("पासवर्ड कमीत कमी ६ अक्षरी असावा.", "error");
                    return;
                }

                showStatus("⏳ मोबाईल नंबर तपासत आहे...", "info");
                const existingUser = await getUserForRoleAsync(currentRole, mobile);

                if (existingUser && existingUser.password) {
                    showStatus("हा मोबाईल नंबर आधीच रजिस्टर आहे! थेट Sign In करा.", "error");
                    return;
                }

                let selectedWorkType = (currentRole === 'worker') ? document.getElementById('workType').value : null;

                const hashedPassword = await hashPasswordWithSalt(password, mobile);
                pendingUserData = { 
                    fullName, name: fullName, mobile, email, password: hashedPassword, role: currentRole, balance: 50, 
                    workType: selectedWorkType, service: selectedWorkType
                };

                generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
                sendEmailOTP(email, generatedOTP);

            } else {
                // =====================================================
                // SIGN IN ACROSS ALL DEVICES / PHONES (Multi-Device Login)
                // =====================================================
                if (!password) {
                    showStatus("कृपया पासवर्ड टाका.", "error");
                    return;
                }

                showStatus("⏳ खाते शोधत आहे...", "info");
                const savedUser = await getUserForRoleAsync(currentRole, mobile);

                if (!savedUser) {
                    showStatus("हे खाते सापडले नाही! कृपया आधी नवीन Signup करा.", "error");
                    return;
                }

                const isPasswordCorrect = await verifyPasswordMatch(password, savedUser.password, mobile);
                if (!isPasswordCorrect) {
                    showStatus("❌ चुकीचा Password! कृपया बरोबर पासवर्ड टाका.", "error");
                    return;
                }

                // Automatic seamless migration: If account had plaintext password, hash it now!
                if (savedUser.password && !savedUser.password.startsWith('sha256$')) {
                    const migratedHash = await hashPasswordWithSalt(password, mobile);
                    savedUser.password = migratedHash;
                    const roleNode = currentRole === 'worker' ? 'workers' : 'customers';
                    if (typeof database !== 'undefined') {
                        database.ref('workers/accounts/' + roleNode + '/' + mobile).update({
                            password: migratedHash,
                            migratedAt: firebase.database.ServerValue.TIMESTAMP
                        }).catch(() => {});
                    }
                }

                // Save session on this new device
                saveUserForRole(currentRole, savedUser);
                const safeSession = { ...savedUser };
                delete safeSession.password;
                localStorage.setItem('current_user_session', JSON.stringify(safeSession));

                showStatus("🎉 Login Successful! Redirecting...", "success");

                setTimeout(() => {
                    redirectUser(currentRole);
                }, 600);
            }
        }

        function sendEmailOTP(email, otp) {
            showStatus("⏳ Sending OTP to " + email + "...", "info");

            const serviceID = 'service_lst67g7';
            const templateID = 'template_ope5xzi';

            const templateParams = {
                to_email: email,
                email: email,
                user_email: email,
                otp_code: otp,
                message: "Your Gharmitra.online OTP Code is: " + otp
            };

            emailjs.send(serviceID, templateID, templateParams)
                .then(() => {
                    showStatus("📩 OTP Pathavla ahe! Krupaya Inbox ki Spam folder check kara.", "success");
                    showOtpPanel('signup');
                    document.getElementById('submitBtn').classList.add('hidden');
                })
                .catch((err) => {
                    console.error("EmailJS Error:", err);
                    showStatus("❌ Email send fails. Re-check EmailJS Template.", "error");
                });
        }

        function resendOTP() {
            let email = document.getElementById('email').value.trim();
            generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
            if(isForgotPasswordMode) {
                sendEmailOTPForReset(email, generatedOTP);
            } else {
                sendEmailOTP(email, generatedOTP);
            }
        }

        function verifyOTPAndRegister(event) {
            if(event) event.preventDefault();
            syncOtpValue();
            let userEnteredOTP = document.getElementById('otpInput').value.trim();

            if (userEnteredOTP === generatedOTP) {
                showStatus("⏳ OTP verify hot ahe...", "info");
                animateOtpVerification(async () => {
                    // Save to both LocalStorage AND Firebase Realtime Database
                    saveUserForRole(pendingUserData.role, pendingUserData);
                    localStorage.setItem('current_user_session', JSON.stringify(pendingUserData));

                    // Confirm cloud write immediately
                    if (typeof database !== 'undefined') {
                        const cleanMobile = String(pendingUserData.mobile).replace(/\D/g, '').slice(-10);
                        const roleNode = pendingUserData.role === 'worker' ? 'workers' : 'customers';
                        try {
                            await database.ref('workers/accounts/' + roleNode + '/' + cleanMobile).set({
                                ...pendingUserData,
                                updatedAt: firebase.database.ServerValue.TIMESTAMP
                            });
                        } catch(e) {
                            console.warn("Cloud account save error:", e);
                        }
                    }

                    showStatus("🎉 Signup Successful! Redirecting...", "success");

                    setTimeout(() => {
                        redirectUser(currentRole);
                    }, 350);
                });
            } else {
                showOtpError("❌ चुकीचा OTP! Correct code taka.");
            }
        }

        function redirectUser(role) {
            if (role === 'customer') {
                window.location.href = "./customer.html";
            } else if (role === 'worker') {
                window.location.href = "./worker.html";
            }
        }

// Automatically sync any existing local accounts on this device up to the cloud
document.addEventListener('DOMContentLoaded', () => {
    syncExistingLocalAccountsToCloud();
});
