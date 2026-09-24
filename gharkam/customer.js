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

let currentOrderId = null;
        let activeListener = null;
        let workerLocationListener = null;
        let activeLocationOrderId = null;
        let workerLiveMap = null;
        let workerLiveMarker = null;
        let workerCustomerMarker = null;
        let workerRouteLine = null;
        let workerLocationPath = null;
        let workerPathPoints = [];
        let currentOrderCustomerCoords = null;
        let currentTrackedOrder = null;

// Pune Area Coordinates for delivery routing
const PUNE_AREA_COORDINATES = {
    "Swargate": { lat: 18.5018, lng: 73.8636 },
    "Hadapsar": { lat: 18.5089, lng: 73.9259 },
    "Katraj": { lat: 18.4575, lng: 73.8677 },
    "Kothrud": { lat: 18.5074, lng: 73.8077 },
    "Baner": { lat: 18.5590, lng: 73.7868 },
    "Wakad": { lat: 18.5987, lng: 73.7661 },
    "Hinjawadi": { lat: 18.5913, lng: 73.7389 },
    "Viman Nagar": { lat: 18.5679, lng: 73.9143 },
    "Kharadi": { lat: 18.5516, lng: 73.9348 },
    "Aundh": { lat: 18.5626, lng: 73.8087 },
    "Shivajinagar": { lat: 18.5314, lng: 73.8446 },
    "Koregaon Park": { lat: 18.5362, lng: 73.8940 },
    "Kondhwa": { lat: 18.4695, lng: 73.8890 },
    "Bibwewadi": { lat: 18.4692, lng: 73.8617 },
    "Dhankawadi": { lat: 18.4682, lng: 73.8519 },
    "Pimple Saudagar": { lat: 18.5987, lng: 73.7978 },
    "Pimpri": { lat: 18.6298, lng: 73.7997 },
    "Chinchwad": { lat: 18.6276, lng: 73.7823 },
    "Yerawada": { lat: 18.5529, lng: 73.8797 },
    "Wagholi": { lat: 18.5793, lng: 73.9822 },
    "Dhanori": { lat: 18.5833, lng: 73.8889 },
    "Lohegaon": { lat: 18.5878, lng: 73.9189 },
    "Camp": { lat: 18.5167, lng: 73.8789 },
    "Deccan": { lat: 18.5173, lng: 73.8417 },
    "Sinhagad Road": { lat: 18.4831, lng: 73.8298 },
    "Warje": { lat: 18.4820, lng: 73.8000 },
    "Bavdhan": { lat: 18.5158, lng: 73.7690 },
    "NIBM": { lat: 18.4795, lng: 73.8996 },
    "Vishrantwadi": { lat: 18.5684, lng: 73.8770 },
    "Magarpatta": { lat: 18.5144, lng: 73.9298 }
};

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1.3;
}

function formatDistance(distKm) {
    if (!Number.isFinite(distKm) || distKm <= 0) return "--";
    if (distKm < 1) {
        return Math.round(distKm * 1000) + " मी";
    }
    return distKm.toFixed(1) + " किमी";
}

function calculateEtaMinutes(distKm) {
    if (!Number.isFinite(distKm) || distKm <= 0) return 1;
    const speedKmPerHour = 22;
    return Math.max(1, Math.round((distKm / speedKmPerHour) * 60) + 1);
}

