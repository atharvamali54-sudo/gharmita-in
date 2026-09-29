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
                if (!order || !['Accepted', 'On The Way', 'In Progress'].includes(order.status)) {
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
                if (!order || !['Accepted', 'On The Way', 'In Progress'].includes(order.status)) {
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

                const whatsappOptIn = document.getElementById('whatsappOptIn') ? document.getElementById('whatsappOptIn').checked : true;
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
                    whatsappOptIn: whatsappOptIn,
                    startOtp: String(Math.floor(1000 + Math.random() * 9000)),
                    completionOtp: String(Math.floor(1000 + Math.random() * 9000)),
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
                const customerCommActions = document.getElementById('customerCommActions');
                const customerChatAction = document.getElementById('customerChatAction');
                const callWorkerBtn = document.getElementById('customerCallWorkerBtn');
                const workerNumDisplay = document.getElementById('customerWorkerNumberDisplay');

                let rawWorkerMobile = data.workerMobile || '';
                let maskedWorkerNumber = window.GharmitraCallMasking
                    ? window.GharmitraCallMasking.maskDisplayNumber(rawWorkerMobile)
                    : (rawWorkerMobile ? '+91 ••••• ••' + String(rawWorkerMobile).slice(-3) : 'Not available');

                let workerDisplayName = data.workerName || "Verified Partner";
                let workerPhotoHtml = (data.workerPhoto) ? `<img src="${data.workerPhoto}" class="w-6 h-6 rounded-full inline-block object-cover border border-amber-300 mr-1.5 shadow-sm align-middle" alt="Worker">` : `<i class="fa-solid fa-user-check text-emerald-600 mr-1"></i>`;
                let workerInfo = `${workerPhotoHtml}<strong>${workerDisplayName}</strong> • <span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200"><i class="fa-solid fa-shield-halved"></i> ${maskedWorkerNumber}</span>`;

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

                const canCommunicate = data.status === 'Accepted' || data.status === 'On The Way' || data.status === 'In Progress';
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
                if (data.status === 'On The Way' || data.status === 'In Progress') {
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

                // Security Start PIN Card (Active when Accepted or On The Way)
                const startOtpCard = document.getElementById('customerStartOtpCard');
                const startOtpDisplay = document.getElementById('customerStartOtpCodeDisplay');
                if (data.startOtp && (data.status === 'Accepted' || data.status === 'On The Way')) {
                    if (startOtpCard) startOtpCard.classList.remove('hidden');
                    if (startOtpDisplay) startOtpDisplay.innerText = data.startOtp;
                } else {
                    if (startOtpCard) startOtpCard.classList.add('hidden');
                }

                // Completion OTP Card (Active when In Progress)
                const otpCard = document.getElementById('customerCompletionOtpCard');
                const otpDisplay = document.getElementById('customerOtpCodeDisplay');
                if (data.completionOtp && data.status === 'In Progress') {
                    if (otpCard) otpCard.classList.remove('hidden');
                    if (otpDisplay) otpDisplay.innerText = data.completionOtp;
                } else {
                    if (otpCard) otpCard.classList.add('hidden');
                }

                // WhatsApp Track & PIN Quick Share Box
                const waTrackArea = document.getElementById('customerWhatsAppTrackArea');
                const waShareBtn = document.getElementById('customerTrackWhatsAppShareBtn');
                if (waTrackArea && waShareBtn) {
                    if (data.status !== 'Completed' && data.status !== 'Cancelled') {
                        waTrackArea.classList.remove('hidden');
                        const originUrl = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://gharmitra.online';
                        const liveTrackLink = `${originUrl}/gharkam/customer.html?track=${encodeURIComponent(orderId)}`;
                        const shareTxt = `नमस्कार! माझी घरमित्र ऑर्डर तपशील:\n📌 ऑर्डर आयडी: #${orderId.slice(-6).toUpperCase()}\n🛠️ सेवा: ${data.service || ''}\n🔐 सुरक्षा स्टार्ट पिन: ${data.startOtp || 'N/A'}\n📍 थेट ट्रॅकिंग लिंक: ${liveTrackLink}`;
                        waShareBtn.href = `https://wa.me/?text=${encodeURIComponent(shareTxt)}`;
                    } else {
                        waTrackArea.classList.add('hidden');
                    }
                }

                if (data.status === 'Completed' || data.status === 'Cancelled') {
                    if (startOtpCard) startOtpCard.classList.add('hidden');
                    if (otpCard) otpCard.classList.add('hidden');
                    if (waTrackArea) waTrackArea.classList.add('hidden');
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
                    const step5Dot = document.getElementById('step5Dot');
                    if (step5Dot) step5Dot.className = "w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";

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
                    else if (data.status === 'In Progress') {
                        badgeEl.className = "bg-amber-100 text-amber-800 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1";
                        badgeTextEl.innerText = "Work In Progress";
                        workerMobileEl.innerHTML = workerInfo;
                        document.getElementById('step1Dot').className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                        document.getElementById('step2Dot').className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                        document.getElementById('step3Dot').className = "w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
                        document.getElementById('step4Dot').className = "w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";
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

        // Helper to retrieve logged-in customer mobile number
        function getLoggedInCustomerMobile() {
            if (window.customerProfile && window.customerProfile.mobile) {
                return String(window.customerProfile.mobile).replace(/\D/g, '').slice(-10);
            }
            if (typeof readCustomerSession === 'function') {
                const s = readCustomerSession();
                if (s && s.mobile) return String(s.mobile).replace(/\D/g, '').slice(-10);
            }
            const formMob = document.getElementById('customerMobile')?.value?.trim();
            if (formMob && formMob.length >= 10) return formMob.replace(/\D/g, '').slice(-10);
            const profMob = document.getElementById('profileMobile')?.value?.trim();
            if (profMob && profMob.length >= 10) return profMob.replace(/\D/g, '').slice(-10);

            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('gharmitra_user_customer_') || key.startsWith('gharmitra_user_') || key === 'current_user_session')) {
                        const parsed = JSON.parse(localStorage.getItem(key));
                        if (parsed && parsed.mobile) {
                            return String(parsed.mobile).replace(/\D/g, '').slice(-10);
                        }
                    }
                }
            } catch(e) {}
            return '';
        }

        function openMyOrdersModal() {
            const modal = document.getElementById('myOrdersModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            const signedInMobile = getLoggedInCustomerMobile();
            const searchInput = document.getElementById('searchMobileInput');

            if (searchInput) {
                if (signedInMobile && signedInMobile.length === 10) {
                    searchInput.value = signedInMobile;
                    fetchCustomerOrders();
                } else if (searchInput.value && searchInput.value.replace(/\D/g, '').length === 10) {
                    fetchCustomerOrders();
                } else {
                    searchInput.focus();
                }
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
            const inputEl = document.getElementById('searchMobileInput');
            const container = document.getElementById('ordersListContainer');
            const searchBtn = document.getElementById('searchOrdersBtn');
            if (!container) return;

            const rawMobile = inputEl ? inputEl.value.trim() : '';
            const mobile = rawMobile.replace(/\D/g, '').slice(-10);

            if (!mobile || mobile.length !== 10) {
                alert("कृपया अचूक १० अंकी मोबाईल नंबर प्रविष्ट करा!");
                if (inputEl) inputEl.focus();
                return;
            }

            if (searchBtn) {
                searchBtn.disabled = true;
                searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Searching...</span>';
            }

            container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8"><i class="fa-solid fa-spinner fa-spin mr-1"></i> ऑर्डर्स शोधत आहोत...</p>';

            // Load orders and match by mobile
            database.ref("orders").once("value", (snapshot) => {
                if (searchBtn) {
                    searchBtn.disabled = false;
                    searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> <span>Search</span>';
                }

                const all = snapshot.val() || {};
                const matchedOrders = {};

                Object.keys(all).forEach(key => {
                    const ord = all[key];
                    if (!ord) return;
                    const ordMob = String(ord.customerMobile || '').replace(/\D/g, '').slice(-10);
                    if (ordMob === mobile) {
                        matchedOrders[key] = ord;
                    }
                });

                renderCustomerOrdersList(matchedOrders, mobile);

            }).catch(error => {
                console.error("Fetch Orders Error:", error);
                if (searchBtn) {
                    searchBtn.disabled = false;
                    searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> <span>Search</span>';
                }
                container.innerHTML = '<p class="text-xs text-red-500 text-center py-8">ऑर्डर्स लोड करताना अडचण आली: ' + escapeHtml(error.message) + '</p>';
            });
        }

        function renderCustomerOrdersList(orders, searchedMobile) {
            const container = document.getElementById('ordersListContainer');
            if (!container) return;
            container.innerHTML = '';

            const keys = Object.keys(orders || {});
            if (keys.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                            <i class="fa-solid fa-box-open"></i>
                        </div>
                        <p class="text-xs font-bold text-slate-700">मोबाईल नंबर ${escapeHtml(searchedMobile)} वर कोणतीही ऑर्डर सापडली नाही.</p>
                        <p class="text-[11px] text-slate-500">तुम्ही नवीन अपॉइंटमेंट बुक करू शकता.</p>
                        <button type="button" onclick="closeMyOrdersModal()" class="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition">
                            नवीन अपॉइंटमेंट बुक करा
                        </button>
                    </div>
                `;
                return;
            }

            // Separate active and past orders
            const activeOrders = [];
            const pastOrders = [];

            // Sort newest first
            keys.sort((a, b) => (orders[b].timestamp || 0) - (orders[a].timestamp || 0)).forEach(orderId => {
                const order = orders[orderId];
                if (['Pending', 'Accepted', 'On The Way', 'In Progress'].includes(order.status)) {
                    activeOrders.push({ id: orderId, data: order });
                } else {
                    pastOrders.push({ id: orderId, data: order });
                }
            });

            // 1. Render Active Orders (if any)
            if (activeOrders.length > 0) {
                const activeHeader = document.createElement('div');
                activeHeader.className = "flex items-center gap-2 pt-1 pb-1";
                activeHeader.innerHTML = `
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <h4 class="text-xs font-black text-slate-800 uppercase tracking-wider">चालू ऑर्डर्स (Active & Live Orders - ${activeOrders.length})</h4>
                `;
                container.appendChild(activeHeader);

                activeOrders.forEach(({ id: orderId, data: order }) => {
                    let badgeClass = "bg-amber-100 text-amber-800 border-amber-300";
                    let statusLabel = "ऑर्डर प्राप्त (Pending)";
                    if (order.status === 'Accepted') {
                        badgeClass = "bg-blue-100 text-blue-800 border-blue-300";
                        statusLabel = "कारागिराने स्वीकारली (Accepted)";
                    } else if (order.status === 'On The Way') {
                        badgeClass = "bg-indigo-100 text-indigo-800 border-indigo-300";
                        statusLabel = "मार्गस्थ आहे (On The Way)";
                    } else if (order.status === 'In Progress') {
                        badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
                        statusLabel = "काम चालू आहे (In Progress)";
                    }

                    const card = document.createElement('div');
                    card.className = "bg-gradient-to-br from-white to-blue-50/40 border-2 border-blue-300 p-4 rounded-2xl space-y-3 text-xs shadow-sm hover:shadow-md transition";
                    card.innerHTML = `
                        <div class="flex items-center justify-between border-b pb-2 border-blue-100">
                            <span class="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                <i class="fa-solid fa-wrench text-blue-600"></i> ${escapeHtml(order.service || 'सर्व्हिस')}
                            </span>
                            <span class="px-2.5 py-1 rounded-full font-bold text-[10px] border ${badgeClass}">
                                ${statusLabel}
                            </span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-slate-600">
                            <p><strong>ऑर्डर आयडी:</strong> <span class="font-mono font-bold text-slate-800">#${orderId.slice(-6).toUpperCase()}</span></p>
                            <p><strong>बजेट:</strong> <span class="text-emerald-700 font-extrabold">${escapeHtml(order.budget || '-')}</span></p>
                            <p><strong>तारीख:</strong> ${escapeHtml(order.date || '-')} (${escapeHtml(order.time || '-')})</p>
                            <p><strong>परिसर:</strong> ${escapeHtml(order.area || '-')}</p>
                            ${order.workerName ? `<p class="col-span-2 text-indigo-700 font-bold"><i class="fa-solid fa-helmet-safety mr-1"></i> कारागीर: ${escapeHtml(order.workerName)}</p>` : ''}
                        </div>
                        ${order.startOtp && order.status !== 'In Progress' ? `
                            <div class="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between">
                                <span class="text-[11px] font-bold text-amber-900"><i class="fa-solid fa-shield-halved text-amber-600 mr-1"></i> सुरक्षा स्टार्ट पिन:</span>
                                <span class="font-mono font-black text-sm tracking-widest bg-white px-2.5 py-1 rounded-lg border border-amber-300 text-amber-900">${order.startOtp}</span>
                            </div>
                        ` : ''}
                        <button onclick="trackSelectedOrder('${orderId}')" class="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-location-crosshairs text-amber-300"></i>
                            <span>थेट ट्रॅक करा (Live Tracking Status)</span>
                        </button>
                    `;
                    container.appendChild(card);
                });
            }

            // 2. Render Past Orders (if any)
            if (pastOrders.length > 0) {
                const pastHeader = document.createElement('div');
                pastHeader.className = "flex items-center gap-2 pt-3 pb-1";
                pastHeader.innerHTML = `
                    <i class="fa-solid fa-history text-slate-400"></i>
                    <h4 class="text-xs font-bold text-slate-600 uppercase tracking-wider">मागील ऑर्डर्स (Past Orders - ${pastOrders.length})</h4>
                `;
                container.appendChild(pastHeader);

                pastOrders.forEach(({ id: orderId, data: order }) => {
                    const isCompleted = order.status === 'Completed';
                    const badgeClass = isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200";
                    const statusText = isCompleted ? "पूर्ण झाले (Completed)" : "रद्द केले (Cancelled)";

                    const card = document.createElement('div');
                    card.className = "bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2 text-xs hover:border-slate-300 transition";
                    card.innerHTML = `
                        <div class="flex items-center justify-between border-b pb-2 border-slate-200">
                            <span class="font-bold text-slate-800"><i class="fa-solid fa-wrench text-slate-500"></i> ${escapeHtml(order.service || 'सर्व्हिस')}</span>
                            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] border ${badgeClass}">${statusText}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-1.5 text-slate-600">
                            <p><strong>आयडी:</strong> <span class="font-mono">#${orderId.slice(-6).toUpperCase()}</span></p>
                            <p><strong>बजेट:</strong> <span class="font-bold text-emerald-600">${escapeHtml(order.budget || '-')}</span></p>
                            <p><strong>तारीख:</strong> ${escapeHtml(order.date || '-')}</p>
                            <p><strong>परिसर:</strong> ${escapeHtml(order.area || '-')}</p>
                        </div>
                        <div class="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
                            ${isCompleted && !order.isRated ? `
                                <button onclick="openOrderRating('${orderId}')" class="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1 px-3 rounded-lg text-[11px] transition flex items-center gap-1 shadow-sm">
                                    <i class="fa-solid fa-star text-[10px]"></i> Rate Worker
                                </button>
                            ` : ''}
                            <button onclick="trackSelectedOrder('${orderId}')" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1 px-3 rounded-lg text-[11px] transition">
                                सविस्तर पहा
                            </button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }
        }

        function trackSelectedOrder(orderId) {
            closeMyOrdersModal();
            trackLiveStatus(orderId);
            setTimeout(() => {
                const target = document.getElementById('liveStatusContainer') || document.getElementById('stepsTrackerContainer');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);
        }

        // Bottom Nav bar handler
        function customerNavTo(target) {
            document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
            if (target === 'home') {
                document.getElementById('cNavHome')?.classList.add('active');
                closeMyOrdersModal();
                if (typeof closeProfileModal === 'function') closeProfileModal();
                if (typeof closeCustomerSupportModal === 'function') closeCustomerSupportModal();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (target === 'orders') {
                document.getElementById('cNavOrders')?.classList.add('active');
                openMyOrdersModal();
            } else if (target === 'profile') {
                document.getElementById('cNavProfile')?.classList.add('active');
                if (typeof openProfileModal === 'function') openProfileModal();
            } else if (target === 'help') {
                document.getElementById('cNavHelp')?.classList.add('active');
                if (typeof openCustomerSupportModal === 'function') openCustomerSupportModal();
            }
        }

        window.openMyOrdersModal = openMyOrdersModal;
        window.closeMyOrdersModal = closeMyOrdersModal;
        window.fetchCustomerOrders = fetchCustomerOrders;
        window.trackSelectedOrder = trackSelectedOrder;
        window.customerNavTo = customerNavTo;


// =========================================================
// Society Maintenance Pass (Society Bulk Pass / AMC) Modal
// =========================================================
function openSocietyPassModal() {
    const modal = document.getElementById('societyPassModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeSocietyPassModal() {
    const modal = document.getElementById('societyPassModal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

function selectSocietyPassPlan(planType) {
    const planSelect = document.getElementById('socSelectedPlan');
    if (!planSelect) return;
    if (planType === 'Silver') {
        planSelect.value = "Silver Pass (20-50 Flats) - ₹4,999/mo";
    } else if (planType === 'Gold') {
        planSelect.value = "Gold Pass (50-120 Flats) - ₹8,999/mo";
    } else if (planType === 'Platinum') {
        planSelect.value = "Platinum Custom AMC (120+ Flats)";
    }
    planSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handleSocietyPassSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('socSubmitBtn');
    const msgEl = document.getElementById('socStatusMsg');
    const socName = (document.getElementById('socName')?.value || '').trim();
    const socArea = document.getElementById('socArea')?.value || '';
    const socFlats = parseInt(document.getElementById('socFlats')?.value || '0', 10);
    const socContactName = (document.getElementById('socContactName')?.value || '').trim();
    const socContactMobile = (document.getElementById('socContactMobile')?.value || '').trim();
    const socSelectedPlan = document.getElementById('socSelectedPlan')?.value || '';

    if (!socName || !socContactName || !socContactMobile || socContactMobile.length !== 10) {
        alert("कृपया सर्व माहिती अचूक भरा (१० अंकी मोबाईल नंबर आवश्यक).");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> अर्ज सादर होत आहे...';
    }

    try {
        const newRef = database.ref('societyPassEnquiries').push();
        const payload = {
            societyName: socName,
            area: socArea,
            flats: socFlats,
            contactName: socContactName,
            contactMobile: socContactMobile,
            plan: socSelectedPlan,
            status: 'New',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        await newRef.set(payload);

        if (msgEl) {
            msgEl.className = "text-xs font-semibold p-3 rounded-xl text-center bg-emerald-50 text-emerald-800 border border-emerald-200";
            msgEl.innerHTML = "🎉 अभिनंदन! आपला सोसायटी पास अर्ज यशस्वीरीत्या नोंदवला गेला आहे. आमची टीम लवकरच आपल्याशी संपर्क करेल.";
            msgEl.classList.remove('hidden');
        }

        const waAdminMsg = "नमस्कार घरमित्र! आम्ही आमच्या सोसायटीसाठी सोसायटी मेंटेनन्स पास (Society Bulk Pass) मध्ये स्वारस्य दाखवत आहोत.\n\n🏢 *सोसायटी:* " + encodeURIComponent(socName) + "\n📍 *परिसर:* " + encodeURIComponent(socArea) + "\n🏘️ *एकूण फ्लॅट्स:* " + socFlats + "\n👤 *संपर्क व्यक्ती:* " + encodeURIComponent(socContactName) + " (" + socContactMobile + ")\n📋 *प्लॅन:* " + encodeURIComponent(socSelectedPlan) + "\n\nकृपया पुढील प्रक्रियेसाठी संपर्क साधावा.";
        
        setTimeout(() => {
            if (confirm("आपला अर्ज सेव्ह झाला आहे! त्वरित घरमित्र टीमशी व्हॉट्सॲपवर बोलण्यासाठी 'OK' दाबा.")) {
                window.open("https://wa.me/917875160724?text=" + waAdminMsg, '_blank');
            }
            closeSocietyPassModal();
            document.getElementById('societyPassForm')?.reset();
            if (msgEl) msgEl.classList.add('hidden');
        }, 1200);

    } catch (err) {
        console.error("Society Pass Error:", err);
        if (msgEl) {
            msgEl.className = "text-xs font-semibold p-3 rounded-xl text-center bg-red-50 text-red-700 border border-red-200";
            msgEl.innerText = "अर्ज पाठवताना त्रुटी आली: " + err.message;
            msgEl.classList.remove('hidden');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> सोसायटी पाससाठी अर्ज करा (Submit Application)';
        }
    }
}

window.openSocietyPassModal = openSocietyPassModal;
window.closeSocietyPassModal = closeSocietyPassModal;
window.selectSocietyPassPlan = selectSocietyPassPlan;
window.handleSocietyPassSubmit = handleSocietyPassSubmit;
