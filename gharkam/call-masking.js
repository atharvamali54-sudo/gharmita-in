/**
 * Gharmitra - Number Masking & Secure Calling System
 * Swiggy / Zomato style call privacy for Customer & Worker.
 * 
 * Features:
 * 1. Virtual Number Masking (+91 20 7195 XXXX) - Real numbers never exposed.
 * 2. In-App WebRTC Audio Calling (Free, secure peer-to-peer browser calling with ringtones).
 * 3. Cloud Telephony Relay option (Exotel / Twilio bridge model).
 */

const GharmitraCallMasking = (function() {
    let currentOrderId = null;
    let currentUserRole = null; // 'customer' or 'worker'
    let currentUserName = null;
    let activeCallListenerRef = null;

    let peerConnection = null;
    let localStream = null;
    let remoteAudioEl = null;
    let callTimerInterval = null;
    let callStartTime = null;
    let isMuted = false;

    // Web Audio API context for ring tones
    let audioCtx = null;
    let ringOscillator = null;
    let ringGainNode = null;
    let ringInterval = null;

    const RTC_CONFIG = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    };

    function getMaskedDisplay(role, seedNumber) {
        const lastDigits = seedNumber ? String(seedNumber).slice(-2) : '24';
        const lineCode = role === 'customer' ? '44' : '33';
        return `+91 20 7195 ${lineCode}${lastDigits}`;
    }

    function initAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playTone(freq1, freq2, durationMs) {
        try {
            initAudioContext();
            if (!audioCtx) return;

            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc1.frequency.value = freq1;
            osc2.frequency.value = freq2;

            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (durationMs / 1000));

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioCtx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(audioCtx.currentTime + (durationMs / 1000));
            osc2.stop(audioCtx.currentTime + (durationMs / 1000));
        } catch (e) {
            console.warn('Audio tone play error:', e);
        }
    }

    function startRinging(isIncoming = false) {
        stopRinging();
        initAudioContext();

        if (isIncoming) {
            // Incoming call ring pattern (pleasant double pulse)
            const ringCycle = () => {
                playTone(440, 480, 800);
                setTimeout(() => playTone(440, 480, 800), 1000);
            };
            ringCycle();
            ringInterval = setInterval(ringCycle, 3500);
        } else {
            // Outgoing call ringback tone (standard dial ring)
            const ringbackCycle = () => {
                playTone(400, 450, 1200);
            };
            ringbackCycle();
            ringInterval = setInterval(ringbackCycle, 3000);
        }
    }

    function stopRinging() {
        if (ringInterval) {
            clearInterval(ringInterval);
            ringInterval = null;
        }
    }

    function ensureCallModal() {
        if (document.getElementById('gharmitraCallModal')) return;

        const modalHtml = `
        <div id="gharmitraCallModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 hidden items-center justify-center p-4">
            <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative overflow-hidden">
                <!-- Top Header -->
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2 text-left">
                        <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm shadow-sm">
                            <i class="fa-solid fa-shield-halved"></i>
                        </span>
                        <div>
                            <h3 class="font-bold text-slate-800 text-sm">Gharmitra Privacy Call</h3>
                            <p class="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                <i class="fa-solid fa-circle-check text-[9px]"></i> 100% Number Masked • Swiggy/Zomato Mode
                            </p>
                        </div>
                    </div>
                    <button id="callModalCloseBtn" onclick="GharmitraCallMasking.closeModal()" class="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs transition">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Modal Body Views -->
                
                <!-- 1. Selection & Info View -->
                <div id="callLauncherSection" class="py-4 space-y-4">
                    <div class="p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl text-left">
                        <span class="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">व्हर्च्युअल मास्क्ड लाइन:</span>
                        <div class="flex items-center justify-between">
                            <span id="callModalMaskedNumber" class="text-base font-black text-slate-900 tracking-wide">+91 20 7195 4421</span>
                            <span class="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">गोपनीय</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                            कॉल करताना तुमचा किंवा समोरच्या व्यक्तीचा खरा मोबाईल नंबर उघड होणार नाही.
                        </p>
                    </div>

                    <!-- Call Options Tabs -->
                    <div class="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                        <button id="tabInAppCall" onclick="GharmitraCallMasking.switchCallTab('inapp')" class="py-2 px-3 text-xs font-bold rounded-lg bg-white text-slate-800 shadow-sm transition">
                            <i class="fa-solid fa-wifi text-emerald-600 mr-1"></i> In-App Call
                        </button>
                        <button id="tabSimCall" onclick="GharmitraCallMasking.switchCallTab('sim')" class="py-2 px-3 text-xs font-bold rounded-lg text-slate-600 transition">
                            <i class="fa-solid fa-sim-card text-blue-600 mr-1"></i> Telephony Line
                        </button>
                    </div>

                    <!-- In-App Call Content -->
                    <div id="tabInAppContent" class="space-y-3">
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                            <div class="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mb-2">
                                <i class="fa-solid fa-phone-volume"></i>
                            </div>
                            <h4 class="text-xs font-bold text-slate-800">मोफत इंटरनेट ऑडिओ कॉल (In-App)</h4>
                            <p class="text-[11px] text-slate-500 mt-1">थेट ब्राऊझरवरून बोला. कोणत्याही सिम कार्ड नंबरची देवाणघेवाण होत नाही.</p>
                        </div>
                        <button onclick="GharmitraCallMasking.startInAppCall()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2">
                            <i class="fa-solid fa-phone"></i> आता सुरक्षित कॉल सुरू करा
                        </button>
                    </div>

                    <!-- SIM Telephony Bridge Content -->
                    <div id="tabSimContent" class="space-y-3 hidden">
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
                            <div class="flex items-center gap-2 font-bold text-slate-800">
                                <i class="fa-solid fa-tower-broadcast text-blue-600"></i> Cloud Telephony Relay (Exotel)
                            </div>
                            <p class="text-slate-600 text-[11px]">
                                आमच्या व्हर्च्युअल रिले नंबरवर कॉल केल्यास सिस्टीम तुमचा कॉल सुरक्षितपणे समोरच्या व्यक्तीकडे ट्रान्सफर करते.
                            </p>
                            <div class="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                                <span class="font-bold text-slate-900" id="simRelayNumberText">+91 20 7195 4421</span>
                                <span class="text-[10px] text-slate-500 font-semibold">Gharmitra PBX</span>
                            </div>
                        </div>
                        <a id="simCallTelLink" href="tel:+912071954421" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2">
                            <i class="fa-solid fa-phone-flip"></i> व्हर्च्युअल नंबर डायल करा
                        </a>
                    </div>
                </div>

                <!-- 2. Active Call / Ringing Screen -->
                <div id="activeCallSection" class="py-6 space-y-5 hidden">
                    <div class="relative w-24 h-24 mx-auto">
                        <div id="callPulseEffect" class="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping"></div>
                        <div class="relative w-24 h-24 rounded-full bg-emerald-600 text-white flex items-center justify-center text-3xl shadow-xl">
                            <i id="callPartyIcon" class="fa-solid fa-user"></i>
                        </div>
                    </div>

                    <div>
                        <h4 id="callPartyName" class="text-base font-bold text-slate-900">Partner</h4>
                        <p id="callStatusText" class="text-xs font-semibold text-emerald-600 mt-0.5">कॉल लागत आहे...</p>
                        <p id="callTimer" class="text-xs font-mono text-slate-500 mt-1 hidden">00:00</p>
                        <span class="inline-block mt-2 text-[10px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                            <i class="fa-solid fa-shield-halved text-emerald-600 mr-1"></i> Masked Line Active
                        </span>
                    </div>

                    <!-- Call Action Controls -->
                    <div class="flex items-center justify-center gap-4 pt-2">
                        <button id="callMuteBtn" onclick="GharmitraCallMasking.toggleMute()" class="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-base transition shadow-sm" title="Mute/Unmute">
                            <i class="fa-solid fa-microphone"></i>
                        </button>
                        <button onclick="GharmitraCallMasking.endCall()" class="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xl transition shadow-lg" title="End Call">
                            <i class="fa-solid fa-phone-slash"></i>
                        </button>
                    </div>
                </div>

                <!-- 3. Incoming Call Alert Screen -->
                <div id="incomingCallSection" class="py-6 space-y-5 hidden">
                    <div class="relative w-24 h-24 mx-auto">
                        <div class="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping"></div>
                        <div class="relative w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center text-3xl shadow-xl">
                            <i class="fa-solid fa-phone-volume animate-bounce"></i>
                        </div>
                    </div>

                    <div>
                        <span class="text-[10px] font-bold tracking-wider text-emerald-700 uppercase bg-emerald-100 px-2.5 py-0.5 rounded-full">इनकमिंग सुरक्षित कॉल</span>
                        <h4 id="incomingCallerName" class="text-base font-bold text-slate-900 mt-2">Customer</h4>
                        <p class="text-xs text-slate-500 mt-0.5">Gharmitra Masked Line द्वारे कॉल येत आहे</p>
                        <p class="text-[10px] text-emerald-600 font-semibold mt-1">तुमचा नंबर पूर्णपणे सुरक्षित आहे</p>
                    </div>

                    <div class="flex items-center justify-center gap-6 pt-2">
                        <button onclick="GharmitraCallMasking.rejectIncomingCall()" class="flex flex-col items-center gap-1 group">
                            <span class="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xl shadow-lg transition">
                                <i class="fa-solid fa-phone-slash"></i>
                            </span>
                            <span class="text-[11px] font-bold text-slate-600">नाकारा</span>
                        </button>
                        <button onclick="GharmitraCallMasking.acceptIncomingCall()" class="flex flex-col items-center gap-1 group">
                            <span class="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center text-xl shadow-lg transition animate-pulse">
                                <i class="fa-solid fa-phone"></i>
                            </span>
                            <span class="text-[11px] font-bold text-slate-800">उचला</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div.firstElementChild);

        // Remote audio element
        if (!remoteAudioEl) {
            remoteAudioEl = document.createElement('audio');
            remoteAudioEl.autoplay = true;
            remoteAudioEl.playsInline = true;
            document.body.appendChild(remoteAudioEl);
        }
    }

    function switchCallTab(tab) {
        const inAppTab = document.getElementById('tabInAppCall');
        const simTab = document.getElementById('tabSimCall');
        const inAppContent = document.getElementById('tabInAppContent');
        const simContent = document.getElementById('tabSimContent');

        if (tab === 'inapp') {
            inAppTab.className = "py-2 px-3 text-xs font-bold rounded-lg bg-white text-slate-800 shadow-sm transition";
            simTab.className = "py-2 px-3 text-xs font-bold rounded-lg text-slate-600 transition";
            inAppContent.classList.remove('hidden');
            simContent.classList.add('hidden');
        } else {
            simTab.className = "py-2 px-3 text-xs font-bold rounded-lg bg-white text-slate-800 shadow-sm transition";
            inAppTab.className = "py-2 px-3 text-xs font-bold rounded-lg text-slate-600 transition";
            simContent.classList.remove('hidden');
            inAppContent.classList.add('hidden');
        }
    }

    function showSection(sectionName) {
        ensureCallModal();
        const launcher = document.getElementById('callLauncherSection');
        const active = document.getElementById('activeCallSection');
        const incoming = document.getElementById('incomingCallSection');
        const closeBtn = document.getElementById('callModalCloseBtn');

        launcher.classList.add('hidden');
        active.classList.add('hidden');
        incoming.classList.add('hidden');

        if (sectionName === 'launcher') {
            launcher.classList.remove('hidden');
            closeBtn.classList.remove('hidden');
        } else if (sectionName === 'active') {
            active.classList.remove('hidden');
            closeBtn.classList.add('hidden'); // During active call, use hangup button
        } else if (sectionName === 'incoming') {
            incoming.classList.remove('hidden');
            closeBtn.classList.add('hidden');
        }

        const modal = document.getElementById('gharmitraCallModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeModal() {
        stopRinging();
        const modal = document.getElementById('gharmitraCallModal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }

    // Opens launcher modal for the user
    function openMaskedCallModal(orderId, role, otherPartySeed) {
        if (!orderId) {
            alert("सध्या कोणतीही सक्रिय ऑर्डर उपलब्ध नाही.");
            return;
        }

        currentOrderId = orderId;
        currentUserRole = role;
        ensureCallModal();

        const maskedNum = getMaskedDisplay(role, otherPartySeed);
        document.getElementById('callModalMaskedNumber').innerText = maskedNum;
        document.getElementById('simRelayNumberText').innerText = maskedNum;
        document.getElementById('simCallTelLink').href = `tel:${maskedNum.replace(/\s+/g, '')}`;

        switchCallTab('inapp');
        showSection('launcher');
    }

    // Start In-App WebRTC Call
    async function startInAppCall() {
        if (!currentOrderId || !currentUserRole) return;
        initAudioContext();

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (err) {
            console.error('Mic access error:', err);
            alert("मायक्रोफोन ॲक्सेस आवश्यक आहे. कृपया ब्राऊझरमध्ये मायक्रोफोन परवानगी सुरू करा.");
            return;
        }

        showSection('active');
        document.getElementById('callPartyName').innerText = currentUserRole === 'customer' ? 'Worker (Verified Partner)' : 'Customer';
        document.getElementById('callStatusText').innerText = 'रिंग होत आहे (Ringing)...';
        document.getElementById('callPulseEffect').classList.remove('hidden');
        document.getElementById('callTimer').classList.add('hidden');

        startRinging(false);

        // Setup WebRTC peer connection
        peerConnection = new RTCPeerConnection(RTC_CONFIG);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = event => {
            if (remoteAudioEl && event.streams[0]) {
                remoteAudioEl.srcObject = event.streams[0];
            }
        };

        const callSessionRef = database.ref(`orders/${currentOrderId}/callSession`);

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                callSessionRef.child(`candidates/${currentUserRole}`).push(event.candidate.toJSON());
            }
        };

        // Create Offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await callSessionRef.set({
            callerRole: currentUserRole,
            callerName: currentUserName || (currentUserRole === 'customer' ? 'Customer' : 'Worker'),
            status: 'calling',
            offer: { type: offer.type, sdp: offer.sdp },
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        // Listen for Answer
        const onValueChange = snapshot => {
            const data = snapshot.val();
            if (!data) return;

            if (data.status === 'connected' && data.answer && !peerConnection.currentRemoteDescription) {
                stopRinging();
                peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
                    .then(() => {
                        onCallConnected();
                    })
                    .catch(e => console.error('Set remote desc error:', e));
            } else if (data.status === 'rejected') {
                stopRinging();
                alert("कॉल नाकारण्यात आला (Call Declined).");
                cleanupCall();
                closeModal();
            } else if (data.status === 'ended') {
                stopRinging();
                cleanupCall();
                closeModal();
            }
        };

        callSessionRef.on('value', onValueChange);
        activeCallListenerRef = { ref: callSessionRef, callback: onValueChange };

        // Listen for ICE candidates from other party
        const otherRole = currentUserRole === 'customer' ? 'worker' : 'customer';
        callSessionRef.child(`candidates/${otherRole}`).on('child_added', snapshot => {
            const candidateData = snapshot.val();
            if (candidateData && peerConnection) {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)).catch(err => {
                    console.warn('Add ICE candidate error:', err);
                });
            }
        });
    }

    function onCallConnected() {
        stopRinging();
        playTone(520, 650, 200); // pleasant connected beep
        document.getElementById('callStatusText').innerText = 'सुरक्षित कॉल सुरू आहे (Connected)';
        document.getElementById('callPulseEffect').classList.add('hidden');
        const timerEl = document.getElementById('callTimer');
        timerEl.classList.remove('hidden');

        callStartTime = Date.now();
        if (callTimerInterval) clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const secs = String(elapsed % 60).padStart(2, '0');
            timerEl.innerText = `${mins}:${secs}`;
        }, 1000);
    }

    // Callee accepts incoming call
    async function acceptIncomingCall() {
        stopRinging();
        initAudioContext();

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (err) {
            console.error('Mic access error:', err);
            alert("मायक्रोफोन परवानगी आवश्यक आहे.");
            rejectIncomingCall();
            return;
        }

        showSection('active');
        document.getElementById('callPartyName').innerText = currentUserRole === 'customer' ? 'Worker' : 'Customer';
        document.getElementById('callStatusText').innerText = 'जोडत आहोत...';

        const callSessionRef = database.ref(`orders/${currentOrderId}/callSession`);
        const snapshot = await callSessionRef.once('value');
        const sessionData = snapshot.val();

        if (!sessionData || !sessionData.offer) {
            alert("कॉल संपला आहे.");
            cleanupCall();
            closeModal();
            return;
        }

        peerConnection = new RTCPeerConnection(RTC_CONFIG);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = event => {
            if (remoteAudioEl && event.streams[0]) {
                remoteAudioEl.srcObject = event.streams[0];
            }
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                callSessionRef.child(`candidates/${currentUserRole}`).push(event.candidate.toJSON());
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(sessionData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await callSessionRef.update({
            status: 'connected',
            answer: { type: answer.type, sdp: answer.sdp }
        });

        // Listen for candidates from caller
        const otherRole = currentUserRole === 'customer' ? 'worker' : 'customer';
        callSessionRef.child(`candidates/${otherRole}`).on('child_added', snap => {
            const candidate = snap.val();
            if (candidate && peerConnection) {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
            }
        });

        // Listen for end of call
        callSessionRef.on('value', snap => {
            const val = snap.val();
            if (val && val.status === 'ended') {
                cleanupCall();
                closeModal();
            }
        });

        onCallConnected();
    }

    function rejectIncomingCall() {
        stopRinging();
        if (currentOrderId) {
            database.ref(`orders/${currentOrderId}/callSession`).update({
                status: 'rejected'
            });
        }
        cleanupCall();
        closeModal();
    }

    function endCall() {
        stopRinging();
        playTone(300, 300, 300); // disconnect beep
        if (currentOrderId) {
            database.ref(`orders/${currentOrderId}/callSession`).update({
                status: 'ended'
            });
        }
        cleanupCall();
        closeModal();
    }

    function cleanupCall() {
        stopRinging();
        if (callTimerInterval) {
            clearInterval(callTimerInterval);
            callTimerInterval = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (remoteAudioEl) {
            remoteAudioEl.srcObject = null;
        }
        if (activeCallListenerRef) {
            activeCallListenerRef.ref.off('value', activeCallListenerRef.callback);
            activeCallListenerRef = null;
        }
        isMuted = false;
        const muteBtn = document.getElementById('callMuteBtn');
        if (muteBtn) {
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            muteBtn.classList.remove('bg-amber-100', 'text-amber-700');
        }
    }

    function toggleMute() {
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack) return;

        isMuted = !isMuted;
        audioTrack.enabled = !isMuted;

        const muteBtn = document.getElementById('callMuteBtn');
        if (isMuted) {
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            muteBtn.classList.add('bg-amber-100', 'text-amber-700');
        } else {
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            muteBtn.classList.remove('bg-amber-100', 'text-amber-700');
        }
    }

    // Active order listener - handles incoming calls in real-time
    let standingOrderListener = null;

    function initOrderCallListener(orderId, role, userName) {
        if (!orderId || !role) return;
        currentOrderId = orderId;
        currentUserRole = role;
        currentUserName = userName || role;

        cleanupStandingListener();

        const callSessionRef = database.ref(`orders/${orderId}/callSession`);
        const listener = callSessionRef.on('value', snapshot => {
            const data = snapshot.val();
            if (!data) return;

            // An incoming call is initiated by the OTHER role
            if (data.status === 'calling' && data.callerRole && data.callerRole !== currentUserRole) {
                // If modal is not active, trigger incoming UI
                ensureCallModal();
                const incomingSection = document.getElementById('incomingCallSection');
                if (incomingSection && incomingSection.classList.contains('hidden')) {
                    document.getElementById('incomingCallerName').innerText = 
                        data.callerName || (currentUserRole === 'customer' ? 'Gharmitra Worker' : 'Customer');
                    showSection('incoming');
                    startRinging(true);
                }
            } else if (data.status === 'ended' || data.status === 'rejected') {
                const incomingSection = document.getElementById('incomingCallSection');
                if (incomingSection && !incomingSection.classList.contains('hidden')) {
                    cleanupCall();
                    closeModal();
                }
            }
        });

        standingOrderListener = { ref: callSessionRef, listener };
    }

    function cleanupStandingListener() {
        if (standingOrderListener) {
            standingOrderListener.ref.off('value', standingOrderListener.listener);
            standingOrderListener = null;
        }
    }

    return {
        openMaskedCallModal,
        switchCallTab,
        startInAppCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endCall,
        toggleMute,
        closeModal,
        initOrderCallListener,
        cleanupStandingListener,
        getMaskedDisplay
    };
})();

// Global helper for HTML buttons
function initiateMaskedCall(role, explicitOrderId, seedNumber) {
    let orderId = explicitOrderId;
    if (!orderId) {
        if (typeof currentOrderId !== 'undefined' && currentOrderId) {
            orderId = currentOrderId;
        } else if (typeof activeOrderId !== 'undefined' && activeOrderId) {
            orderId = activeOrderId;
        }
    }

    if (!orderId) {
        alert("सध्या कोणतीही ऑर्डर उपलब्ध नाही.");
        return;
    }

    GharmitraCallMasking.openMaskedCallModal(orderId, role, seedNumber);
}
