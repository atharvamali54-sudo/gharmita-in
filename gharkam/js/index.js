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

        function saveUserForRole(role, user) {
            const serializedUser = JSON.stringify({ ...user, role });

            // Canonical role-scoped record used by this page.
            localStorage.setItem(roleStorageKey(role, user.mobile), serializedUser);

            // Keep the old role-specific key so existing customer.html and
            // worker.html pages can continue reading their own records.
            const legacyRoleKey = role === 'worker' ? 'gharkam_user_' : 'gharmitra_user_';
            localStorage.setItem(legacyRoleKey + user.mobile, serializedUser);
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

            // The final two keys support accounts created by the old build,
            // but only when the saved role exactly matches the selected tab.
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
                    // Migrate a valid old record into the canonical namespace.
                    if (key !== canonicalKey) {
                        localStorage.setItem(canonicalKey, JSON.stringify(user));
                    }
                    return user;
                }
            }

            return null;
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

        function showForgotPasswordUI() {
            let mobile = document.getElementById('mobile').value.trim();
            if (!mobile || mobile.length !== 10) {
                showStatus("❌ Krupaya adhi barobar 10-digit Mobile Number taka!", "error");
                return;
            }

            let savedUser = getUserForRole(currentRole, mobile);
            if (!savedUser) {
                showStatus("❌ Ha mobile number registered nahi ahe! Adhi Signup kara.", "error");
                return;
            }

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

        function updateNewPassword() {
            let newPass = document.getElementById('newPassword').value.trim();
            let confirmPass = document.getElementById('confirmNewPassword').value.trim();

            if (!newPass || newPass.length < 6) {
                showStatus("❌ Password kamit kami 6 anki asla pahije.", "error");
                return;
            }

            if (newPass !== confirmPass) {
                showStatus("❌ New Password and Confirm Password match hot nahi!", "error");
                return;
            }

            let savedUser = getUserForRole(resetPasswordRole, resetPasswordMobile);
            if (savedUser) {
                savedUser.password = newPass;
                saveUserForRole(resetPasswordRole, savedUser);

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

        function handleSubmit(event) {
            event.preventDefault();

            let mobile = document.getElementById('mobile').value.trim();
            let password = document.getElementById('password').value.trim();
            let savedUser = getUserForRole(currentRole, mobile);

            if (isSignupMode) {
                let fullName = document.getElementById('fullName').value.trim();
                let email = document.getElementById('email').value.trim().toLowerCase();

                if (!fullName) {
                    showStatus("Krupaya purna nav taka!", "error");
                    return;
                }

                if (savedUser) {
                    showStatus("Ha mobile number registered ahe! Direct Sign In kara.", "error");
                    return;
                }

                let selectedWorkType = (currentRole === 'worker') ? document.getElementById('workType').value : null;

                pendingUserData = { 
                    fullName, name: fullName, mobile, email, password, role: currentRole, balance: 50, 
                    workType: selectedWorkType, service: selectedWorkType
                };

                generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
                sendEmailOTP(email, generatedOTP);

            } else {
                if (!savedUser) {
                    showStatus("Your account is not available, please first signup.", "error");
                    return;
                }

                if (savedUser.password !== password) {
                    showStatus("❌ चुकीचा Password! Krupaya बरोबर पासवर्ड टाका.", "error");
                    return;
                }

                localStorage.setItem('current_user_session', JSON.stringify(savedUser));

                showStatus("🎉 Login Successful! Redirecting...", "success");

                setTimeout(() => {
                    redirectUser(currentRole);
                }, 800);
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
                animateOtpVerification(() => {
                    saveUserForRole(pendingUserData.role, pendingUserData);
                    localStorage.setItem('current_user_session', JSON.stringify(pendingUserData));

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
