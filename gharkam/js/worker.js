const EMAILJS_PUBLIC_KEY = 'PfAaODZ_GPiBPHvOi';
const EMAILJS_SERVICE_ID = 'service_lst67g7';
const EMAILJS_TEMPLATE_ID = 'template_ope5xzi';

if (window.emailjs) {
    try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch(e) {}
}

let currentCompletingOrderId = null;
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
let workerTripCustomerMarker = null;
let workerTripRouteLine = null;
let workerTripPath = null;
let workerTripPathPoints = [];
let workerTripLastLocation = null;
let workerTripMapOrderId = null;

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

function getCustomerCoordinates(order) {
    if (!order) return { lat: 18.5204, lng: 73.8567 };
    if (order.customerLocation && Number.isFinite(Number(order.customerLocation.lat)) && Number.isFinite(Number(order.customerLocation.lng))) {
        return { lat: Number(order.customerLocation.lat), lng: Number(order.customerLocation.lng) };
    }
    if (Number.isFinite(Number(order.customerLat)) && Number.isFinite(Number(order.customerLng))) {
        return { lat: Number(order.customerLat), lng: Number(order.customerLng) };
    }
    if (order.area && PUNE_AREA_COORDINATES[order.area]) {
        return PUNE_AREA_COORDINATES[order.area];
    }
    return { lat: 18.5204, lng: 73.8567 };
}

// =========================================================
// Loud Delivery Alert Sound & Vibration System (Swiggy / Zomato style)
// =========================================================
let audioCtx = null;
let orderAlertInterval = null;
let isAlertRinging = false;
let currentAlertOrderId = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

// Ensure audio context unlocks on any user touch or click
['click', 'touchstart', 'keydown'].forEach(evtName => {
    document.addEventListener(evtName, () => {
        getAudioContext();
    }, { once: false, passive: true });
});

function playLoudDeliveryChime() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        // High-energy loud delivery notification chord (Zomato/Swiggy chime)
        const notes = [
            { freq: 784, start: 0.00, dur: 0.12 },     // G5
            { freq: 988, start: 0.13, dur: 0.12 },     // B5
            { freq: 1175, start: 0.26, dur: 0.15 },    // D6
            { freq: 1568, start: 0.42, dur: 0.26 },    // G6
            { freq: 1175, start: 0.72, dur: 0.13 },    // D6
            { freq: 1568, start: 0.86, dur: 0.36 }     // G6
        ];

        notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.freq, now + n.start);

            gain.gain.setValueAtTime(0.001, now + n.start);
            gain.gain.exponentialRampToValueAtTime(0.95, now + n.start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur + 0.05);
        });

        // Mobile Vibration
        if (navigator.vibrate) {
            navigator.vibrate([350, 150, 350, 150, 500]);
        }
    } catch (err) {
        console.warn("Loud chime error:", err);
    }
}

function startOrderAlert(orderId, orderDetails) {
    if (isAlertRinging && currentAlertOrderId === orderId) return;

    isAlertRinging = true;
    currentAlertOrderId = orderId;

    const alertModal = document.getElementById('incomingOrderAlertModal');
    const alertSub = document.getElementById('incomingOrderAlertSub');
    if (alertModal) {
        if (alertSub && orderDetails) {
            const budgetVal = (orderDetails.budget || '₹500').replace('₹', '');
            alertSub.innerText = `${orderDetails.service || 'नवीन काम'} • ₹${budgetVal} • ${orderDetails.area || 'Pune'}`;
        }
        alertModal.classList.remove('hidden');
    }

    playLoudDeliveryChime();

    if (orderAlertInterval) clearInterval(orderAlertInterval);
    orderAlertInterval = setInterval(() => {
        if (!isAlertRinging) {
            clearInterval(orderAlertInterval);
            orderAlertInterval = null;
            return;
        }
        playLoudDeliveryChime();
    }, 1600);
}

function stopOrderAlert() {
    isAlertRinging = false;
    currentAlertOrderId = null;
    if (orderAlertInterval) {
        clearInterval(orderAlertInterval);
        orderAlertInterval = null;
    }
    const alertModal = document.getElementById('incomingOrderAlertModal');
    if (alertModal) {
        alertModal.classList.add('hidden');
    }
    if (navigator.vibrate) {
        try { navigator.vibrate(0); } catch(e) {}
    }
}

function stopOrderAlertSoundOnly() {
    if (orderAlertInterval) {
        clearInterval(orderAlertInterval);
        orderAlertInterval = null;
    }
    isAlertRinging = false;
    if (navigator.vibrate) {
        try { navigator.vibrate(0); } catch(e) {}
    }
}

function acceptCurrentActiveOffer() {
    if (currentAlertOrderId) {
        acceptOrder(currentAlertOrderId);
    }
}

