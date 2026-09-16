let isDutyOn = false;
let allOrdersData = null;
let currentWorkerUid = null;
let currentWorkerService = "Cleaning"; 
let activeChatOrderId = null;
let activeChatListener = null;
let locationWatchId = null;
let locationSharingOrderId = null;
let earningsChartInstance = null;
let workerTripMap = null;
let workerTripMarker = null;
let workerTripPath = null;
let workerTripPathPoints = [];
let workerTripLastLocation = null;
let workerTripMapOrderId = null;
const auth = firebase.auth();

// Dispatch policy.  Offers are reserved for one matching on-duty worker for
// 30 seconds.  Once accepted, the worker has 15 minutes to mark "On The Way".
// Server-side timestamps are preferable, but these deadlines are deliberately
// stored on the order so every open worker dashboard sees the same state.
const OFFER_WINDOW_MS = 30 * 1000;
const ON_THE_WAY_WINDOW_MS = 15 * 60 * 1000;
let dispatchTimerId = null;
let offerClaimInFlight = false;

function orderNow() {
    return Date.now();
}

function queueNotification(orderId, type, data) {
    // A Cloud Function / webhook can listen here and send the real EmailJS or
    // WhatsApp Business message.  Browser JavaScript must not contain WhatsApp
    // credentials and cannot send WhatsApp messages in the background.
    return database.ref('notificationEvents').push({
        orderId,
        type,
        data: data || {},
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'pending'
    }).catch(error => console.warn('Notification event could not be queued:', error));
}

function isMatchingPendingOrder(order, selectedArea) {
    if (!order || order.status !== 'Pending') return false;
    const jobService = (order.service || '').replace(/^\/+/, '').trim().toLowerCase();
    const workerService = (currentWorkerService || '').replace(/^\/+/, '').trim().toLowerCase();
    return (order.area === selectedArea || !order.area) && jobService === workerService;
}

function claimNextOffer() {
    if (offerClaimInFlight || !isDutyOn || !currentWorkerUid || getActiveOrderForCurrentWorker() || !allOrdersData) return;
    const selectedArea = document.getElementById('workingAreaSelect')?.value;
    const candidate = Object.entries(allOrdersData)
        .map(([id, order]) => ({ id, order }))
        .find(({ order }) => isMatchingPendingOrder(order, selectedArea) &&
            (!order.offerExpiresAt || Number(order.offerExpiresAt) <= orderNow()) &&
            !(order.offerDeclines && Number(order.offerDeclines[currentWorkerUid]) > orderNow() - OFFER_WINDOW_MS));
    if (!candidate) return;

    offerClaimInFlight = true;
    database.ref('orders/' + candidate.id).transaction(order => {
        const now = orderNow();
        if (!isMatchingPendingOrder(order, selectedArea)) return;
        if (order.offerExpiresAt && Number(order.offerExpiresAt) > now) return;
        if (order.offerDeclines && Number(order.offerDeclines[currentWorkerUid]) > now - OFFER_WINDOW_MS) return;
        return {
            ...order,
            offerWorkerUid: currentWorkerUid,
            offeredAt: now,
            offerExpiresAt: now + OFFER_WINDOW_MS
        };
    }, () => {
        offerClaimInFlight = false;
    });
}

function expireCurrentOffer() {
    if (!currentWorkerUid || !allOrdersData) return;
    const now = orderNow();
    Object.entries(allOrdersData).forEach(([orderId, order]) => {
        if (order.status !== 'Pending' || order.offerWorkerUid !== currentWorkerUid || Number(order.offerExpiresAt) > now) return;
        database.ref('orders/' + orderId).transaction(current => {
            if (!current || current.status !== 'Pending' || current.offerWorkerUid !== currentWorkerUid || Number(current.offerExpiresAt) > orderNow()) return;
            return {
                ...current,
                offerWorkerUid: null,
                offeredAt: null,
                offerExpiresAt: null,
                offerDeclines: { ...(current.offerDeclines || {}), [currentWorkerUid]: orderNow() }
            };
        });
    });
}

