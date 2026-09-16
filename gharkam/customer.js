let currentOrderId = null;
        let activeListener = null;
        let workerLocationListener = null;
        let activeLocationOrderId = null;
        let workerLiveMap = null;
        let workerLiveMarker = null;
        let workerLocationPath = null;
        let workerPathPoints = [];
        let selectedRating = 5;
let activeCustomerChatOrderId = null;
let activeCustomerChatListener = null;
let customerProfile = null;
let pendingProfileChanges = null;
let profileOtpCode = null;

const EMAILJS_PUBLIC_KEY = 'PfAaODZ_GPiBPHvOi';
const EMAILJS_SERVICE_ID = 'service_lst67g7';
const EMAILJS_TEMPLATE_ID = 'template_ope5xzi';

if (window.emailjs) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

function customerStorageKey(mobile) {
    return 'gharmitra_user_customer_' + mobile;
}

function readCustomerSession() {
    try {
        const saved = JSON.parse(localStorage.getItem('current_user_session') || 'null');
        return saved && saved.role === 'customer' ? saved : null;
    } catch (error) {
        console.warn('Could not read customer session:', error);
        return null;
    }
}

function setProfileStatus(message, type = 'info') {
    const status = document.getElementById('profileStatus');
    if (!status) return;
    status.textContent = message;
    status.className = 'mt-4 p-3 rounded-xl text-xs font-semibold ' + (
        type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
        type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
        'bg-blue-50 border border-blue-200 text-blue-700'
    );
    status.classList.remove('hidden');
}

function populateBookingProfile() {
    customerProfile = readCustomerSession();
    if (!customerProfile) return;

    const nameInput = document.getElementById('customerName');
    const mobileInput = document.getElementById('customerMobile');
    if (nameInput) nameInput.value = customerProfile.fullName || customerProfile.name || '';
    if (mobileInput) mobileInput.value = customerProfile.mobile || '';
}

function openProfileModal() {
    customerProfile = readCustomerSession();
    if (!customerProfile) {
        alert('Profile edit करण्यासाठी आधी sign in करा.');
        window.location.href = './index.html';
        return;
    }

    document.getElementById('profileName').value = customerProfile.fullName || customerProfile.name || '';
    document.getElementById('profileEmail').value = customerProfile.email || '';
    document.getElementById('profileMobile').value = customerProfile.mobile || '';
    document.getElementById('profileOtp').value = '';
    document.getElementById('profileOtpArea').classList.add('hidden');
    document.getElementById('profileSaveBtn').classList.remove('hidden');
    document.getElementById('profileStatus').classList.add('hidden');
    pendingProfileChanges = null;
    profileOtpCode = null;
    document.getElementById('profileModal').classList.remove('hidden');
    document.getElementById('profileModal').classList.add('flex');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('flex');
    document.getElementById('profileModal').classList.add('hidden');
}

function writeCustomerProfile(profile, previousMobile) {
    const oldMobile = previousMobile || profile.mobile;
    const serialized = JSON.stringify(profile);
    localStorage.setItem(customerStorageKey(profile.mobile), serialized);
    localStorage.setItem('gharmitra_user_' + profile.mobile, serialized);
    localStorage.setItem('current_user_session', serialized);

    if (oldMobile !== profile.mobile) {
        localStorage.removeItem(customerStorageKey(oldMobile));
        localStorage.removeItem('gharmitra_user_' + oldMobile);
    }

    customerProfile = profile;
    populateBookingProfile();
}