function testOrderAlertSound() {
    getAudioContext();
    playLoudDeliveryChime();
    alert("🔔 रिंगटोन आणि व्हायब्रेशन यशस्वीरीत्या टेस्ट झाले! नवीन काम आल्यावर असाच मोठा आवाज वाजेल.");
}


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


function triggerWhatsAppAlertsOnOrderAccept(orderId, orderItem, workerMobile) {
    if (!orderItem) return;
    const custMobile = orderItem.customerMobile;
    const custName = orderItem.customerName || 'Customer';
    const service = orderItem.service || 'सेवा';
    const budget = orderItem.budget || '';

    const customerMsg = `*नमस्कार ${custName} जी!* 🏠\nतुमची Gharmitra ऑर्डर यशस्वीरीत्या CONFIRMED झाली आहे!\n\n⚡ *सेवा:* ${service}\n👷 *कामगार मोबाईल:* ${workerMobile}\n💰 *रक्कम:* ${budget}\n\nकामगार लवकरच तुमच्या पत्त्यावर पोहोचेल. धन्यवाद!\n- Gharmitra.online पुणे`;
    const workerMsg = `*नवीन काम CONFIRMED!* 🛠️\n\n⚡ *सेवा:* ${service}\n👤 *ग्राहक:* ${custName}\n📞 *मोबाईल:* ${custMobile}\n📍 *पत्ता:* ${orderItem.address}\n💰 *रक्कम:* ${budget}\n\n१५ मिनिटांच्या आत On The Way करा!\n- Gharmitra`;

    // Queue notification event in Firebase
    queueNotification(orderId, 'whatsapp_order_accepted', {
        customerMobile: custMobile,
        workerMobile: workerMobile,
        customerMessage: customerMsg,
        workerMessage: workerMsg
    });

    // Check if background WhatsApp webhook gateway is configured in Firebase settings
    database.ref('settings/whatsapp').once('value').then(snap => {
        const cfg = snap.val();
        if (cfg && cfg.webhookUrl && cfg.enabled) {
            fetch(cfg.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: custMobile,
                    message: customerMsg,
                    apiKey: cfg.apiKey || '',
                    instanceId: cfg.instanceId || ''
                })
            }).catch(e => console.warn('WhatsApp gateway send error:', e));
        }
    }).catch(() => {});
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

function getActiveOfferForCurrentWorker() {
    if (!allOrdersData || !currentWorkerUid) return null;
    const now = orderNow();
    const entry = Object.entries(allOrdersData).find(([id, order]) => {
        return order && order.status === 'Pending' &&
               order.offerWorkerUid === currentWorkerUid &&
               Number(order.offerExpiresAt) > now;
    });
    return entry ? { orderId: entry[0], order: entry[1] } : null;
}

function declineOrder(orderId) {
    if (!orderId || !currentWorkerUid) return;
    stopOrderAlert();
    database.ref('orders/' + orderId).transaction(current => {
        if (!current || current.status !== 'Pending' || current.offerWorkerUid !== currentWorkerUid) return;
        return {
            ...current,
            offerWorkerUid: null,
            offeredAt: null,
            offerExpiresAt: null,
            offerDeclines: { ...(current.offerDeclines || {}), [currentWorkerUid]: orderNow() }
        };
    }, () => {
        claimNextOffer();
        renderJobs();
    });
}

function claimNextOffer() {
    // Only 1 order offered at a time. If worker already has an active order or an active offer, do not claim another!
    if (offerClaimInFlight || !isDutyOn || !currentWorkerUid || getActiveOrderForCurrentWorker() || getActiveOfferForCurrentWorker() || !allOrdersData) return;
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
        renderJobs();
    });
}