function getOrderCustomerCoords(orderData) {
    if (!orderData) return { lat: 18.5204, lng: 73.8567 };
    if (orderData.customerLocation && Number.isFinite(Number(orderData.customerLocation.lat)) && Number.isFinite(Number(orderData.customerLocation.lng))) {
        return { lat: Number(orderData.customerLocation.lat), lng: Number(orderData.customerLocation.lng) };
    }
    if (Number.isFinite(Number(orderData.customerLat)) && Number.isFinite(Number(orderData.customerLng))) {
        return { lat: Number(orderData.customerLat), lng: Number(orderData.customerLng) };
    }
    if (orderData.area && PUNE_AREA_COORDINATES[orderData.area]) {
        return PUNE_AREA_COORDINATES[orderData.area];
    }
    return { lat: 18.5204, lng: 73.8567 };
}

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

    // Sync updated customer profile to Firebase Realtime Database
    if (typeof database !== 'undefined' && profile && profile.mobile) {
        const cleanMobile = String(profile.mobile).replace(/\D/g, '').slice(-10);
        database.ref('workers/accounts/customers/' + cleanMobile).update({
            fullName: profile.fullName || profile.name || '',
            name: profile.name || profile.fullName || '',
            email: profile.email || '',
            mobile: cleanMobile,
            role: 'customer',
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        }).catch(e => console.warn('Customer cloud update:', e));
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
            const mapEl = document.getElementById('workerLiveMap');
            if (!mapEl) return;

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
                weight: 3,
                opacity: 0.5
            }).addTo(workerLiveMap);

            setTimeout(() => workerLiveMap?.invalidateSize(), 100);
        }

        function stopWorkerLocationTracking() {
            if (activeLocationOrderId && workerLocationListener) {
                database.ref("orders/" + activeLocationOrderId + "/workerLocation")
                    .off("value", workerLocationListener);
            }

            activeLocationOrderId = null;
            workerLocationListener = null;

            if (workerLiveMap) {
                if (workerLiveMarker) {
                    workerLiveMap.removeLayer(workerLiveMarker);
                }
                if (workerCustomerMarker) {
                    workerLiveMap.removeLayer(workerCustomerMarker);
                }
                if (workerRouteLine) {
                    workerLiveMap.removeLayer(workerRouteLine);
                }
            }

            workerLiveMarker = null;
            workerCustomerMarker = null;
            workerRouteLine = null;
            workerPathPoints = [];

            if (workerLocationPath) {
                workerLocationPath.setLatLngs([]);
            }

            const etaEl = document.getElementById('workerEta');
            if (etaEl) etaEl.innerText = "--";
            const distEl = document.getElementById('workerDistance');
            if (distEl) distEl.innerText = "--";
        }

        function updateWorkerLiveLocation(location) {
            const locationMeta = document.getElementById('workerLocationUpdated');
            const accuracyMeta = document.getElementById('workerLocationAccuracy');
            const etaEl = document.getElementById('workerEta');
            const distEl = document.getElementById('workerDistance');
            const trackMapBtn = document.getElementById('trackMapBtn');

            if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) {
                if (locationMeta) locationMeta.innerText = "Location waiting...";
                if (accuracyMeta) accuracyMeta.innerText = "Worker location मिळत आहे...";
                return;
            }

            ensureWorkerLiveMap();
            if (!workerLiveMap) return;

            const workerLatLng = [Number(location.lat), Number(location.lng)];
            const custCoords = currentOrderCustomerCoords || getOrderCustomerCoords(currentTrackedOrder);
            const custLatLng = [custCoords.lat, custCoords.lng];

            // 1. Worker Moving Marker (Scooter / Bike)
            if (!workerLiveMarker) {
                workerLiveMarker = L.marker(workerLatLng, {
                    icon: L.divIcon({
                        className: '',
                        html: `<div class="delivery-worker-marker">
                                 <div class="delivery-marker-pulse"></div>
                                 <div class="delivery-marker-icon worker-bike"><i class="fa-solid fa-motorcycle"></i></div>
                                 <div class="delivery-marker-label">कामगार (Worker)</div>
                               </div>`,
                        iconSize: [42, 42],
                        iconAnchor: [21, 21]
                    })
                }).addTo(workerLiveMap);
            } else {
                workerLiveMarker.setLatLng(workerLatLng);
            }

            // 2. Customer Home Marker
            if (!workerCustomerMarker) {
                workerCustomerMarker = L.marker(custLatLng, {
                    icon: L.divIcon({
                        className: '',
                        html: `<div class="delivery-home-marker">
                                 <div class="delivery-marker-icon home-pin"><i class="fa-solid fa-house-chimney"></i></div>
                                 <div class="delivery-marker-label">तुमचे घर (Home)</div>
                               </div>`,
                        iconSize: [40, 40],
                        iconAnchor: [20, 20]
                    })
                }).addTo(workerLiveMap);
            } else {
                workerCustomerMarker.setLatLng(custLatLng);
            }

            // 3. Route Polyline Connecting Worker to Customer Home
            const routePoints = [workerLatLng, custLatLng];
            if (!workerRouteLine) {
                workerRouteLine = L.polyline(routePoints, {
                    color: '#2563eb',
                    weight: 4,
                    opacity: 0.85,
                    dashArray: '7, 8'
                }).addTo(workerLiveMap);
            } else {
                workerRouteLine.setLatLngs(routePoints);
            }

            // 4. Auto-fit bounds so both Worker and Customer are visible together
            try {
                workerLiveMap.fitBounds([workerLatLng, custLatLng], {
                    padding: [45, 45],
                    maxZoom: 16
                });
            } catch(e) {}

            // 5. Distance and ETA calculations
            let distKm = Number(location.distanceKm);
            if (!Number.isFinite(distKm) || distKm <= 0) {
                distKm = calculateDistanceKm(workerLatLng[0], workerLatLng[1], custLatLng[0], custLatLng[1]);
            }
            let etaMin = Number(location.etaMinutes);
            if (!Number.isFinite(etaMin) || etaMin <= 0) {
                etaMin = calculateEtaMinutes(distKm);
            }
            const formattedDist = location.formattedDistance || formatDistance(distKm);

            if (distEl) {
                distEl.innerText = formattedDist;
            }
            if (etaEl) {
                etaEl.innerText = `~${etaMin} मिनिटे`;
            }
            if (locationMeta) {
                const updatedAt = Number(location.updatedAt);
                locationMeta.innerText = Number.isFinite(updatedAt) && updatedAt > 0
                    ? "Live • " + new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : "कामगार निघत आहे...";
            }
            if (accuracyMeta) {
                accuracyMeta.innerHTML = `<i class="fa-solid fa-satellite-dish text-emerald-500"></i> Worker Live GPS जोडलेले आहे` + (location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : '');
            }
            if (trackMapBtn) {
                trackMapBtn.href = `https://www.google.com/maps/dir/?api=1&origin=${workerLatLng[0]},${workerLatLng[1]}&destination=${custLatLng[0]},${custLatLng[1]}&travelmode=driving`;
            }
        }

        function startWorkerLocationTracking(orderId, orderData) {
            if (!orderId) return;
            if (orderData) {
                currentTrackedOrder = orderData;
                currentOrderCustomerCoords = getOrderCustomerCoords(orderData);
            }
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
                if (!orderData) {
                    closeRatingModal();
                    return;
                }

                const workerId = orderData.workerUid || orderData.workerId || (orderData.workerMobile ? 'local_worker_' + orderData.workerMobile : null);
                const reviewCommentEl = document.getElementById('reviewComment');
                const reviewText = reviewCommentEl ? reviewCommentEl.value.trim() : '';

                const ratingPayload = {
                    rating: selectedRating,
                    review: reviewText,
                    customerName: orderData.customerName || 'Customer',
                    customerMobile: orderData.customerMobile || orderData.phone || '',
                    orderId: currentOrderId,
                    service: orderData.service || orderData.workType || '',
                    workerName: orderData.workerName || '',
                    workerMobile: orderData.workerMobile || '',
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };

                // Update order record so customer order history and Admin portal reflect review status
                database.ref("orders/" + currentOrderId).update({
                    isRated: true,
                    customerRating: selectedRating,
                    customerReview: reviewText,
                    rating: selectedRating,
                    review: reviewText,
                    reviewedAt: firebase.database.ServerValue.TIMESTAMP
                });

                if (workerId) {
                    const ratingRef = database.ref("workers/" + workerId + "/ratings").push();
                    ratingRef.set(ratingPayload).then(() => {
                        // Recalculate worker's aggregated rating and review count
                        database.ref("workers/" + workerId + "/ratings").once("value", (snap) => {
                            const ratingsVal = snap.val() || {};
                            const rList = Object.values(ratingsVal);
                            const count = rList.length;
                            const sum = rList.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
                            const avg = count > 0 ? Number((sum / count).toFixed(1)) : 5.0;

                            database.ref("workers/" + workerId).update({
                                rating: avg,
                                totalReviews: count
                            });
                        });
                    }).catch(err => {
                        console.warn("Could not save to worker ratings node:", err);
                    });
                }

                alert("तुमचा अभिप्राय यशस्वीरीत्या सबमिट झाला! धन्यवाद.");
                if (reviewCommentEl) reviewCommentEl.value = '';
                closeRatingModal();
            });
        }

        function openOrderRating(orderId) {
            currentOrderId = orderId;
            closeMyOrdersModal();
            setRating(5);
            const reviewCommentEl = document.getElementById('reviewComment');
            if (reviewCommentEl) reviewCommentEl.value = '';
            document.getElementById('ratingModal').classList.remove('hidden');
            document.getElementById('ratingModal').classList.add('flex');
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
                    // Validate file size (max 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        alert("कृपया ५ MB पेक्षा लहान फोटो निवडा.");
                        return;
                    }
                    // Validate file MIME type
                    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
                    if (!allowedMimes.includes(file.type.toLowerCase())) {
                        alert("कृपया केवळ वैध फोटो फाइल निवडा (JPG, PNG किंवा WEBP).");
                        return;
                    }
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

                let customerEmail = (customerProfile && customerProfile.email) ? customerProfile.email : "";
                if (!customerEmail) {
                    const savedUser = localStorage.getItem('gharmitra_user_customer_' + mobile) || localStorage.getItem('gharmitra_user_' + mobile);
                    if (savedUser) {
                        try { customerEmail = JSON.parse(savedUser).email || ""; } catch(e) {}
                    }
                }

                const payload = {
                    service: service,
                    customerName: name,
                    customerMobile: mobile,
                    customerEmail: customerEmail,
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

            const statusCol = document.getElementById('customerLiveStatusColumn');
            if (statusCol) {
                statusCol.classList.remove('hidden');
                statusCol.classList.add('show-tracking');
            }

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
                const customerCommActions = document.getElementById('customerCommActions');
                const customerChatAction = document.getElementById('customerChatAction');
                const callWorkerBtn = document.getElementById('customerCallWorkerBtn');
                const workerNumDisplay = document.getElementById('customerWorkerNumberDisplay');

                let rawWorkerMobile = data.workerMobile || '';
                let maskedWorkerNumber = window.GharmitraCallMasking
                    ? window.GharmitraCallMasking.maskDisplayNumber(rawWorkerMobile)
                    : (rawWorkerMobile ? '+91 ••••• ••' + String(rawWorkerMobile).slice(-3) : 'Not available');

                let workerDisplayName = data.workerName || "Verified Partner";
                let workerInfo = `${workerDisplayName} • <span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200"><i class="fa-solid fa-shield-halved"></i> ${maskedWorkerNumber}</span>`;

                if (callWorkerBtn) {
                    if (rawWorkerMobile) {
                        const cleanNum = String(rawWorkerMobile).replace(/[^\d+]/g, '');
                        callWorkerBtn.href = cleanNum.startsWith('+') ? `tel:${cleanNum}` : `tel:+91${cleanNum.slice(-10)}`;
                        callWorkerBtn.classList.remove('opacity-50', 'pointer-events-none');
                    } else {
                        callWorkerBtn.href = "#";
                        callWorkerBtn.classList.add('opacity-50', 'pointer-events-none');
                    }
                }
                if (workerNumDisplay) {
                    workerNumDisplay.innerHTML = `<i class="fa-solid fa-shield-halved text-[9px]"></i> ${maskedWorkerNumber} • थेट फोन कॉल`;
                }

                const targetWorkerId = data.workerUid || data.workerId || (data.workerMobile ? 'local_worker_' + data.workerMobile : null);
                if (targetWorkerId) {
                    database.ref("workers/" + targetWorkerId).once("value", (workerSnap) => {
                        const workerData = workerSnap.val();
                        if (workerData && workerData.ratings) {
                            let total = 0, count = 0;
                            Object.values(workerData.ratings).forEach(r => {
                                total += Number(r.rating);
                                count++;
                            });
                            let avg = count > 0 ? (total / count).toFixed(1) : "5.0";
                            ratingDisplay.innerText = `${avg} (${count} reviews)`;
                        } else if (workerData && (workerData.rating !== undefined || workerData.totalReviews !== undefined)) {
                            const r = Number(workerData.rating || 5.0).toFixed(1);
                            const c = Number(workerData.totalReviews || 0);
                            ratingDisplay.innerText = `${r} (${c} reviews)`;
                        } else {
                            ratingDisplay.innerText = "New Worker (No ratings yet)";
                        }
                    });
                } else {
                    ratingDisplay.innerText = "Not assigned yet";
                }

                const canCommunicate = data.status === 'Accepted' || data.status === 'On The Way';
                if (customerCommActions) {
                    customerCommActions.classList.toggle('hidden', !canCommunicate);
                } else if (customerChatAction) {
                    customerChatAction.classList.toggle('hidden', !canCommunicate);
                }



                if (!canCommunicate && activeCustomerChatOrderId) {
                    closeCustomerChatModal();
                }

                // Swiggy-style live moving location handling. The worker
                // publishes GPS coordinates under this order in Firebase.
                if (data.status === 'On The Way') {
                    mapContainer.classList.remove('hidden');
                    currentTrackedOrder = data;
                    currentOrderCustomerCoords = getOrderCustomerCoords(data);
                    startWorkerLocationTracking(orderId, data);
                    if (data.workerLocation) {
                        updateWorkerLiveLocation(data.workerLocation);
                    }
                } else {
                    mapContainer.classList.add('hidden');
                    stopWorkerLocationTracking();
                }

                const otpCard = document.getElementById('customerCompletionOtpCard');
                const otpDisplay = document.getElementById('customerOtpCodeDisplay');
                if (data.completionOtp && data.status !== 'Completed' && data.status !== 'Cancelled') {
                    if (otpCard) otpCard.classList.remove('hidden');
                    if (otpDisplay) otpDisplay.innerText = data.completionOtp;
                } else {
                    if (otpCard) otpCard.classList.add('hidden');
                }

                if (data.status === 'Completed' || data.status === 'Cancelled') {
                    if (otpCard) otpCard.classList.add('hidden');
                    stepsContainer.classList.add('hidden');
                    cancelContainer.classList.add('hidden');
                    completedMsgBox.classList.remove('hidden');
                    mapContainer.classList.add('hidden');

                    if (data.status === 'Completed') {
                        badgeEl.className = "bg-emerald-100 text-emerald-700 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1";
                        badgeTextEl.innerText = "Work Completed";
                        workerMobileEl.innerHTML = workerInfo;
                        document.getElementById('finishedIcon').innerText = "🎉";
                        document.getElementById('finishedTitle').innerText = "Order Completed Successfully";

                        if (!data.isRated && !window['ratingPrompted_' + orderId]) {
                            window['ratingPrompted_' + orderId] = true;
                            document.getElementById('ratingModal').classList.remove('hidden');
                            document.getElementById('ratingModal').classList.add('flex');
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
                        workerMobileEl.innerHTML = workerInfo;
                        document.getElementById('step1Dot').className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                        document.getElementById('step2Dot').className = "w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                    } 
                    else if (data.status === 'On The Way') {
                        badgeEl.className = "bg-indigo-100 text-indigo-700 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1";
                        badgeTextEl.innerText = "Worker On The Way";
                        workerMobileEl.innerHTML = workerInfo;
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

        function getLoggedInCustomerMobile() {
            let mob = '';
            try {
                if (typeof customerProfile !== 'undefined' && customerProfile && customerProfile.mobile) {
                    mob = String(customerProfile.mobile).replace(/\D/g, '').slice(-10);
                }
            } catch(e) {}
            if (!mob || mob.length !== 10) {
                try {
                    const session = readCustomerSession();
                    if (session && session.mobile) {
                        mob = String(session.mobile).replace(/\D/g, '').slice(-10);
                    }
                } catch(e) {}
            }
            if (!mob || mob.length !== 10) {
                const el = document.getElementById('customerMobile');
                if (el && el.value) {
                    mob = String(el.value).replace(/\D/g, '').slice(-10);
                }
            }
            if (!mob || mob.length !== 10) {
                try {
                    const raw = JSON.parse(localStorage.getItem('current_user_session') || '{}');
                    if (raw && raw.mobile) {
                        mob = String(raw.mobile).replace(/\D/g, '').slice(-10);
                    }
                } catch(e) {}
            }
            if (!mob || mob.length !== 10) {
                const fallback = localStorage.getItem('gharmitra_customer_mobile') || localStorage.getItem('customer_mobile') || '';
                if (fallback) mob = String(fallback).replace(/\D/g, '').slice(-10);
            }
            return mob;
        }

        function openMyOrdersModal() {
            const modal = document.getElementById('myOrdersModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
            const userMobile = getLoggedInCustomerMobile();
            const searchInput = document.getElementById('searchMobileInput');
            if (userMobile && userMobile.length === 10) {
                if (searchInput) searchInput.value = userMobile;
                fetchCustomerOrders();
            } else if (searchInput && searchInput.value.trim().length === 10) {
                fetchCustomerOrders();
            }
        }

        function closeMyOrdersModal() {
            const modal = document.getElementById('myOrdersModal');
            if (modal) {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
            }
        }

        function fetchCustomerOrders() {
            let mobile = document.getElementById('searchMobileInput').value.trim();
            if (!mobile || mobile.length !== 10) {
                const autoMob = getLoggedInCustomerMobile();
                if (autoMob && autoMob.length === 10) {
                    mobile = autoMob;
                    const searchInput = document.getElementById('searchMobileInput');
                    if (searchInput) searchInput.value = mobile;
                }
            }

            const container = document.getElementById('ordersListContainer');

            if (!mobile || mobile.length !== 10) {
                alert("कृपया अचूक १० अंकी मोबाईल नंबर प्रविष्ट करा!");
                return;
            }

            container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin"></i> ऑर्डर्स लोड होत आहेत...</p>';

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

                    const isCompleted = order.status === 'Completed';
                    const rateButtonHtml = isCompleted && !order.isRated ? `
                        <button onclick="openOrderRating('${orderId}')" class="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] transition flex items-center gap-1">
                            <i class="fa-solid fa-star text-[10px]"></i> Rate Worker
                        </button>
                    ` : '';

                    const card = document.createElement('div');
                    card.className = "bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 text-xs hover:border-blue-400 transition cursor-pointer";
                    card.innerHTML = `
                        <div class="flex items-center justify-between border-b pb-2 border-slate-200">
                            <span class="font-bold text-slate-800 text-sm"><i class="fa-solid fa-wrench text-blue-600"></i> ${escapeHtml(order.service)}</span>
                            <span class="px-2.5 py-1 rounded-full font-bold text-[10px] ${badgeColor}">${order.status}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                            <p><strong>Name:</strong> ${escapeHtml(order.customerName)}</p>
                            <p><strong>Budget:</strong> <span class="text-emerald-600 font-bold">${escapeHtml(order.budget)}</span></p>
                            <p><strong>Date:</strong> ${escapeHtml(order.date)} (${escapeHtml(order.time)})</p>
                            <p><strong>Area:</strong> ${escapeHtml(order.area)}</p>
                        </div>
                        <p class="text-slate-500 truncate"><strong>Address:</strong> ${escapeHtml(order.address)}</p>
                        <div class="text-right pt-1 flex items-center justify-end gap-2">
                            ${rateButtonHtml}
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
            const col = document.getElementById('customerLiveStatusColumn');
            if (col) {
                col.classList.remove('hidden');
                col.classList.add('show-tracking');
            }
            trackLiveStatus(orderId);
            setTimeout(() => {
                if (col) col.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        }