function releaseExpiredAcceptedOrder() {
    const active = getActiveOrderForCurrentWorker();
    if (!active || active.order.status !== 'Accepted' || Number(active.order.onTheWayDeadline) > orderNow()) return;
    const orderId = active.orderId;
    database.ref('orders/' + orderId).transaction(order => {
        if (!order || order.status !== 'Accepted' || order.workerUid !== currentWorkerUid || Number(order.onTheWayDeadline) > orderNow()) return;
        return {
            ...order,
            status: 'Pending',
            workerUid: null,
            workerMobile: null,
            acceptedAt: null,
            onTheWayDeadline: null,
            offerWorkerUid: null,
            offeredAt: null,
            offerExpiresAt: null,
            reassignedAt: orderNow(),
            reassignmentReason: 'Worker did not start within 15 minutes'
        };
    }, (_, committed) => {
        if (committed) releaseActiveOrderLock(orderId);
    });
}

function updateDeadlineLabels() {
    const now = orderNow();
    document.querySelectorAll('[data-offer-expires]').forEach(el => {
        el.textContent = Math.max(0, Math.ceil((Number(el.dataset.offerExpires) - now) / 1000)) + ' sec left';
    });
    document.querySelectorAll('[data-on-the-way-deadline]').forEach(el => {
        const seconds = Math.max(0, Math.ceil((Number(el.dataset.onTheWayDeadline) - now) / 1000));
        el.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} left to start`;
    });
}

function startDispatchTimers() {
    if (dispatchTimerId) return;
    dispatchTimerId = setInterval(() => {
        expireCurrentOffer();
        releaseExpiredAcceptedOrder();
        claimNextOffer();
        updateDeadlineLabels();
    }, 1000);
}

// Page Load Var Local Session Check
document.addEventListener("DOMContentLoaded", () => {
    loadLocalWorkerSession();
});

function loadLocalWorkerSession() {
    let session = localStorage.getItem('current_user_session');
    if (session) {
        let userData;
        try {
            userData = JSON.parse(session);
        } catch (error) {
            console.warn('Invalid local worker session:', error);
            return;
        }

        // A customer must never become a worker merely by opening worker.html.
        if (userData.role !== 'worker') {
            currentWorkerUid = null;
            return;
        }
        if (!currentWorkerUid) {
            currentWorkerUid = getLocalWorkerId();
        }
        const name = userData.fullName || userData.name || "Worker";
        const service = userData.workType || userData.service || "Cleaning";
        updateWorkerUI({
            name: name,
            service: service,
            wallet: userData.balance || 50,
            workerIndex: userData.mobile ? userData.mobile.slice(-6) : 100001
        });
    }
}

function getLocalWorkerId() {
    const session = JSON.parse(localStorage.getItem('current_user_session') || '{}');
    return session.role === 'worker' && session.mobile ? "local_worker_" + session.mobile : null;
}

function getCurrentWorkerMobile() {
    const session = JSON.parse(localStorage.getItem('current_user_session') || '{}');
    return session.role === 'worker' ? (session.mobile || "") : "";
}

function getActiveOrderForCurrentWorker() {
    if (!allOrdersData || !currentWorkerUid) return null;

    return Object.entries(allOrdersData)
        .map(([orderId, order]) => ({ orderId, order }))
        .find(({ order }) =>
            order &&
            (order.status === 'Accepted' || order.status === 'On The Way') &&
            (
                order.workerUid === currentWorkerUid ||
                (order.workerMobile && order.workerMobile === getCurrentWorkerMobile())
            )
        ) || null;
}

function ensureWorkerTripMap() {
    const mapElement = document.getElementById('workerTripMap');
    if (!mapElement) return;

    if (workerTripMap) {
        setTimeout(() => workerTripMap.invalidateSize(), 50);
        return;
    }

    workerTripMap = L.map(mapElement, {
        zoomControl: true,
        attributionControl: true
    }).setView([18.5204, 73.8567], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(workerTripMap);

    workerTripPath = L.polyline(workerTripPathPoints, {
        color: '#6366f1',
        weight: 4,
        opacity: 0.72
    }).addTo(workerTripMap);

    setTimeout(() => workerTripMap?.invalidateSize(), 100);
}

function destroyWorkerTripMap() {
    if (workerTripMap) {
        workerTripMap.remove();
    }
    workerTripMap = null;
    workerTripMarker = null;
    workerTripPath = null;
}

function resetWorkerTripState() {
    destroyWorkerTripMap();
    workerTripPathPoints = [];
    workerTripLastLocation = null;
    workerTripMapOrderId = null;
}

function updateWorkerTripStatus(status) {
    const statusEl = document.getElementById('workerTripStatus');
    const metaEl = document.getElementById('workerTripLocationMeta');
    if (!statusEl || !metaEl) return;

    if (status === 'On The Way') {
        statusEl.innerText = 'Live • On The Way';
        statusEl.className = 'text-[10px] font-bold text-emerald-600';
        metaEl.innerText = 'Live GPS sharing सुरू आहे...';
    } else {
        statusEl.innerText = 'Ready to start';
        statusEl.className = 'text-[10px] font-bold text-amber-600';
        metaEl.innerText = 'On The Way केल्यावर live GPS सुरू होईल';
    }
}

function updateWorkerTripMap(orderId, location) {
    if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) {
        return;
    }

    workerTripMapOrderId = orderId;
    workerTripLastLocation = location;
    ensureWorkerTripMap();
    if (!workerTripMap) return;

    const latLng = [Number(location.lat), Number(location.lng)];
    if (!workerTripMarker) {
        workerTripMarker = L.marker(latLng, {
            icon: L.divIcon({
                className: '',
                html: '<div class="worker-truck-marker"><i class="fa-solid fa-truck"></i></div>',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            })
        }).addTo(workerTripMap);
    } else {
        workerTripMarker.setLatLng(latLng);
    }

    const lastPoint = workerTripPathPoints[workerTripPathPoints.length - 1];
    if (!lastPoint || lastPoint[0] !== latLng[0] || lastPoint[1] !== latLng[1]) {
        workerTripPathPoints.push(latLng);
        if (workerTripPathPoints.length > 80) workerTripPathPoints.shift();
        workerTripPath?.setLatLngs(workerTripPathPoints);
    }

    workerTripMap.setView(latLng, Math.max(workerTripMap.getZoom(), 15), {
        animate: true,
        duration: 0.5
    });

    const updatedAt = Number(location.updatedAt);
    const metaEl = document.getElementById('workerTripLocationMeta');
    const etaEl = document.getElementById('workerTripEta');
    if (metaEl) {
        metaEl.innerText = Number.isFinite(updatedAt) && updatedAt > 0
            ? 'GPS updated ' + new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Live GPS sharing सुरू आहे...';
    }
    if (etaEl) {
        etaEl.innerText = Number.isFinite(Number(location.etaMinutes))
            ? Math.max(1, Math.round(Number(location.etaMinutes))) + ' min'
            : 'Live';
    }
}

function publishWorkerLocation(orderId, position) {
    const coords = position.coords;
    const liveLocation = {
        lat: Number(coords.latitude.toFixed(6)),
        lng: Number(coords.longitude.toFixed(6)),
        accuracy: Math.round(coords.accuracy || 0),
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    updateWorkerTripMap(orderId, liveLocation);
    return database.ref("orders/" + orderId + "/workerLocation").set(liveLocation);
}

function startLocationSharing(orderId) {
    if (!orderId || locationSharingOrderId === orderId) return;

    if (!navigator.geolocation) {
        alert("तुमच्या device वर location सुविधा उपलब्ध नाही.");
        return;
    }

    ensureWorkerTripMap();
    updateWorkerTripStatus('On The Way');
    stopLocationSharing(locationSharingOrderId, false);
    locationSharingOrderId = orderId;

    const handleLocationError = (error) => {
        console.warn("Worker location error:", error.message);
    };

    navigator.geolocation.getCurrentPosition(
        position => publishWorkerLocation(orderId, position).catch(console.error),
        handleLocationError,
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    locationWatchId = navigator.geolocation.watchPosition(
        position => publishWorkerLocation(orderId, position).catch(console.error),
        handleLocationError,
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
}

function stopLocationSharing(orderId, clearRemoteLocation = false) {
    if (locationWatchId !== null) {
        navigator.geolocation?.clearWatch(locationWatchId);
        locationWatchId = null;
    }

    const orderToClear = orderId || locationSharingOrderId;
    locationSharingOrderId = null;

    if (clearRemoteLocation && orderToClear) {
        return database.ref("orders/" + orderToClear + "/workerLocation").remove();
    }

    return Promise.resolve();
}

function releaseActiveOrderLock(orderId) {
    if (!currentWorkerUid) return Promise.resolve();

    return database.ref("workers/" + currentWorkerUid + "/activeOrderId").transaction(
        activeOrderId => activeOrderId === orderId ? null : activeOrderId
    ).catch(error => {
        console.warn("Could not release active order lock:", error);
    });
}

auth.onAuthStateChanged((user) => {
    if (user) {
        currentWorkerUid = user.uid;
        
        const userRef = database.ref('users/' + user.uid);
        const workerRef = database.ref('workers/' + user.uid);

        userRef.on('value', (userSnap) => {
            let userData = userSnap.val() || {};
            
            workerRef.on('value', (workerSnap) => {
                let workerData = workerSnap.val() || {};

                let localSession = JSON.parse(localStorage.getItem('current_user_session') || '{}');

                const finalName = userData.fullName || userData.name || workerData.name || localSession.fullName || localSession.name || (user.email ? user.email.split('@')[0] : "Worker");
                const finalService = userData.service || userData.workType || workerData.service || localSession.workType || localSession.service || "Cleaning";

                const combinedData = {
                    name: finalName,
                    service: finalService,
                    wallet: workerData.wallet !== undefined ? workerData.wallet : (localSession.balance || 50),
                    workerIndex: workerData.workerIndex || Math.floor(100000 + Math.random() * 900000),
                    rating: workerData.rating || 5.0,
                    totalReviews: workerData.totalReviews || 0
                };

                if (!workerSnap.exists()) {
                    // Do not overwrite activeOrderId if an order was accepted
                    // while the worker profile was being initialized.
                    workerRef.update(combinedData);
                }

                updateWorkerUI(combinedData);
            });
        });

        loadWorkerEarnings(user.uid);
    } else {
        // Fallback to local session if no Firebase Auth
        loadLocalWorkerSession();
    }
});

function updateWorkerUI(data) {
    if (data.name) {
        document.getElementById('workerUsername').innerText = data.name;
    }
    
    const workerNum = data.workerIndex || 1;
    document.getElementById('workerID').innerText = 'GK-' + String(workerNum).padStart(6, '0');
    
    let cleanService = (data.service || "Cleaning").replace(/^\/+/, '').trim();
    currentWorkerService = cleanService;
    document.getElementById('workerService').innerText = currentWorkerService;

    if(data.wallet !== undefined) document.getElementById('walletAmount').innerText = data.wallet;
    if(data.rating !== undefined) document.getElementById('workerAvgRating').innerText = Number(data.rating).toFixed(1);
    if(data.totalReviews !== undefined) document.getElementById('workerTotalReviews').innerText = data.totalReviews;
    
    renderJobs();
}

function loadWorkerEarnings(workerUid) {
    database.ref('orders').orderByChild('workerUid').equalTo(workerUid).on('value', (snapshot) => {
        const orders = snapshot.val();
        let todaySum = 0;
        let todayCount = 0;
        let weeklyData = [0, 0, 0, 0, 0, 0, 0]; 
        
        const todayStr = new Date().toLocaleDateString();

        if (orders) {
            Object.values(orders).forEach(order => {
                if (order.status === 'Completed') {
                    const amount = parseInt(order.budget ? order.budget.replace(/[^0-9]/g, '') : '500') || 500;
                    if (order.date === todayStr) {
                        todaySum += amount;
                        todayCount++;
                    }
                    let dayIndex = new Date(order.timestamp || Date.now()).getDay(); 
                    weeklyData[dayIndex] += amount;
                }
            });
        }

        document.getElementById('todayEarnings').innerText = todaySum;
        document.getElementById('todayJobsCount').innerText = todayCount;

        renderEarningsChart(weeklyData);
    });
}

function renderEarningsChart(dataVals) {
    const ctx = document.getElementById('weeklyEarningsChart').getContext('2d');
    if (earningsChartInstance) earningsChartInstance.destroy();

    earningsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रव'],
            datasets: [{
                label: 'कमाई (₹)',
                data: dataVals,
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function openServiceModal() { document.getElementById('serviceModal').classList.remove('hidden'); }
function closeServiceModal() { document.getElementById('serviceModal').classList.add('hidden'); }

function updateWorkerService() {
    const newService = document.getElementById('newServiceSelect').value;
    
    // Update local UI
    currentWorkerService = newService;
    document.getElementById('workerService').innerText = newService;

    // Update Local Session
    let localSession = JSON.parse(localStorage.getItem('current_user_session') || '{}');
    localSession.workType = newService;
    localSession.service = newService;
    localStorage.setItem('current_user_session', JSON.stringify(localSession));

    // Update Firebase if logged in
    const user = auth.currentUser;
    if (user) {
        database.ref('workers/' + user.uid).update({ service: newService });
        database.ref('users/' + user.uid).update({ service: newService, workType: newService });
    }

    alert("तुमची सर्विस यशस्वीरीत्या बदलण्यात आली आहे!");
    closeServiceModal();
    renderJobs();
}

function payWithRazorpay() {
    let amountToAdd = 100;
    var options = {
        "key": "rzp_test_TZF48VPVnZ9JH2",
        "amount": amountToAdd * 100, 
        "currency": "INR",
        "name": "Gharmitra Online",
        "description": "Worker Wallet Recharge",
        "handler": function (response){
            alert("पेमेंट यशस्वी! पेमेंट आयडी: " + response.razorpay_payment_id);
            addMoneyToFirebaseWallet(amountToAdd);
        },
        "theme": { "color": "#2563eb" }
    };
    var rzp1 = new Razorpay(options);
    rzp1.open();
}

function addMoneyToFirebaseWallet(amount) {
    const user = auth.currentUser;
    if (user) {
        database.ref('workers/' + user.uid + '/wallet').transaction(currentBalance => (currentBalance || 50) + amount);
    } else {
        let currentWallet = parseInt(document.getElementById('walletAmount').innerText) || 50;
        document.getElementById('walletAmount').innerText = currentWallet + amount;
    }
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

function renderWorkerChatMessages(messages) {
    const chatBox = document.getElementById('chatMessagesContainer');
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
        const isMe = message.sender === 'worker';
        const time = Number(message.timestamp)
            ? new Date(Number(message.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
        chatBox.innerHTML += `<div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[75%] p-2.5 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'}">
                <p class="break-words">${escapeChatText(message.text)}</p>
                ${time ? `<span class="block text-[9px] mt-1 ${isMe ? 'text-blue-100' : 'text-slate-400'}">${time}</span>` : ''}
            </div>
        </div>`;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

function openChatModal(orderId, customerName) {
    if (!orderId) return;

    database.ref('orders/' + orderId).once('value').then(snapshot => {
        const order = snapshot.val();
        if (!order || !['Accepted', 'On The Way'].includes(order.status)) {
            alert("Order accept झाल्यानंतरच customerशी chat करता येईल.");
            return;
        }

        if (activeChatOrderId && activeChatListener) {
            database.ref('orders/' + activeChatOrderId + '/chats')
                .off('value', activeChatListener);
        }

        activeChatOrderId = orderId;
        document.getElementById('chatCustomerName').innerText = customerName || order.customerName || 'Client';
        document.getElementById('chatModal').classList.remove('hidden');

        const chatRef = database.ref('orders/' + orderId + '/chats');
        activeChatListener = snapshot => renderWorkerChatMessages(snapshot.val());
        chatRef.on('value', activeChatListener);
        document.getElementById('chatInputMsg')?.focus();
    });
}

function closeChatModal() {
    if (activeChatOrderId && activeChatListener) {
        database.ref('orders/' + activeChatOrderId + '/chats')
            .off('value', activeChatListener);
    }
    document.getElementById('chatModal').classList.add('hidden');
    activeChatOrderId = null;
    activeChatListener = null;
}

function sendChatMessage() {
    const txt = document.getElementById('chatInputMsg').value.trim();
    if(!txt || !activeChatOrderId) return;

    database.ref('orders/' + activeChatOrderId).once('value').then(snapshot => {
        const order = snapshot.val();
        if (!order || !['Accepted', 'On The Way'].includes(order.status)) {
            closeChatModal();
            alert("ही order पूर्ण झाली आहे. Chat बंद करण्यात आला आहे.");
            return;
        }

        return database.ref('orders/' + activeChatOrderId + '/chats').push({
            sender: 'worker',
            senderName: order.workerMobile || 'Worker',
            text: txt,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }).then(() => {
        document.getElementById('chatInputMsg').value = "";
    }).catch(error => {
        console.error("Worker chat error:", error);
        alert("मेसेज पाठवताना अडचण आली.");
    });
}

function openImagePreview(url) {
  document.getElementById('previewModalImg').src = url;
  document.getElementById('imagePreviewModal').classList.remove('hidden');
}
function closeImagePreview() {
  document.getElementById('imagePreviewModal').classList.add('hidden');
  document.getElementById('previewModalImg').src = "";
}

function toggleDuty() {
    isDutyOn = !isDutyOn;
    const btn = document.getElementById('dutyToggleBtn');
    const headerDot = document.getElementById('dutyDot');
    const headerText = document.getElementById('dutyText');

    if (isDutyOn) {
        btn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2 mb-6";
        btn.innerHTML = "🟢 Duty ON (Click OFF)";
        headerDot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
        headerText.innerText = "Duty ON";
    } else {
        btn.className = "w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2 mb-6";
        btn.innerHTML = "🔴 Duty OFF (Click ON)";
        headerDot.className = "w-2 h-2 rounded-full bg-red-500";
        headerText.innerText = "Duty OFF";
    }
    renderJobs();
}

function filterAreaJobs() { renderJobs(); }

database.ref("orders").on("value", (snapshot) => {
    allOrdersData = snapshot.val();
    renderJobs();
    claimNextOffer();
    startDispatchTimers();
});

function renderJobs() {
    const jobsContainer = document.getElementById('availableJobsContainer');
    const acceptedContainer = document.getElementById('acceptedJobsContainer');
    const jobCountBadge = document.getElementById('jobCount');
    const selectedArea = document.getElementById('workingAreaSelect').value;

    destroyWorkerTripMap();
    acceptedContainer.innerHTML = "";

    if (!isDutyOn) {
        jobsContainer.innerHTML = `<div class="text-center py-10"><span class="text-5xl block mb-3">😴</span><p class="font-bold text-slate-700 text-sm">तुम्ही सध्या Duty OFF वर आहात</p></div>`;
        jobCountBadge.innerText = "0 New Jobs";
        return;
    }

    if (!allOrdersData) {
        jobsContainer.innerHTML = '<p class="text-slate-400 text-xs text-center py-10">सध्या एकही काम उपलब्ध नाही...</p>';
        jobCountBadge.innerText = "0 New Jobs";
        return;
    }

    jobsContainer.innerHTML = "";
    const keys = Object.keys(allOrdersData).reverse();
    const activeOrderEntry = getActiveOrderForCurrentWorker();
    const activeOrderId = activeOrderEntry ? activeOrderEntry.orderId : null;
    let pendingCount = 0;

    if (workerTripMapOrderId && workerTripMapOrderId !== activeOrderId) {
        resetWorkerTripState();
    }

    keys.forEach(key => {
        const item = allOrdersData[key];
        const imgUrl = item.photoUrl || item.imageUrl || item.photo || item.image || null;
        const isAreaMatch = (item.area === selectedArea || !item.area);

        const jobService = (item.service || "").replace(/^\/+/, '').trim().toLowerCase();
        const workerService = (currentWorkerService || "").replace(/^\/+/, '').trim().toLowerCase();
        const isServiceMatch = (jobService === workerService);

        // An assigned worker must finish the active order before seeing any
        // other pending order.  A pending job is visible only during this
        // worker's exclusive 30-second offer window.
        const isCurrentWorkersOffer = item.offerWorkerUid === currentWorkerUid && Number(item.offerExpiresAt) > orderNow();
        if (!activeOrderId && item.status === 'Pending' && isAreaMatch && isServiceMatch && isCurrentWorkersOffer) {
            pendingCount++;
            const jobCard = document.createElement('div');
            jobCard.className = "bg-slate-50 border border-slate-200 p-4 rounded-2xl hover:border-blue-400 transition shadow-sm space-y-3";
            const photoHtml = imgUrl ? `<div class="my-2"><div class="relative cursor-pointer group rounded-xl overflow-hidden border border-slate-200" onclick="openImagePreview('${imgUrl}')"><img src="${imgUrl}" class="w-full h-44 object-cover"></div></div>` : '';

            jobCard.innerHTML = `
            <div class="flex justify-between items-start">
            <div><span class="bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full">⚡ ${item.service}</span><h4 class="font-bold text-slate-800 text-sm mt-2"><i class="fa-solid fa-user text-blue-600"></i> ${item.customerName}</h4></div>
            <span class="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">${item.budget || '₹500'}</span>
            </div>
            <div class="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-100">
            <p><i class="fa-solid fa-location-dot text-red-500 mr-1.5"></i><strong>पत्ता:</strong> ${item.address}</p>
            <p><i class="fa-solid fa-phone text-emerald-500 mr-1.5"></i><strong>संपर्क:</strong> <a href="tel:${item.customerMobile}" class="text-blue-600 font-bold">${item.customerMobile}</a></p>
            </div>
            ${photoHtml}
            <div class="flex items-center justify-between text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <span>Exclusive job offer</span><span data-offer-expires="${item.offerExpiresAt}">30 sec left</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
            <button onclick="acceptOrder('${key}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">🤝 Accept Order</button>
            <a href="https://maps.google.com/?q=${encodeURIComponent(item.address)}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">📍 Map</a>
            </div>`;
            jobsContainer.appendChild(jobCard);
        }

        if ((item.status === 'Accepted' || item.status === 'On The Way') && key === activeOrderId) {
            const activeCard = document.createElement('div');
            activeCard.className = "bg-white p-5 rounded-2xl border border-emerald-200 shadow-md space-y-4";
            activeCard.innerHTML = `
            <div class="flex justify-between items-center border-b pb-3 border-slate-100">
            <span class="font-bold text-slate-800 text-xs">🛠️ Active Task In-Progress</span>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">${item.status}</span>
            </div>
            <div class="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100 text-xs space-y-1.5 text-slate-700">
            <p><strong>ग्राहक:</strong> ${item.customerName}</p>
            <p><strong>सेवा:</strong> ${item.service}</p>
            <p><strong>मोबाइल:</strong> <a href="tel:${item.customerMobile}" class="text-blue-600 font-bold underline">${item.customerMobile}</a></p>
            <p><strong>पत्ता:</strong> ${item.address}</p>
            </div>
            ${item.status === 'Accepted' ? `<div class="flex items-center justify-between text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg"><span>Mark On The Way within 15 minutes</span><span data-on-the-way-deadline="${item.onTheWayDeadline || orderNow()}">15:00 left to start</span></div>` : ''}
             <div class="worker-live-card">
                 <div class="flex items-center justify-between gap-3 mb-3">
                     <span class="text-xs font-black tracking-[.12em] text-slate-900 flex items-center gap-2">
                         <span class="live-dot"></span>
                         LIVE TRACKING
                     </span>
                     <span id="workerTripStatus" class="text-[10px] font-bold text-amber-600">Ready to start</span>
                 </div>
                 <div class="worker-live-map-shell">
                     <span class="live-map-chip"><i class="fa-solid fa-truck text-indigo-600"></i> Your live route</span>
                     <div id="workerTripMap" aria-label="Worker live route map"></div>
                     <div class="tracking-eta-card">
                         <span class="text-[10px] font-bold text-slate-500">Estimated time</span>
                         <strong id="workerTripEta">--</strong>
                     </div>
                 </div>
                 <div class="flex items-center justify-between gap-2 mt-3">
                     <span id="workerTripLocationMeta" class="text-[10px] text-slate-500">On The Way केल्यावर live GPS सुरू होईल</span>
                     <span class="text-[10px] font-bold text-slate-600 truncate max-w-[45%]" title="${item.address}">
                         <i class="fa-solid fa-location-dot text-red-500 mr-1"></i> Customer
                     </span>
                 </div>
             </div>
            <div class="grid grid-cols-2 gap-2">
            <a href="https://maps.google.com/?q=${encodeURIComponent(item.address)}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">📍 Map</a>
            <button onclick="openChatModal('${key}', '${item.customerName}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">💬 Chat</button>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
            <button onclick="updateStatus('${key}', 'On The Way')" class="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-xl text-[11px] transition shadow-sm">🚗 On The Way</button>
            <button onclick="updateStatus('${key}', 'Completed')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-[11px] transition shadow-sm">✓ Completed</button>
            </div>`;
            acceptedContainer.appendChild(activeCard);

            workerTripMapOrderId = key;
            ensureWorkerTripMap();
            updateWorkerTripStatus(item.status);
            if (workerTripLastLocation) {
                updateWorkerTripMap(key, workerTripLastLocation);
            }

            if (item.status === 'On The Way') {
                startLocationSharing(key);
            }
        }
    });

    if (activeOrderId) {
        pendingCount = 0;
        if (activeOrderEntry.order.status === 'Accepted') {
            stopLocationSharing(activeOrderId, false);
        }
    }

    jobCountBadge.innerText = `${pendingCount} New Jobs`;
    updateDeadlineLabels();
}

function acceptOrder(orderId) {
    if (!currentWorkerUid) {
        currentWorkerUid = getLocalWorkerId();
    }
    if (!currentWorkerUid) {
        alert("Order accept करण्यासाठी आधी Worker account ने login करा.");
        return;
    }

    const activeOrder = getActiveOrderForCurrentWorker();
    if (activeOrder) {
        alert("तुमच्याकडे आधीच एक active order आहे. ती पूर्ण केल्यानंतरच नवीन order दिसेल.");
        return;
    }

    const activeLockRef = database.ref("workers/" + currentWorkerUid + "/activeOrderId");
    activeLockRef.transaction(
        activeOrderId => activeOrderId || orderId,
        (lockError, lockCommitted) => {
            if (lockError) {
                alert("Order accept करताना अडचण आली. पुन्हा प्रयत्न करा.");
                return;
            }

            if (!lockCommitted) {
                alert("तुमच्याकडे आधीच एक active order आहे. ती पूर्ण केल्यानंतरच नवीन order दिसेल.");
                renderJobs();
                return;
            }

            database.ref("orders/" + orderId).transaction(
                order => {
                    if (!order || order.status !== 'Pending' || order.workerUid ||
                        order.offerWorkerUid !== currentWorkerUid || Number(order.offerExpiresAt) <= orderNow()) {
                        return;
                    }

                    return {
                        ...order,
                        status: "Accepted",
                        workerUid: currentWorkerUid,
                        workerMobile: getCurrentWorkerMobile(),
                        acceptedAt: firebase.database.ServerValue.TIMESTAMP,
                        onTheWayDeadline: orderNow() + ON_THE_WAY_WINDOW_MS,
                        offerWorkerUid: null,
                        offeredAt: null,
                        offerExpiresAt: null
                    };
                },
                (orderError, orderCommitted) => {
                    if (orderError || !orderCommitted) {
                        releaseActiveOrderLock(orderId);
                        alert(orderError ? "Order accept करताना अडचण आली." : "ही order दुसऱ्या worker ने आधीच accept केली आहे.");
                        return;
                    }

                    queueNotification(orderId, 'order_accepted', {
                        workerMobile: getCurrentWorkerMobile(),
                        customerMobile: allOrdersData?.[orderId]?.customerMobile || ''
                    });
                    alert("तुम्ही हे काम यशस्वीरीत्या स्वीकारले आहे! 15 मिनिटांच्या आत On The Way करा.");
                }
            );
        }
    );
}

function updateStatus(orderId, newStatus) {
    const activeOrder = getActiveOrderForCurrentWorker();
    if (!activeOrder || activeOrder.orderId !== orderId) {
        alert("ही order तुमची active order नाही.");
        return;
    }

    if (newStatus === 'On The Way' && activeOrder.order.status === 'Accepted' && Number(activeOrder.order.onTheWayDeadline) <= orderNow()) {
        releaseExpiredAcceptedOrder();
        alert('15 मिनिटांची वेळ संपली आहे. ही order दुसऱ्या worker कडे पाठवली जात आहे.');
        return;
    }

    const updateOrder = newStatus === 'Completed'
        ? stopLocationSharing(orderId, true).then(() =>
            database.ref("orders/" + orderId).update({
                status: newStatus,
                workerLocation: null,
                completedAt: firebase.database.ServerValue.TIMESTAMP
            })
        )
        : database.ref("orders/" + orderId).update({
            status: newStatus,
            onTheWayAt: firebase.database.ServerValue.TIMESTAMP,
            onTheWayDeadline: null
        });

    updateOrder.then(() => {
        if (newStatus === 'On The Way') {
            startLocationSharing(orderId);
            queueNotification(orderId, 'worker_on_the_way', {
                workerMobile: getCurrentWorkerMobile(),
                customerMobile: activeOrder.order.customerMobile || ''
            });
        }

        const lockRelease = newStatus === 'Completed'
            ? releaseActiveOrderLock(orderId)
            : Promise.resolve();

        return lockRelease;
    }).then(() => {
        alert("स्टेटस अपडेट केले: " + newStatus);
    }).catch(error => {
        console.error("Status update error:", error);
        alert("स्टेटस अपडेट करताना अडचण आली.");
    });
}