function saveProfile(event) {
    event.preventDefault();
    customerProfile = readCustomerSession();
    if (!customerProfile) return;

    const nextName = document.getElementById('profileName').value.trim();
    const nextEmail = document.getElementById('profileEmail').value.trim().toLowerCase();
    const nextMobile = document.getElementById('profileMobile').value.trim();
    if (!nextName || !nextEmail || !/^\d{10}$/.test(nextMobile)) {
        setProfileStatus('पूर्ण नाव, योग्य email आणि 10-digit mobile number द्या.', 'error');
        return;
    }

    const currentName = customerProfile.fullName || customerProfile.name || '';
    const emailChanged = nextEmail !== String(customerProfile.email || '').toLowerCase();
    const mobileChanged = nextMobile !== String(customerProfile.mobile || '');
    const nextProfile = { ...customerProfile, fullName: nextName, name: nextName, email: nextEmail, mobile: nextMobile, role: 'customer' };

    if (!emailChanged && !mobileChanged) {
        if (nextName === currentName) {
            setProfileStatus('कोणताही बदल केलेला नाही.', 'info');
            return;
        }
        writeCustomerProfile(nextProfile, customerProfile.mobile);
        setProfileStatus('नाव अपडेट झाले. Booking form मध्येही बदल दिसेल.', 'success');
        setTimeout(closeProfileModal, 900);
        return;
    }

    pendingProfileChanges = { profile: nextProfile, previousMobile: customerProfile.mobile };
    profileOtpCode = String(Math.floor(100000 + Math.random() * 900000));
    setProfileStatus('OTP पाठवत आहोत…', 'info');

    if (!window.emailjs) {
        setProfileStatus('OTP सेवा उपलब्ध नाही. कृपया पुन्हा प्रयत्न करा.', 'error');
        return;
    }

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: customerProfile.email,
        email: customerProfile.email,
        user_email: customerProfile.email,
        otp_code: profileOtpCode,
        message: 'Your Gharmitra profile update OTP is: ' + profileOtpCode
    }).then(() => {
        document.getElementById('profileOtpArea').classList.remove('hidden');
        document.getElementById('profileSaveBtn').classList.add('hidden');
        setProfileStatus('OTP तुमच्या जुन्या email वर पाठवला आहे. तो टाकून बदल save करा.', 'success');
        document.getElementById('profileOtp').focus();
    }).catch(error => {
        console.error('Profile OTP error:', error);
        pendingProfileChanges = null;
        profileOtpCode = null;
        setProfileStatus('OTP पाठवता आला नाही. EmailJS setup तपासा आणि पुन्हा प्रयत्न करा.', 'error');
    });
}

function verifyProfileOtp() {
    const enteredOtp = document.getElementById('profileOtp').value.replace(/\D/g, '');
    if (!pendingProfileChanges || !profileOtpCode) {
        setProfileStatus('आधी Save Profile दाबून OTP मागवा.', 'error');
        return;
    }
    if (enteredOtp !== profileOtpCode) {
        setProfileStatus('OTP चुकीचा आहे. जुन्या email मधील OTP पुन्हा तपासा.', 'error');
        return;
    }

    writeCustomerProfile(pendingProfileChanges.profile, pendingProfileChanges.previousMobile);
    pendingProfileChanges = null;
    profileOtpCode = null;
    document.getElementById('profileOtpArea').classList.add('hidden');
    setProfileStatus('Profile सुरक्षितपणे अपडेट झाले. Booking form मध्ये नवीन details दिसतील.', 'success');
    setTimeout(closeProfileModal, 1000);
}