function expireCurrentOffer() {
    if (!currentWorkerUid || !allOrdersData) return;
    const now = orderNow();
    Object.entries(allOrdersData).forEach(([orderId, order]) => {
        if (order.status !== 'Pending' || order.offerWorkerUid !== currentWorkerUid || Number(order.offerExpiresAt) > now) return;
        stopOrderAlert();
        database.ref('orders/' + orderId).transaction(current => {
            if (!current || current.status !== 'Pending' || current.offerWorkerUid !== currentWorkerUid || Number(current.offerExpiresAt) > orderNow()) return;
            return {
                ...current,
                offerWorkerUid: null,
                offeredAt: null,
                offerExpiresAt: null,
                offerDeclines: { ...(current.offerDeclines || {}), [currentWorkerUid]: orderNow() }
            };
        }, () => {
            claimNextOffer();
            renderJobs();
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
        const secLeft = Math.max(0, Math.ceil((Number(el.dataset.offerExpires) - now) / 1000));
        el.textContent = `${secLeft} sec left`;
        const alertSub = document.getElementById('incomingOrderAlertSub');
        if (alertSub && currentAlertOrderId && allOrdersData?.[currentAlertOrderId]) {
            const currentItem = allOrdersData[currentAlertOrderId];
            const budgetVal = (currentItem.budget || '₹500').replace('₹', '');
            alertSub.innerText = `${currentItem.service || 'काम'} • ₹${budgetVal} • ${secLeft} सेकंदात स्वीकारा`;
        }
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

function resolveWorkerName(userData) {
    if (!userData) return "";

    const candidates = [
        userData.fullName,
        userData.name,
        userData.workerName,
        userData.username,
        userData.userName,
        userData.displayName
    ];
    for (const c of candidates) {
        if (c && typeof c === 'string' && c.trim() && c.trim().toLowerCase() !== 'worker') {
            return c.trim();
        }
    }

    const mobile = userData.mobile || getCurrentWorkerMobile();
    if (mobile) {
        const keysToTry = [
            'gharmitra_user_worker_' + mobile,
            'gharkam_user_' + mobile,
            'gharmitra_user_' + mobile,
            'gharmitra_user_customer_' + mobile,
            'worker_profile',
            'customer_profile'
        ];

        for (const k of keysToTry) {
            try {
                const raw = localStorage.getItem(k);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const n = parsed.fullName || parsed.name || parsed.workerName || parsed.customerName || parsed.username || parsed.userName;
                    if (n && typeof n === 'string' && n.trim() && n.trim().toLowerCase() !== 'worker') {
                        return n.trim();
                    }
                }
            } catch (e) {}
        }
    }

    return "";
}

function applyWorkerName(foundName) {
    if (!foundName || foundName === "Worker") return;
    const el = document.getElementById('workerUsername');
    if (el) el.innerText = foundName;
    try {
        let s = JSON.parse(localStorage.getItem('current_user_session') || '{}');
        s.fullName = foundName;
        s.name = foundName;
        localStorage.setItem('current_user_session', JSON.stringify(s));
    } catch (e) {}
}

function editWorkerName() {
    const currentName = document.getElementById('workerUsername').innerText.trim();
    const promptDefault = (currentName === "Worker" || currentName === "Loading...") ? "" : currentName;
    const newName = prompt("तुमचे नाव टाका (Enter your name):", promptDefault);
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();

    applyWorkerName(trimmed);

    const mobile = getCurrentWorkerMobile();
    if (mobile) {
        ['gharmitra_user_worker_' + mobile, 'gharkam_user_' + mobile, 'gharmitra_user_' + mobile].forEach(k => {
            try {
                let cur = JSON.parse(localStorage.getItem(k) || '{}');
                cur.fullName = trimmed;
                cur.name = trimmed;
                localStorage.setItem(k, JSON.stringify(cur));
            } catch (e) {}
        });
    }

    const uid = currentWorkerUid || getLocalWorkerId();
    if (uid) {
        database.ref('workers/' + uid).update({ name: trimmed, fullName: trimmed });
    }

    alert("नाव अपडेट झाले: " + trimmed);
}

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

        let name = resolveWorkerName(userData);
        const service = userData.workType || userData.service || "Cleaning";

        updateWorkerUI({
            name: name || "Worker",
            service: service,
            wallet: userData.balance || 50,
            workerIndex: userData.mobile ? userData.mobile.slice(-6) : 100001
        });

        // Fallback: Query Firebase worker node or order history
        const workerMobile = userData.mobile || getCurrentWorkerMobile();
        const uid = currentWorkerUid || getLocalWorkerId();
        if (uid) {
            database.ref('workers/' + uid).on('value', (snap) => {
                const wData = snap.val();
                if (wData) {
                    const fbName = wData.name || wData.fullName || wData.workerName;
                    if (fbName && fbName !== "Worker") {
                        applyWorkerName(fbName);
                    }
                    let calcRating = 5.0;
                    let calcReviews = 0;
                    if (wData.ratings && typeof wData.ratings === 'object') {
                        const rList = Object.values(wData.ratings);
                        calcReviews = rList.length;
                        if (calcReviews > 0) {
                            const sum = rList.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
                            calcRating = Number((sum / calcReviews).toFixed(1));
                        }
                    } else if (wData.rating !== undefined || wData.totalReviews !== undefined) {
                        calcRating = Number(wData.rating || 5.0);
                        calcReviews = Number(wData.totalReviews || 0);
                    }
                    const avgEl = document.getElementById('workerAvgRating');
                    const revEl = document.getElementById('workerTotalReviews');
                    if (avgEl) avgEl.innerText = calcRating.toFixed(1);
                    if (revEl) revEl.innerText = calcReviews;
                }
            });

            if (workerMobile) {
                database.ref('orders').orderByChild('customerMobile').equalTo(workerMobile).limitToLast(5).once('value').then(oSnap => {
                    const orders = oSnap.val();
                    if (orders) {
                        const found = Object.values(orders).find(o => o.customerName && o.customerName !== 'Worker');
                        if (found) applyWorkerName(found.customerName);
                    }
                });
            }
        }

        loadWorkerEarnings(currentWorkerUid);
    } else {
        renderEarningsChart([0, 0, 0, 0, 0, 0, 0]);
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
    workerTripCustomerMarker = null;
    workerTripRouteLine = null;
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

    const currentOrder = (allOrdersData && allOrdersData[orderId]) ? allOrdersData[orderId] : {};
    const custCoords = getCustomerCoordinates(currentOrder);
    const workerLatLng = [Number(location.lat), Number(location.lng)];
    const custLatLng = [custCoords.lat, custCoords.lng];

    // Worker Marker (Moving Motorcycle)
    if (!workerTripMarker) {
        workerTripMarker = L.marker(workerLatLng, {
            icon: L.divIcon({
                className: '',
                html: `<div class="delivery-worker-marker">
                         <div class="delivery-marker-pulse"></div>
                         <div class="delivery-marker-icon worker-bike"><i class="fa-solid fa-motorcycle"></i></div>
                         <div class="delivery-marker-label">तुम्ही (You)</div>
                       </div>`,
                iconSize: [42, 42],
                iconAnchor: [21, 21]
            })
        }).addTo(workerTripMap);
    } else {
        workerTripMarker.setLatLng(workerLatLng);
    }

    // Customer Marker (House Pin)
    if (!workerTripCustomerMarker) {
        const custName = currentOrder.customerName ? currentOrder.customerName.split(' ')[0] : 'Customer';
        workerTripCustomerMarker = L.marker(custLatLng, {
            icon: L.divIcon({
                className: '',
                html: `<div class="delivery-home-marker">
                         <div class="delivery-marker-icon home-pin"><i class="fa-solid fa-house-chimney"></i></div>
                         <div class="delivery-marker-label">🏠 ${custName}</div>
                       </div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            })
        }).addTo(workerTripMap);
    } else {
        workerTripCustomerMarker.setLatLng(custLatLng);
    }

    // Route Polyline (Worker -> Customer)
    const routePoints = [workerLatLng, custLatLng];
    if (!workerTripRouteLine) {
        workerTripRouteLine = L.polyline(routePoints, {
            color: '#2563eb',
            weight: 4,
            opacity: 0.85,
            dashArray: '7, 8'
        }).addTo(workerTripMap);
    } else {
        workerTripRouteLine.setLatLngs(routePoints);
    }

    // Auto-fit bounds so both Worker and Customer house are visible
    try {
        workerTripMap.fitBounds([workerLatLng, custLatLng], {
            padding: [45, 45],
            maxZoom: 16
        });
    } catch(e) {}

    // Distance & ETA calculation
    const distKm = calculateDistanceKm(workerLatLng[0], workerLatLng[1], custLatLng[0], custLatLng[1]);
    const etaMin = calculateEtaMinutes(distKm);
    const formattedDist = formatDistance(distKm);

    const metaEl = document.getElementById('workerTripLocationMeta');
    const etaEl = document.getElementById('workerTripEta');
    const distEl = document.getElementById('workerTripDistance');
    const navBtn = document.getElementById('workerNavBtn');

    if (metaEl) {
        const updatedAt = Number(location.updatedAt);
        metaEl.innerHTML = Number.isFinite(updatedAt) && updatedAt > 0
            ? `<i class="fa-solid fa-satellite-dish text-emerald-500"></i> GPS अपडेट ` + new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : `<i class="fa-solid fa-satellite-dish text-emerald-500"></i> Live GPS सुरू आहे...`;
    }
    if (distEl) {
        distEl.innerText = formattedDist;
    }
    if (etaEl) {
        etaEl.innerText = `~${etaMin} मिनिटे`;
    }
    if (navBtn) {
        navBtn.href = `https://www.google.com/maps/dir/?api=1&origin=${workerLatLng[0]},${workerLatLng[1]}&destination=${custLatLng[0]},${custLatLng[1]}&travelmode=driving`;
    }
}

function publishWorkerLocation(orderId, position) {
    const coords = position.coords;
    const currentOrder = (allOrdersData && allOrdersData[orderId]) ? allOrdersData[orderId] : {};
    const custCoords = getCustomerCoordinates(currentOrder);

    const workerLat = Number(coords.latitude.toFixed(6));
    const workerLng = Number(coords.longitude.toFixed(6));
    const distKm = calculateDistanceKm(workerLat, workerLng, custCoords.lat, custCoords.lng);
    const etaMin = calculateEtaMinutes(distKm);
    const formattedDist = formatDistance(distKm);

    const liveLocation = {
        lat: workerLat,
        lng: workerLng,
        accuracy: Math.round(coords.accuracy || 0),
        distanceKm: Number(distKm.toFixed(2)),
        formattedDistance: formattedDist,
        etaMinutes: etaMin,
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

                let calcRating = 5.0;
                let calcTotalReviews = 0;
                if (workerData.ratings && typeof workerData.ratings === 'object') {
                    const rList = Object.values(workerData.ratings);
                    calcTotalReviews = rList.length;
                    if (calcTotalReviews > 0) {
                        const sum = rList.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
                        calcRating = Number((sum / calcTotalReviews).toFixed(1));
                    }
                } else if (workerData.rating !== undefined || workerData.totalReviews !== undefined) {
                    calcRating = Number(workerData.rating || 5.0);
                    calcTotalReviews = Number(workerData.totalReviews || 0);
                }

                const combinedData = {
                    name: finalName,
                    service: finalService,
                    wallet: workerData.wallet !== undefined ? workerData.wallet : (localSession.balance || 50),
                    workerIndex: workerData.workerIndex || Math.floor(100000 + Math.random() * 900000),
                    rating: calcRating,
                    totalReviews: calcTotalReviews
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
    const uid = workerUid || currentWorkerUid || getLocalWorkerId();
    const mobile = getCurrentWorkerMobile();

    function processOrders(orders) {
        let todaySum = 0;
        let todayCount = 0;
        let weeklyData = [0, 0, 0, 0, 0, 0, 0];
        let orderRatingSum = 0;
        let orderRatingCount = 0;

        const now = new Date();
        const todayYear = now.getFullYear();
        const todayMonth = now.getMonth();
        const todayDate = now.getDate();

        // Calculate Monday 00:00:00 of the current week
        const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
        const startOfWeek = new Date(todayYear, todayMonth, todayDate - currentDayOfWeek, 0, 0, 0, 0).getTime();
        const endOfWeek = startOfWeek + (7 * 24 * 60 * 60 * 1000);

        if (orders && (uid || mobile)) {
            Object.values(orders).forEach(order => {
                if (!order || order.status !== 'Completed') return;

                // Match worker: by UID or Mobile number
                const isMatch = (
                    (uid && (order.workerUid === uid || order.workerUid === ('local_worker_' + mobile))) ||
                    (mobile && (order.workerMobile === mobile || order.workerUid === ('local_worker_' + mobile)))
                );

                if (!isMatch) return;

                const amount = parseInt(order.budget ? String(order.budget).replace(/[^0-9]/g, '') : '500') || 500;

                // Determine order completion time / date
                let orderTime = order.completedAt || order.timestamp;
                if (!orderTime && order.date) {
                    const parsed = new Date(order.date).getTime();
                    if (!isNaN(parsed)) orderTime = parsed;
                }
                if (!orderTime) orderTime = Date.now();

                const orderDateObj = new Date(orderTime);

                // Today's check (calendar day match or order.date match)
                const isToday = (
                    orderDateObj.getFullYear() === todayYear &&
                    orderDateObj.getMonth() === todayMonth &&
                    orderDateObj.getDate() === todayDate
                ) || (order.date && (
                    order.date === (todayYear + '-' + String(todayMonth + 1).padStart(2, '0') + '-' + String(todayDate).padStart(2, '0'))
                ));

                if (isToday) {
                    todaySum += amount;
                    todayCount++;
                }

                // Current week check
                if (orderTime >= startOfWeek && orderTime < endOfWeek) {
                    const dayIndex = (orderDateObj.getDay() + 6) % 7; // Mon=0 .. Sun=6
                    weeklyData[dayIndex] += amount;
                }

                // Ratings check
                if (order.customerRating || order.rating) {
                    const r = Number(order.customerRating || order.rating) || 5;
                    orderRatingSum += r;
                    orderRatingCount++;
                }
            });
        }

        if (orderRatingCount > 0) {
            const currentDisplayedReviews = parseInt(document.getElementById('workerTotalReviews')?.innerText || '0', 10);
            if (orderRatingCount >= currentDisplayedReviews) {
                const avg = Number((orderRatingSum / orderRatingCount).toFixed(1));
                const avgEl = document.getElementById('workerAvgRating');
                const revEl = document.getElementById('workerTotalReviews');
                if (avgEl) avgEl.innerText = avg.toFixed(1);
                if (revEl) revEl.innerText = orderRatingCount;
            }
        }

        const todayEarningsEl = document.getElementById('todayEarnings');
        const todayJobsCountEl = document.getElementById('todayJobsCount');
        if (todayEarningsEl) todayEarningsEl.innerText = todaySum;
        if (todayJobsCountEl) todayJobsCountEl.innerText = todayCount;

        renderEarningsChart(weeklyData);
    }

    if (allOrdersData) {
        processOrders(allOrdersData);
    } else {
        database.ref('orders').once('value').then(snapshot => {
            processOrders(snapshot.val());
        }).catch(err => {
            console.warn('Error loading worker earnings:', err);
            renderEarningsChart([0, 0, 0, 0, 0, 0, 0]);
        });
    }
}

function renderEarningsChart(dataVals) {
    const canvas = document.getElementById('weeklyEarningsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
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
    getAudioContext();
    if (!isDutyOn) {
        stopOrderAlert();
    }
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
    loadWorkerEarnings();
});

function renderJobs() {
    const jobsContainer = document.getElementById('availableJobsContainer');
    const acceptedContainer = document.getElementById('acceptedJobsContainer');
    const jobCountBadge = document.getElementById('jobCount');
    const selectedArea = document.getElementById('workingAreaSelect').value;

    destroyWorkerTripMap();
    acceptedContainer.innerHTML = "";

    if (!isDutyOn) {
        stopOrderAlert();
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
    let foundExclusiveOfferKey = null;
    let foundExclusiveOfferItem = null;

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
        // STTRICTLY ONE ORDER AT A TIME: Only render if pendingCount === 0
        if (pendingCount === 0 && !activeOrderId && item.status === 'Pending' && isAreaMatch && isServiceMatch && isCurrentWorkersOffer) {
            pendingCount++;
            foundExclusiveOfferKey = key;
            foundExclusiveOfferItem = item;
            const jobCard = document.createElement('div');
            jobCard.className = "bg-white border-2 border-blue-500 p-4 rounded-2xl shadow-lg space-y-3 relative overflow-hidden";
            const photoHtml = imgUrl ? `<div class="my-2"><div class="relative cursor-pointer group rounded-xl overflow-hidden border border-slate-200" onclick="openImagePreview('${imgUrl}')"><img src="${imgUrl}" class="w-full h-44 object-cover"></div></div>` : '';

            jobCard.innerHTML = `
            <div class="flex justify-between items-start">
            <div><span class="bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full">⚡ ${item.service}</span><h4 class="font-bold text-slate-800 text-sm mt-2"><i class="fa-solid fa-user text-blue-600"></i> ${item.customerName}</h4></div>
            <span class="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">${item.budget || '₹500'}</span>
            </div>
            <div class="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p><i class="fa-solid fa-location-dot text-red-500 mr-1.5"></i><strong>पत्ता:</strong> ${item.address}</p>
            <p><i class="fa-regular fa-calendar text-blue-500 mr-1.5"></i><strong>तारीख:</strong> ${item.date || 'Not specified'}</p>
            <p><i class="fa-regular fa-clock text-blue-500 mr-1.5"></i><strong>वेळ:</strong> ${item.time || 'Not specified'}</p>
            <p class="text-slate-400"><i class="fa-solid fa-lock mr-1.5"></i>मोबाइल नंबर On The Way केल्यानंतर दिसेल.</p>
            </div>
            ${photoHtml}
            <div class="flex items-center justify-between text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-2 rounded-xl">
                <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> नवीन काम स्वीकारा</span>
                <span class="bg-amber-200/80 px-2.5 py-0.5 rounded-md font-extrabold" data-offer-expires="${item.offerExpiresAt}">30 sec left</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
            <button onclick="acceptOrder('${key}')" class="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5">🤝 Accept Order</button>
            <button onclick="declineOrder('${key}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1 border border-slate-200" title="हे काम सोडून पुढील काम पहा">❌ Skip</button>
            </div>
            <a href="https://maps.google.com/?q=${encodeURIComponent(item.address)}" target="_blank" class="block text-center text-[11px] font-bold text-emerald-600 hover:underline py-1"><i class="fa-solid fa-map-location-dot mr-1"></i> नकाशावर पत्ता पहा</a>`;
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
            <p><strong>पत्ता:</strong> ${item.address}</p>
            <p><strong>तारीख:</strong> ${item.date || 'Not specified'}</p>
            <p><strong>वेळ:</strong> ${item.time || 'Not specified'}</p>
            ${item.status === 'On The Way'
                ? `<p><strong>मोबाइल:</strong> <a href="tel:${item.customerMobile}" class="text-blue-600 font-bold underline">${item.customerMobile || 'Not available'}</a></p>`
                : `<p class="text-slate-500"><i class="fa-solid fa-lock mr-1"></i>मोबाइल नंबर On The Way केल्यानंतर दिसेल.</p>`}
            </div>
            ${item.status === 'Accepted' ? `<div class="flex items-center justify-between text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg"><span>Mark On The Way within 15 minutes</span><span data-on-the-way-deadline="${item.onTheWayDeadline || orderNow()}">15:00 left to start</span></div>` : ''}
             <div class="worker-live-card">
                 <div class="flex items-center justify-between gap-3 mb-3">
                     <span class="text-xs font-black tracking-[.12em] text-slate-900 flex items-center gap-2">
                         <span class="live-dot"></span>
                         🛵 LIVE GPS & ROUTE TRACKING
                     </span>
                     <span id="workerTripStatus" class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">Ready to start</span>
                 </div>
                 <div class="worker-live-map-shell">
                     <span class="live-map-chip"><i class="fa-solid fa-motorcycle text-blue-600"></i> थेट रस्ता (Live Route)</span>
                     <div id="workerTripMap" aria-label="Worker live route map"></div>
                     <div class="tracking-eta-card">
                         <div class="flex items-center justify-between gap-4">
                             <div>
                                 <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">ग्राहकाचे अंतर</span>
                                 <strong id="workerTripDistance" class="text-blue-600 text-sm">--</strong>
                             </div>
                             <div class="border-l border-slate-200 pl-3">
                                 <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">अंदाजे वेळ</span>
                                 <strong id="workerTripEta" class="text-emerald-600 text-sm">--</strong>
                             </div>
                         </div>
                     </div>
                 </div>
                 <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mt-3">
                     <span id="workerTripLocationMeta" class="text-[10px] text-slate-500 flex items-center gap-1">
                         <i class="fa-solid fa-satellite-dish text-emerald-500"></i> On The Way केल्यावर live GPS सुरू होईल
                     </span>
                     <a id="workerNavBtn" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-xl text-[11px] transition shadow-sm flex items-center justify-center gap-1.5 shrink-0">
                         <i class="fa-solid fa-diamond-turn-right"></i> Google Navigation
                     </a>
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
        stopOrderAlert();
    } else if (foundExclusiveOfferKey && foundExclusiveOfferItem) {
        startOrderAlert(foundExclusiveOfferKey, foundExclusiveOfferItem);
    } else {
        stopOrderAlert();
    }

    jobCountBadge.innerText = `${pendingCount} New Jobs`;
    updateDeadlineLabels();
}

function acceptOrder(orderId) {
    stopOrderAlert();
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
                        workerId: currentWorkerUid,
                        workerMobile: getCurrentWorkerMobile(),
                        workerName: document.getElementById('workerUsername')?.innerText || 'Worker',
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
                    if (allOrdersData?.[orderId]) {
                        triggerWhatsAppAlertsOnOrderAccept(orderId, allOrdersData[orderId], getCurrentWorkerMobile());
                    }
                    alert("तुम्ही हे काम यशस्वीरीत्या स्वीकारले आहे! 15 मिनिटांच्या आत On The Way करा.");
                }
            );
        }
    );
}


// =========================================================
// Work Completion OTP Verification Functions
// =========================================================

function openWorkCompletionOtpModal(orderId) {
    const activeOrder = getActiveOrderForCurrentWorker();
    if (!activeOrder || activeOrder.orderId !== orderId) {
        alert("ही order तुमची active order नाही.");
        return;
    }

    currentCompletingOrderId = orderId;
    const orderData = activeOrder.order;
    const modal = document.getElementById('completionOtpModal');
    const input = document.getElementById('workCompletionOtpInput');
    const statusMsg = document.getElementById('completionOtpStatusMsg');

    if (input) input.value = '';
    if (statusMsg) {
        statusMsg.className = 'hidden';
        statusMsg.innerText = '';
    }

    // Generate or read 4-digit OTP
    let otp = orderData.completionOtp;
    if (!otp) {
        otp = String(Math.floor(1000 + Math.random() * 9000));
        database.ref("orders/" + orderId).update({
            completionOtp: otp,
            otpGeneratedAt: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // Send email to customer via EmailJS
    sendCompletionOtpEmail(orderData, otp);

    if (modal) modal.classList.remove('hidden');
    if (input) setTimeout(() => input.focus(), 150);
}

function closeCompletionOtpModal() {
    const modal = document.getElementById('completionOtpModal');
    if (modal) modal.classList.add('hidden');
    const input = document.getElementById('workCompletionOtpInput');
    if (input) input.value = '';
}

function sendCompletionOtpEmail(orderData, otp) {
    let customerEmail = orderData.customerEmail || '';
    if (!customerEmail && orderData.customerMobile) {
        const savedUser = localStorage.getItem('gharmitra_user_customer_' + orderData.customerMobile) || localStorage.getItem('gharmitra_user_' + orderData.customerMobile);
        if (savedUser) {
            try { customerEmail = JSON.parse(savedUser).email || ''; } catch(e) {}
        }
    }

    if (customerEmail && window.emailjs) {
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: customerEmail,
            email: customerEmail,
            user_email: customerEmail,
            otp_code: otp,
            message: `Gharmitra.online काम पूर्ण करण्यासाठी OTP आहे: ${otp}. काम पूर्ण झाल्यावर हा ४-अंकी OTP कामगाराला सांगा.`
        }).then(() => {
            console.log("Work Completion OTP sent to email:", customerEmail);
        }).catch(err => {
            console.warn("EmailJS sending error:", err);
        });
    }
}

function resendCompletionOtp() {
    if (!currentCompletingOrderId) return;
    const activeOrder = getActiveOrderForCurrentWorker();
    if (!activeOrder) return;

    const resendBtn = document.getElementById('resendOtpBtn');
    if (resendBtn) resendBtn.innerText = "पाठवत आहे...";

    const newOtp = String(Math.floor(1000 + Math.random() * 9000));
    database.ref("orders/" + currentCompletingOrderId).update({
        completionOtp: newOtp,
        otpGeneratedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        sendCompletionOtpEmail(activeOrder.order, newOtp);
        const statusMsg = document.getElementById('completionOtpStatusMsg');
        if (statusMsg) {
            statusMsg.className = 'text-xs font-bold p-2.5 rounded-xl text-center bg-blue-50 text-blue-700 border border-blue-200 block';
            statusMsg.innerText = 'नवा ४-अंकी OTP ग्राहकाच्या ईमेलवर व स्क्रीनवर पाठवला आहे!';
        }
    }).finally(() => {
        if (resendBtn) resendBtn.innerHTML = '<i class="fa-solid fa-rotate-right mr-1"></i> OTP पुन्हा पाठवा (Resend OTP)';
    });
}

function verifyAndCompleteWork() {
    if (!currentCompletingOrderId) return;
    const input = document.getElementById('workCompletionOtpInput');
    const enteredOtp = (input ? input.value : '').trim();
    const statusMsg = document.getElementById('completionOtpStatusMsg');

    if (enteredOtp.length !== 4) {
        if (statusMsg) {
            statusMsg.className = 'text-xs font-bold p-2.5 rounded-xl text-center bg-red-50 text-red-600 border border-red-200 block';
            statusMsg.innerText = 'कृपया ग्राहकाकडून ४-अंकी OTP घेऊन येथे टाका.';
        }
        return;
    }

    // Verify OTP from Firebase directly to prevent any bypass
    database.ref("orders/" + currentCompletingOrderId).once("value").then(snap => {
        const orderData = snap.val();
        if (!orderData) {
            alert("ऑर्डर सापडली नाही.");
            return;
        }

        const validOtp = String(orderData.completionOtp || '').trim();
        if (!validOtp || enteredOtp !== validOtp) {
            if (statusMsg) {
                statusMsg.className = 'text-xs font-bold p-2.5 rounded-xl text-center bg-red-50 text-red-600 border border-red-200 block animate-shake';
                statusMsg.innerText = '❌ चुकीचा OTP! ग्राहकाच्या ईमेल किंवा स्क्रीनवरील योग्य OTP टाका.';
            }
            return;
        }

        // OTP Verified Successfully! Finalize work completion
        finalizeOrderCompletion(currentCompletingOrderId);
    });
}

function finalizeOrderCompletion(orderId) {
    stopOrderAlert();
    const btn = document.getElementById('verifyOtpBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> पूर्ण करत आहे...';
    }

    stopLocationSharing(orderId, true).then(() =>
        database.ref("orders/" + orderId).update({
            status: 'Completed',
            workerLocation: null,
            completionOtpVerified: true,
            offerWorkerUid: null,
            offerExpiresAt: null,
            offeredAt: null,
            completedAt: firebase.database.ServerValue.TIMESTAMP
        })
    ).then(() => {
        return releaseActiveOrderLock(orderId);
    }).then(() => {
        stopOrderAlert();
        closeCompletionOtpModal();
        loadWorkerEarnings();
        alert("🎉 OTP यशस्वीरीत्या व्हेरिफाय झाला! काम पूर्ण झाले आहे.");
        renderJobs();
    }).catch(error => {
        console.error("Completion error:", error);
        alert("काम पूर्ण करताना अडचण आली: " + error.message);
    }).finally(() => {
        stopOrderAlert();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> व्हेरिफाय करा';
        }
    });
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

    // Work Completion REQUIRES Customer OTP Verification
    if (newStatus === 'Completed') {
        openWorkCompletionOtpModal(orderId);
        return;
    }

    database.ref("orders/" + orderId).update({
        status: newStatus,
        onTheWayAt: firebase.database.ServerValue.TIMESTAMP,
        onTheWayDeadline: null
    }).then(() => {
        if (newStatus === 'On The Way') {
            startLocationSharing(orderId);
            queueNotification(orderId, 'worker_on_the_way', {
                workerMobile: getCurrentWorkerMobile(),
                customerMobile: activeOrder.order.customerMobile || ''
            });
        }
        alert("स्टेटस अपडेट केले: " + newStatus);
    }).catch(error => {
        console.error("Status update error:", error);
        alert("स्टेटस अपडेट करताना अडचण आली.");
    });
}