document.getElementById('bookingDate').valueAsDate = new Date();
populateBookingProfile();

        function ensureWorkerLiveMap() {
            if (workerLiveMap) {
                setTimeout(() => workerLiveMap.invalidateSize(), 50);
                return;
            }

            workerLiveMap = L.map('workerLiveMap', {
                zoomControl: true,
                attributionControl: true
            }).setView([18.5204, 73.8567], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(workerLiveMap);

            workerLocationPath = L.polyline([], {
                color: '#6366f1',
                weight: 4,
                opacity: 0.7
            }).addTo(workerLiveMap);

            setTimeout(() => workerLiveMap.invalidateSize(), 100);
        }

        function stopWorkerLocationTracking() {
            if (activeLocationOrderId && workerLocationListener) {
                database.ref("orders/" + activeLocationOrderId + "/workerLocation")
                    .off("value", workerLocationListener);
            }

            activeLocationOrderId = null;
            workerLocationListener = null;
            if (workerLiveMarker && workerLiveMap) {
                workerLiveMap.removeLayer(workerLiveMarker);
            }
            workerLiveMarker = null;
            workerPathPoints = [];

            if (workerLocationPath) {
                workerLocationPath.setLatLngs([]);
            }

            const etaEl = document.getElementById('workerEta');
            if (etaEl) etaEl.innerText = "--";
        }

        function updateWorkerLiveLocation(location) {
            const locationMeta = document.getElementById('workerLocationUpdated');
            const accuracyMeta = document.getElementById('workerLocationAccuracy');
            const etaEl = document.getElementById('workerEta');

            if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) {
                locationMeta.innerText = "Location waiting...";
                accuracyMeta.innerText = "Worker location मिळत आहे...";
                return;
            }

            const latLng = [Number(location.lat), Number(location.lng)];
            ensureWorkerLiveMap();

            if (!workerLiveMarker) {
                workerLiveMarker = L.marker(latLng, {
                    icon: L.divIcon({
                        className: '',
                        html: '<div class="live-location-pulse"></div>',
                        iconSize: [18, 18],
                        iconAnchor: [9, 9]
                    })
                }).addTo(workerLiveMap);
            } else {
                workerLiveMarker.setLatLng(latLng);
            }

            const lastPoint = workerPathPoints[workerPathPoints.length - 1];
            if (!lastPoint || lastPoint[0] !== latLng[0] || lastPoint[1] !== latLng[1]) {
                workerPathPoints.push(latLng);
                if (workerPathPoints.length > 80) workerPathPoints.shift();
                workerLocationPath?.setLatLngs(workerPathPoints);
            }

            const trackMapBtn = document.getElementById('trackMapBtn');
            if (trackMapBtn) {
                trackMapBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${latLng[0]},${latLng[1]}&travelmode=driving`;
            }

            workerLiveMap.setView(latLng, Math.max(workerLiveMap.getZoom(), 15), {
                animate: true,
                duration: 0.5
            });

            const updatedAt = Number(location.updatedAt);
            locationMeta.innerText = Number.isFinite(updatedAt) && updatedAt > 0
                ? "Updated " + new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : "Live location";
            if (etaEl) {
                etaEl.innerText = Number.isFinite(Number(location.etaMinutes))
                    ? Math.max(1, Math.round(Number(location.etaMinutes))) + " min"
                    : "Live";
            }
            accuracyMeta.innerText = location.accuracy
                ? "Accuracy ±" + Math.round(Number(location.accuracy)) + " m"
                : "Live GPS location";
        }

        function startWorkerLocationTracking(orderId) {
            if (!orderId) return;
            ensureWorkerLiveMap();

            if (activeLocationOrderId === orderId && workerLocationListener) {
                return;
            }

            stopWorkerLocationTracking();
            activeLocationOrderId = orderId;
            const locationRef = database.ref("orders/" + orderId + "/workerLocation");

            workerLocationListener = snapshot => {
                updateWorkerLiveLocation(snapshot.val());
            };
            locationRef.on("value", workerLocationListener);
        }

        function setRating(rating) {
            selectedRating = rating;
            const stars = document.querySelectorAll('#starContainer i');
            stars.forEach((star, index) => {
                if (index < rating) {
                    star.classList.remove('text-slate-300');
                    star.classList.add('text-amber-400', 'fa-solid');
                } else {
                    star.classList.remove('text-amber-400', 'fa-solid');
                    star.classList.add('text-slate-300', 'fa-solid');
                }
            });
        }

        function submitWorkerRating() {
            if (!currentOrderId) return;

            database.ref("orders/" + currentOrderId).once("value", (snapshot) => {
                const orderData = snapshot.val();
                if (!orderData || !orderData.workerId) {
                    closeRatingModal();
                    return;
                }

                const workerId = orderData.workerId;
                const reviewText = document.getElementById('reviewComment').value;

                const ratingRef = database.ref("workers/" + workerId + "/ratings").push();
                ratingRef.set({
                    rating: selectedRating,
                    review: reviewText,
                    customerName: orderData.customerName,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                }).then(() => {
                    alert("रेटिंग यशस्वीरीत्या सबमिट झाले! धन्यवाद.");
                    closeRatingModal();
                });
            });
        }

        function closeRatingModal() {
            document.getElementById('ratingModal').classList.remove('flex');
            document.getElementById('ratingModal').classList.add('hidden');
        }

        function escapeChatText(value) {
            return String(value || '').replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[character]));
        }

        function renderCustomerChatMessages(messages) {
            const chatBox = document.getElementById('customerChatMessagesContainer');
            if (!chatBox) return;

            chatBox.innerHTML = "";
            const messageList = messages
                ? Object.values(messages).sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
                : [];

            if (!messageList.length) {
                chatBox.innerHTML = '<p class="text-center text-slate-400 py-4">अद्याप कोणताही मेसेज नाही.</p>';
                return;
            }

            messageList.forEach(message => {
                const isMe = message.sender === 'customer';
                const time = Number(message.timestamp)
                    ? new Date(Number(message.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';
                chatBox.innerHTML += `<div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[78%] p-2.5 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'}">
                        <p class="break-words">${escapeChatText(message.text)}</p>
                        ${time ? `<span class="block text-[9px] mt-1 ${isMe ? 'text-blue-100' : 'text-slate-400'}">${time}</span>` : ''}
                    </div>
                </div>`;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        function openCustomerChatModal(orderId) {
            if (!orderId) return;

            database.ref('orders/' + orderId).once('value').then(snapshot => {
                const order = snapshot.val();
                if (!order || !['Accepted', 'On The Way'].includes(order.status)) {
                    alert("Worker ने order accept केल्यानंतरच chat सुरू करता येईल.");
                    return;
                }

                if (activeCustomerChatOrderId && activeCustomerChatListener) {
                    database.ref('orders/' + activeCustomerChatOrderId + '/chats')
                        .off('value', activeCustomerChatListener);
                }

                activeCustomerChatOrderId = orderId;
                document.getElementById('customerChatModal').classList.remove('hidden');
                document.getElementById('customerChatModal').classList.add('flex');

                const chatRef = database.ref('orders/' + orderId + '/chats');
                activeCustomerChatListener = snapshot => renderCustomerChatMessages(snapshot.val());
                chatRef.on('value', activeCustomerChatListener);
                document.getElementById('customerChatInputMsg')?.focus();
            });
        }

        function closeCustomerChatModal() {
            if (activeCustomerChatOrderId && activeCustomerChatListener) {
                database.ref('orders/' + activeCustomerChatOrderId + '/chats')
                    .off('value', activeCustomerChatListener);
            }
            activeCustomerChatOrderId = null;
            activeCustomerChatListener = null;
            document.getElementById('customerChatModal').classList.remove('flex');
            document.getElementById('customerChatModal').classList.add('hidden');
        }

        function sendCustomerChatMessage() {
            const input = document.getElementById('customerChatInputMsg');
            const text = input?.value.trim();
            if (!text || !activeCustomerChatOrderId) return;

            database.ref('orders/' + activeCustomerChatOrderId).once('value').then(snapshot => {
                const order = snapshot.val();
                if (!order || !['Accepted', 'On The Way'].includes(order.status)) {
                    closeCustomerChatModal();
                    alert("ही order पूर्ण झाली आहे. Chat बंद करण्यात आला आहे.");
                    return;
                }

                return database.ref('orders/' + activeCustomerChatOrderId + '/chats').push({
                    sender: 'customer',
                    senderName: order.customerName || 'Customer',
                    text,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            }).then(() => {
                if (input) input.value = "";
            }).catch(error => {
                console.error("Customer chat error:", error);
                alert("मेसेज पाठवताना अडचण आली.");
            });
        }

        async function handleFormSubmit(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking in progress...';

            const service = document.getElementById('serviceSelect').value;
            const name = document.getElementById('customerName').value;
            const mobile = document.getElementById('customerMobile').value;
            const area = document.getElementById('areaSelect').value;
            const address = document.getElementById('customerAddress').value;
            const budget = document.getElementById('budgetInput').value;
            const date = document.getElementById('bookingDate').value;
            const time = document.getElementById('bookingTime').value;
            const photoInput = document.getElementById('jobPhoto');

            let photoUrl = "";

            try {
                if (photoInput.files && photoInput.files.length > 0) {
                    const file = photoInput.files[0];
                    const formData = new FormData();
                    formData.append("image", file);

                    const apiKey = "d541e208822d67e4ed1fc4244d04c0c3"; 
                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                        method: "POST",
                        body: formData
                    });

                    const result = await response.json();
                    if (result.success) {
                        photoUrl = result.data.url; 
                    }
                }

                const newOrderRef = database.ref("orders").push();
                currentOrderId = newOrderRef.key;

                const payload = {
                    service: service,
                    customerName: name,
                    customerMobile: mobile,
                    area: area,
                    address: address,
                    budget: "₹" + budget,
                    date: date,
                    time: time,
                    photoUrl: photoUrl,
                    status: "Pending",
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };

                await newOrderRef.set(payload);
                alert("तुमची अपॉइंटमेंट यशस्वीरीत्या बुक झाली आहे!");
                trackLiveStatus(currentOrderId);

            } catch (err) {
                console.error("Booking Error:", err);
                alert("बुकिंग करताना अडचण आली: " + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Book Appointment Now';
            }
        }

        function trackLiveStatus(orderId) {
            currentOrderId = orderId;

            if (activeListener) {
                database.ref("orders/" + activeListener).off();
            }
            activeListener = orderId;

            database.ref("orders/" + orderId).on("value", (snapshot) => {
                const data = snapshot.val();
                if(!data) return;

                document.getElementById('statusService').innerText = data.service || "-";
                document.getElementById('statusBudget').innerText = data.budget ? data.budget.replace('₹', '') : "-";
                document.getElementById('statusAddress').innerText = data.address || "-";

                const badgeEl = document.getElementById('statusBadge');
                const badgeTextEl = document.getElementById('statusBadgeText');
                const stepsContainer = document.getElementById('stepsTrackerContainer');
                const completedMsgBox = document.getElementById('completedOrCancelledMsg');
                const cancelContainer = document.getElementById('cancelContainer');
                const workerMobileEl = document.getElementById('statusWorker');
                const ratingDisplay = document.getElementById('statusWorkerRating');
                const mapContainer = document.getElementById('mapTrackingContainer');
                const trackMapBtn = document.getElementById('trackMapBtn');
                const customerChatAction = document.getElementById('customerChatAction');

                let workerInfo = "Verified Worker Assigned";
                if (data.workerMobile) {
                    workerInfo = data.workerMobile;
                } else if (data.workerId) {
                    workerInfo = data.workerId;
                }

                if (data.workerId) {
                    database.ref("workers/" + data.workerId).once("value", (workerSnap) => {
                        const workerData = workerSnap.val();
                        if (workerData && workerData.ratings) {
                            let total = 0, count = 0;
                            Object.values(workerData.ratings).forEach(r => {
                                total += Number(r.rating);
                                count++;
                            });
                            let avg = (total / count).toFixed(1);
                            ratingDisplay.innerText = `${avg} (${count} reviews)`;
                        } else {
                            ratingDisplay.innerText = "New Worker (No ratings yet)";
                        }
                    });
                } else {
                    ratingDisplay.innerText = "Not assigned yet";
                }

                const canChat = data.status === 'Accepted' || data.status === 'On The Way';
                if (customerChatAction) {
                    customerChatAction.classList.toggle('hidden', !canChat);
                }
                if (!canChat && activeCustomerChatOrderId) {
                    closeCustomerChatModal();
                }

                // Swiggy-style live moving location handling. The worker
                // publishes GPS coordinates under this order in Firebase.
                if (data.status === 'On The Way') {
                    mapContainer.classList.remove('hidden');
                    startWorkerLocationTracking(orderId);
                    const workerLocation = data.workerLocation;
                    if (workerLocation && workerLocation.lat && workerLocation.lng) {
                        trackMapBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${workerLocation.lat},${workerLocation.lng}&travelmode=driving`;
                    } else {
                        trackMapBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.area + ', Pune')}`;
                    }
                } else {
                    mapContainer.classList.add('hidden');
                    stopWorkerLocationTracking();
                }

                if (data.status === 'Completed' || data.status === 'Cancelled') {
                    stepsContainer.classList.add('hidden');
                    cancelContainer.classList.add('hidden');
                    completedMsgBox.classList.remove('hidden');
                    mapContainer.classList.add('hidden');

                    if (data.status === 'Completed') {
                        badgeEl.className = "bg-emerald-100 text-emerald-700 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1";
                        badgeTextEl.innerText = "Work Completed";
                        workerMobileEl.innerText = workerInfo;
                        document.getElementById('finishedIcon').innerText = "🎉";
                        document.getElementById('finishedTitle').innerText = "Order Completed Successfully";

                        if (!data.isRated) {
                            document.getElementById('ratingModal').classList.remove('hidden');
                            document.getElementById('ratingModal').classList.add('flex');
                            database.ref("orders/" + orderId).update({ isRated: true });
                        }
                    } else {
                        badgeEl.className = "bg-red-100 text-red-700 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1";
                        badgeTextEl.innerText = "Order Cancelled";
                        workerMobileEl.innerText = "Cancelled";
                        document.getElementById('finishedIcon').innerText = "❌";
                        document.getElementById('finishedTitle').innerText = "Order Was Cancelled";
                    }
                } 
                else {
                    stepsContainer.classList.remove('hidden');
                    completedMsgBox.classList.add('hidden');
                    cancelContainer.classList.remove('hidden');

                    document.getElementById('step1Dot').className = "w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                    document.getElementById('step2Dot').className = "w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                    document.getElementById('step3Dot').className = "w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                    document.getElementById('step4Dot').className = "w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";

                    if (data.status === 'Pending') {
                        badgeEl.className = "bg-amber-100 text-amber-700 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1";
                        badgeTextEl.innerText = "Finding Worker";
                        workerMobileEl.innerText = "Finding Worker...";
                        document.getElementById('step1Dot').className = "w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                    } 
                    else if (data.status === 'Accepted') {
                        badgeEl.className = "bg-blue-100 text-blue-700 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1";
                        badgeTextEl.innerText = "Worker Accepted";
                        workerMobileEl.innerText = workerInfo;
                        document.getElementById('step1Dot').className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                        document.getElementById('step2Dot').className = "w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                    } 
                    else if (data.status === 'On The Way') {
                        badgeEl.className = "bg-indigo-100 text-indigo-700 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1";
                        badgeTextEl.innerText = "Worker On The Way";
                        workerMobileEl.innerText = workerInfo;
                        document.getElementById('step1Dot').className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                        document.getElementById('step2Dot').className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                        document.getElementById('step3Dot').className = "w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                    }
                }
            });
        }

        function cancelCurrentOrder() {
            if (!currentOrderId) {
                alert("सध्या कोणतीही सक्रिय ऑर्डर उपलब्ध नाही!");
                return;
            }

            database.ref("orders/" + currentOrderId).once("value", (snapshot) => {
                const data = snapshot.val();
                if (!data) return;

                if (data.status === 'On The Way') {
                    alert("❌ ऑर्डर कॅन्सल करता येणार नाही! Worker निघाला आहे (Worker is On The Way).");
                } else if (data.status === 'Completed') {
                    alert("❌ हे काम पूर्ण झाले आहे, त्यामुळे कॅन्सल करता येणार नाही.");
                } else {
                    if (confirm("तुम्हाला नक्की ही ऑर्डर रद्द (Cancel) करायची आहे का?")) {
                        database.ref("orders/" + currentOrderId).update({
                            status: "Cancelled"
                        }).then(() => {
                            alert("तुमची ऑर्डर यशस्वीरीत्या रद्द (Cancelled) झाली आहे.");
                        });
                    }
                }
            });
        }

        function openMyOrdersModal() {
            document.getElementById('myOrdersModal').classList.remove('hidden');
            document.getElementById('myOrdersModal').classList.add('flex');
            const formMobile = document.getElementById('customerMobile').value;
            if(formMobile) {
                document.getElementById('searchMobileInput').value = formMobile;
                fetchCustomerOrders();
            }
        }

        function closeMyOrdersModal() {
            document.getElementById('myOrdersModal').classList.remove('flex');
            document.getElementById('myOrdersModal').classList.add('hidden');
        }

        function fetchCustomerOrders() {
            const mobile = document.getElementById('searchMobileInput').value.trim();
            const container = document.getElementById('ordersListContainer');

            if (!mobile || mobile.length !== 10) {
                alert("कृपया अचूक १० अंकी मोबाईल नंबर प्रविष्ट करा!");
                return;
            }

            container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin"></i> Fetching orders...</p>';

            database.ref("orders").orderByChild("customerMobile").equalTo(mobile).once("value", (snapshot) => {
                container.innerHTML = "";
                const orders = snapshot.val();

                if (!orders) {
                    container.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">या मोबाईल नंबरवर कोणतीही ऑर्डर सापडली नाही.</p>';
                    return;
                }

                Object.keys(orders).reverse().forEach(orderId => {
                    const order = orders[orderId];
                    let badgeColor = "bg-amber-100 text-amber-700";
                    if(order.status === 'Accepted') badgeColor = "bg-blue-100 text-blue-700";
                    if(order.status === 'On The Way') badgeColor = "bg-indigo-100 text-indigo-700";
                    if(order.status === 'Completed') badgeColor = "bg-emerald-100 text-emerald-700";
                    if(order.status === 'Cancelled') badgeColor = "bg-red-100 text-red-700";

                    const card = document.createElement('div');
                    card.className = "bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 text-xs hover:border-blue-400 transition cursor-pointer";
                    card.innerHTML = `
                        <div class="flex items-center justify-between border-b pb-2 border-slate-200">
                            <span class="font-bold text-slate-800 text-sm"><i class="fa-solid fa-wrench text-blue-600"></i> ${order.service}</span>
                            <span class="px-2.5 py-1 rounded-full font-bold text-[10px] ${badgeColor}">${order.status}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                            <p><strong>Name:</strong> ${order.customerName}</p>
                            <p><strong>Budget:</strong> <span class="text-emerald-600 font-bold">${order.budget}</span></p>
                            <p><strong>Date:</strong> ${order.date} (${order.time})</p>
                            <p><strong>Area:</strong> ${order.area}</p>
                        </div>
                        <p class="text-slate-500 truncate"><strong>Address:</strong> ${order.address}</p>
                        <div class="text-right pt-1">
                            <button onclick="trackSelectedOrder('${orderId}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] transition">
                                <i class="fa-solid fa-eye"></i> Track Live Status
                            </button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }, (error) => {
                console.error("Fetch Error:", error);
                container.innerHTML = '<p class="text-xs text-red-500 text-center py-6">डेटा आणताना एरर आली.</p>';
            });
        }

        function trackSelectedOrder(orderId) {
            closeMyOrdersModal();
            trackLiveStatus(orderId);
        }
