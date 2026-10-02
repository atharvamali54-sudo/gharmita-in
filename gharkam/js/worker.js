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
let currentWorkerVerificationStatus = 'pending'; // 'pending' | 'approved' | 'rejected'
let currentWorkerRejectReason = '';
let currentWorkerAadharPhoto = null;
let reuploadAadharBase64 = null;

// Pune Area Coordinates for delivery routing
const PUNE_AREA_COORDINATES = {
    "Kothrud": { lat: 18.5074, lng: 73.8077 },
    "Baner": { lat: 18.5590, lng: 73.7868 },
    "Wakad": { lat: 18.5987, lng: 73.7661 },
    "Hinjawadi": { lat: 18.5913, lng: 73.7389 },
    "Viman Nagar": { lat: 18.5679, lng: 73.9143 },
    "Kharadi": { lat: 18.5516, lng: 73.9348 },
    "Hadapsar": { lat: 18.5089, lng: 73.9259 },
    "Aundh": { lat: 18.5626, lng: 73.8087 },
    "Shivajinagar": { lat: 18.5314, lng: 73.8446 },
    "Pimpri": { lat: 18.6279, lng: 73.8009 },
    "Chinchwad": { lat: 18.6298, lng: 73.7823 },
    "Bhosari": { lat: 18.6247, lng: 73.8504 },
    "Nigdi": { lat: 18.6529, lng: 73.7674 },
    "Sangvi": { lat: 18.5772, lng: 73.8156 },
    "Pashan": { lat: 18.5414, lng: 73.7929 },
    "Bavdhan": { lat: 18.5158, lng: 73.7819 },
    "Warje": { lat: 18.4795, lng: 73.7992 },
    "Sinhagad Road": { lat: 18.4735, lng: 73.8228 },
    "Dhankawadi": { lat: 18.4682, lng: 73.8519 },
    "Katraj": { lat: 18.4575, lng: 73.8677 },
    "Bibwewadi": { lat: 18.4692, lng: 73.8617 },
    "Kondhwa": { lat: 18.4695, lng: 73.8890 },
    "Undri": { lat: 18.4552, lng: 73.9080 },
    "Pisoli": { lat: 18.4414, lng: 73.9174 },
    "Handewadi": { lat: 18.4746, lng: 73.9367 },
    "Wanowrie": { lat: 18.4905, lng: 73.8966 },
    "Camp": { lat: 18.5133, lng: 73.8785 },
    "Koregaon Park": { lat: 18.5362, lng: 73.8940 },
    "Kalyani Nagar": { lat: 18.5482, lng: 73.9038 },
    "Yerawada": { lat: 18.5529, lng: 73.8797 },
    "Vishrantwadi": { lat: 18.5683, lng: 73.8763 },
    "Dhanori": { lat: 18.5867, lng: 73.8856 },
    "Lohegaon": { lat: 18.5997, lng: 73.9268 },
    "Wagholi": { lat: 18.5808, lng: 73.9787 },
    "Chandan Nagar": { lat: 18.5539, lng: 73.9272 },
    "Kharadi IT Park": { lat: 18.5516, lng: 73.9348 },
    "Magarpatta": { lat: 18.5167, lng: 73.9287 },
    "Fatima Nagar": { lat: 18.5029, lng: 73.8988 },
    "Salunke Vihar": { lat: 18.4789, lng: 73.8943 },
    "NIBM": { lat: 18.4770, lng: 73.8989 },
    "Mohammed Wadi": { lat: 18.4754, lng: 73.9152 },
    "Market Yard": { lat: 18.4877, lng: 73.8647 },
    "Swargate": { lat: 18.5018, lng: 73.8636 },
    "Deccan": { lat: 18.5173, lng: 73.8415 },
    "FC Road": { lat: 18.5246, lng: 73.8415 },
    "JM Road": { lat: 18.5284, lng: 73.8465 },
    "Model Colony": { lat: 18.5342, lng: 73.8344 },
    "Senapati Bapat Road": { lat: 18.5312, lng: 73.8298 },
    "Law College Road": { lat: 18.5165, lng: 73.8302 },
    "Karve Nagar": { lat: 18.4912, lng: 73.8189 },
    "Balewadi": { lat: 18.5772, lng: 73.7717 },
    "Mahalunge": { lat: 18.5685, lng: 73.7483 },
    "Pimple Saudagar": { lat: 18.5987, lng: 73.7978 },
    "Pimple Gurav": { lat: 18.5833, lng: 73.8143 },
    "Tathawade": { lat: 18.6186, lng: 73.7513 },
    "Punawale": { lat: 18.6291, lng: 73.7428 },
    "Ravet": { lat: 18.6473, lng: 73.7381 },
    "Moshi": { lat: 18.6732, lng: 73.8504 }
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
            const hasVoice = (orderDetails.voiceNoteUrl || orderDetails.hasVoiceNote) ? ' • 🎙️ व्हॉइस मेसेज' : '';
            alertSub.innerText = `${orderDetails.service || 'नवीन काम'} • ₹${budgetVal} • ${orderDetails.area || 'Pune'}${hasVoice}`;
        }
        alertModal.classList.remove('hidden');
    }

    // Trigger OS-level system push notification (Sound + Vibration on lockscreen/background)
    if (window.GharmitraPush && typeof window.GharmitraPush.showSystemNotification === 'function') {
        const srv = (orderDetails && orderDetails.service) ? orderDetails.service : 'नवीन काम';
        const cost = (orderDetails && orderDetails.budget) ? orderDetails.budget : '₹500';
        const loc = (orderDetails && orderDetails.area) ? orderDetails.area : 'पुणे';
        window.GharmitraPush.showSystemNotification({
            title: `⚡ नवीन ऑर्डर उपलब्ध: ${srv} (${cost})`,
            body: `पत्ता: ${loc}. त्वरित स्वीकारा आणि आजच कमाई सुरू करा!`,
            url: 'worker.html',
            tag: 'order-alert-' + (orderId || 'new')
        });
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
    // Only 1 order offered at a time. If worker already has an active order or an active offer, or is not approved, do not claim another!
    if (offerClaimInFlight || !isDutyOn || currentWorkerVerificationStatus !== 'approved' || !currentWorkerUid || getActiveOrderForCurrentWorker() || getActiveOfferForCurrentWorker() || !allOrdersData) return;
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
            const hasVoice = (currentItem.voiceNoteUrl || currentItem.hasVoiceNote) ? ' • 🎙️ व्हॉइस मेसेज' : '';
            alertSub.innerText = `${currentItem.service || 'काम'} • ₹${budgetVal} • ${secLeft} सेकंदात स्वीकारा${hasVoice}`;
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

// Instant Worker Avatar Render on Startup
(function initWorkerPhotoImmediately() {
    try {
        const session = JSON.parse(localStorage.getItem('current_user_session') || '{}');
        let photo = session.photo || session.photoUrl;
        if (!photo && session.mobile) {
            try {
                const k1 = JSON.parse(localStorage.getItem('gharmitra_user_worker_' + session.mobile) || '{}');
                photo = k1.photo || k1.photoUrl || null;
            } catch(e) {}
        }
        if (photo) {
            const setAvatar = () => {
                const el = document.getElementById('workerHeaderAvatar');
                if (el) el.src = photo;
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setAvatar);
            } else {
                setAvatar();
            }
        }
    } catch(e) {}
})();

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

function applyWorkerPhoto(photoUrl) {
    if (!photoUrl) return;
    const headerImg = document.getElementById('workerHeaderAvatar');
    if (headerImg) headerImg.src = photoUrl;
    const topImg = document.getElementById('topWorkerAvatar');
    if (topImg) topImg.src = photoUrl;
    const topBadge = document.getElementById('topWorkerAvatarBadge');
    if (topBadge) topBadge.classList.remove('hidden');
    const modalImg = document.getElementById('workerModalPhotoPreview');
    if (modalImg) modalImg.src = photoUrl;
    try {
        let s = JSON.parse(localStorage.getItem('current_user_session') || '{}');
        s.photo = photoUrl;
        s.photoUrl = photoUrl;
        localStorage.setItem('current_user_session', JSON.stringify(s));
        if (s.mobile) {
            ['gharmitra_user_worker_' + s.mobile, 'gharkam_user_' + s.mobile, 'gharmitra_user_' + s.mobile].forEach(k => {
                try {
                    let cur = JSON.parse(localStorage.getItem(k) || '{}');
                    cur.photo = photoUrl;
                    cur.photoUrl = photoUrl;
                    localStorage.setItem(k, JSON.stringify(cur));
                } catch (e) {}
            });
        }
    } catch (e) {}
}

function triggerWorkerDashboardPhotoChange() {
    const modal = document.getElementById('workerPhotoUpdateModal');
    const modalPreview = document.getElementById('workerModalPhotoPreview');
    const curAvatar = document.getElementById('workerHeaderAvatar');
    if (modalPreview && curAvatar) {
        modalPreview.src = curAvatar.src;
    }
    if (modal) modal.classList.remove('hidden');
}

function closeWorkerPhotoModal() {
    const modal = document.getElementById('workerPhotoUpdateModal');
    if (modal) modal.classList.add('hidden');
}

function triggerDashboardCamera() {
    const cam = document.getElementById('dashboardWorkerPhotoCamera');
    if (cam) cam.click();
}

function triggerDashboardGallery() {
    const gal = document.getElementById('dashboardWorkerPhotoGallery');
    if (gal) gal.click();
}

function compressWorkerDashboardImage(file, maxWidth = 360, maxHeight = 360, quality = 0.72) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.match(/image.*/)) {
            return reject(new Error('Selected file is not an image'));
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = () => reject(new Error('Image failed to load for compression'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('File reading error'));
        reader.readAsDataURL(file);
    });
}

async function handleDashboardWorkerPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
        const compressedBase64 = await compressWorkerDashboardImage(file, 360, 360, 0.72);
        applyWorkerPhoto(compressedBase64);
        closeWorkerPhotoModal();

        const mobile = getCurrentWorkerMobile();
        const uid = currentWorkerUid || getLocalWorkerId();

        if (mobile) {
            ['gharmitra_user_worker_' + mobile, 'gharkam_user_' + mobile, 'gharmitra_user_' + mobile].forEach(k => {
                try {
                    let cur = JSON.parse(localStorage.getItem(k) || '{}');
                    cur.photo = compressedBase64;
                    cur.photoUrl = compressedBase64;
                    localStorage.setItem(k, JSON.stringify(cur));
                } catch (e) {}
            });

            if (typeof database !== 'undefined') {
                database.ref('workers/accounts/workers/' + mobile).update({
                    photo: compressedBase64,
                    photoUrl: compressedBase64,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                }).catch(() => {});
            }
        }

        if (uid && typeof database !== 'undefined') {
            database.ref('workers/' + uid).update({
                photo: compressedBase64,
                photoUrl: compressedBase64
            }).catch(() => {});
        }

        alert("✅ कामगाराचा नवीन फोटो यशस्वीरित्या सेव्ह झाला!");
    } catch (err) {
        console.error("Dashboard photo change error:", err);
        alert("❌ फोटो सेव्ह करण्यात अडचण आली. कृपया दुसरा फोटो निवडा.");
    }
}

// =========================================================
// Worker Aadhaar KYC Verification & Status Controller
// =========================================================

function updateKycUI(status, rejectReason) {
    currentWorkerVerificationStatus = status || 'pending';
    currentWorkerRejectReason = rejectReason || '';

    const banner = document.getElementById('workerKycStatusBanner');
    const headerBadge = document.getElementById('workerKycHeaderBadge');
    const prevKycStatus = window._lastWorkerKycStatus;
    window._lastWorkerKycStatus = currentWorkerVerificationStatus;

    if (prevKycStatus && prevKycStatus !== 'approved' && currentWorkerVerificationStatus === 'approved') {
        if (window.GharmitraPush && typeof window.GharmitraPush.showSystemNotification === 'function') {
            window.GharmitraPush.showSystemNotification({
                title: '🎉 आधार KYC मंजूर झाले!',
                body: 'अभिनंदन! तुमचे घरमित्र प्रोफाइल मंजूर झाले आहे. तुम्ही आता Duty ON करून काम सुरू करू शकता.',
                url: 'worker.html',
                tag: 'kyc-approved'
            });
        }
    }

    if (currentWorkerVerificationStatus === 'approved') {
        if (headerBadge) {
            headerBadge.className = "bg-emerald-400/20 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1";
        }
        if (headerText) headerText.innerText = "✓ आधार व्हेरिफाइड पार्टनर";
        if (banner) {
            banner.className = "hidden";
            banner.innerHTML = "";
        }
    } else if (currentWorkerVerificationStatus === 'rejected') {
        if (headerBadge) {
            headerBadge.className = "bg-rose-500/20 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-400/30 flex items-center gap-1";
        }
        if (headerText) headerText.innerText = "✕ आधार नाकारले (Rejected)";
        if (banner) {
            banner.className = "mb-4 p-4 rounded-2xl shadow-sm text-xs transition bg-rose-50 border-rose-300 text-rose-900 flex items-start gap-3";
            banner.innerHTML = `
                <span class="text-2xl shrink-0">⚠️</span>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <strong class="font-bold text-rose-950 text-sm">आधार कार्ड पडताळणी नाकारली (KYC Rejected)</strong>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900 border border-rose-300">Rejected</span>
                    </div>
                    <p class="text-rose-800 leading-relaxed mb-2.5">
                        <strong>कारण:</strong> ${escapeHtml(currentWorkerRejectReason || "आधार कार्डचा फोटो अस्पष्ट आहे. कृपया पुन्हा स्पष्ट फोटो अपलोड करा.")}
                    </p>
                    <button type="button" onclick="openWorkerReuploadKycModal()" class="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow transition flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-id-card"></i> पुन्हा आधार कार्ड अपलोड करा
                    </button>
                </div>
            `;
        }
        if (isDutyOn) {
            isDutyOn = false;
            if (dutyBtn) {
                dutyBtn.className = "w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2 mb-6";
                dutyBtn.innerHTML = "🔴 Duty OFF (Click ON)";
            }
            const headerDot = document.getElementById('dutyDot');
            const headerDText = document.getElementById('dutyText');
            if (headerDot) headerDot.className = "w-2 h-2 rounded-full bg-red-500";
            if (headerDText) headerDText.innerText = "Duty OFF";
        }
    } else {
        // Pending Review
        if (headerBadge) {
            headerBadge.className = "bg-amber-400/20 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1 animate-pulse";
        }
        if (headerText) headerText.innerText = "⏳ आधार पडताळणी प्रलंबित";
        if (banner) {
            banner.className = "mb-4 p-4 rounded-2xl shadow-sm text-xs transition bg-amber-50 border-amber-300 text-amber-900 flex items-start gap-3";
            banner.innerHTML = `
                <span class="text-2xl shrink-0">⏳</span>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <strong class="font-bold text-amber-950 text-sm">आधार कार्ड पडताळणी प्रलंबित (KYC Under Review)</strong>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">Pending</span>
                    </div>
                    <p class="text-amber-800 leading-relaxed">
                        तुमचे आधार कार्ड ॲडमिन पडताळणीसाठी पाठवले आहे. महिला व कौटुंबिक सुरक्षिततेसाठी ॲडमिनने मंजूर (Approve) केल्यावरच तुम्ही <strong>Duty ON</strong> करू शकाल आणि नवीन कामे स्वीकारू शकाल.
                    </p>
                </div>
            `;
        }
        if (isDutyOn) {
            isDutyOn = false;
            if (dutyBtn) {
                dutyBtn.className = "w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2 mb-6";
                dutyBtn.innerHTML = "🔴 Duty OFF (Click ON)";
            }
            const headerDot = document.getElementById('dutyDot');
            const headerDText = document.getElementById('dutyText');
            if (headerDot) headerDot.className = "w-2 h-2 rounded-full bg-red-500";
            if (headerDText) headerDText.innerText = "Duty OFF";
        }
    }
}

function showWorkerKycAlertModal(status, rejectReason) {
    const modal = document.getElementById('workerKycAlertModal');
    const title = document.getElementById('kycAlertTitle');
    const desc = document.getElementById('kycAlertDesc');
    const icon = document.getElementById('kycAlertIcon');
    const actionBox = document.getElementById('kycAlertActionBox');
    if (!modal) return;

    if (status === 'rejected') {
        if (icon) icon.innerText = "⚠️";
        if (title) title.innerText = "आधार पडताळणी नाकारली गेली आहे";
        if (desc) desc.innerText = "कारण: " + (rejectReason || "आधार फोटो अस्पष्ट आहे. कृपया पुन्हा स्पष्ट आधार कार्ड अपलोड करा.");
        if (actionBox) {
            actionBox.innerHTML = `
                <button type="button" onclick="closeWorkerKycAlertModal(); openWorkerReuploadKycModal();" class="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-id-card"></i> पुन्हा आधार कार्ड अपलोड करा
                </button>
                <button type="button" onclick="closeWorkerKycAlertModal()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer">
                    रद्द करा
                </button>
            `;
        }
    } else {
        if (icon) icon.innerText = "⏳";
        if (title) title.innerText = "आधार पडताळणी प्रलंबित आहे (Pending)";
        if (desc) desc.innerText = "महिला व कौटुंबिक सुरक्षिततेसाठी घरमित्रच्या नियमानुसार ॲडमिनने आधार कार्ड मंजूर (Approve) केल्यावरच तुम्हाला Duty ON करता येईल आणि कामाच्या नोटिफिकेशन्स मिळतील.";
        if (actionBox) {
            actionBox.innerHTML = `
                <button type="button" onclick="closeWorkerKycAlertModal()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs shadow transition cursor-pointer">
                    समजले (OK)
                </button>
            `;
        }
    }
    modal.classList.remove('hidden');
}

function closeWorkerKycAlertModal() {
    const modal = document.getElementById('workerKycAlertModal');
    if (modal) modal.classList.add('hidden');
}

function openWorkerReuploadKycModal() {
    reuploadAadharBase64 = null;
    const modal = document.getElementById('reuploadKycModal');
    const preview = document.getElementById('reuploadAadharPreviewImg');
    const placeholder = document.getElementById('reuploadAadharPlaceholder');
    const camInput = document.getElementById('reuploadAadharCameraInput');
    const galInput = document.getElementById('reuploadAadharGalleryInput');

    if (camInput) camInput.value = '';
    if (galInput) galInput.value = '';
    if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
}

function closeWorkerReuploadKycModal() {
    const modal = document.getElementById('reuploadKycModal');
    if (modal) modal.classList.add('hidden');
}

function triggerReuploadAadharCamera() {
    const input = document.getElementById('reuploadAadharCameraInput');
    if (input) input.click();
}

function triggerReuploadAadharGallery() {
    const input = document.getElementById('reuploadAadharGalleryInput');
    if (input) input.click();
}

async function handleReuploadAadharSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
        const compressed = await compressWorkerDashboardImage(file, 900, 900, 0.78);
        reuploadAadharBase64 = compressed;
        const preview = document.getElementById('reuploadAadharPreviewImg');
        const placeholder = document.getElementById('reuploadAadharPlaceholder');
        if (preview) {
            preview.src = compressed;
            preview.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
    } catch(err) {
        console.error("Reupload Aadhaar compress error:", err);
        alert("फोटो कॉम्प्रेस करताना त्रुटी आली. कृपया पुन्हा निवडा.");
    }
}

async function submitReuploadAadhar() {
    if (!reuploadAadharBase64) {
        alert("कृपया आधी आधार कार्डचा फोटो कॅमेरा किंवा गॅलरीतून निवडा!");
        return;
    }

    const mobile = getCurrentWorkerMobile();
    const uid = currentWorkerUid || getLocalWorkerId();

    const updatePayload = {
        aadharCardPhoto: reuploadAadharBase64,
        verificationStatus: 'pending',
        kycSubmittedAt: firebase.database.ServerValue.TIMESTAMP,
        kycRejectReason: null
    };

    try {
        if (mobile && typeof database !== 'undefined') {
            await database.ref('workers/accounts/workers/' + mobile).update(updatePayload);
            await database.ref('workers/local_worker_' + mobile).update(updatePayload);
        }
        if (uid && typeof database !== 'undefined') {
            await database.ref('workers/' + uid).update(updatePayload);
        }

        currentWorkerVerificationStatus = 'pending';
        currentWorkerAadharPhoto = reuploadAadharBase64;
        updateKycUI('pending', '');
        closeWorkerReuploadKycModal();
        alert("✅ तुमचे आधार कार्ड यशस्वीरीत्या सबमिट झाले आहे! ॲडमिन कडून लवकरच पडताळणी केली जाईल.");
    } catch (err) {
        console.error("Reupload Aadhaar submit error:", err);
        alert("आधार कार्ड सबमिट करताना अडचण आली: " + err.message);
    }
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
        let photo = userData.photo || userData.photoUrl || null;
        const workerMobile = userData.mobile || getCurrentWorkerMobile();

        if (!photo && workerMobile) {
            try {
                const k1 = JSON.parse(localStorage.getItem('gharmitra_user_worker_' + workerMobile) || '{}');
                photo = k1.photo || k1.photoUrl || null;
            } catch(e) {}
            if (!photo) {
                try {
                    const k2 = JSON.parse(localStorage.getItem('gharkam_user_' + workerMobile) || '{}');
                    photo = k2.photo || k2.photoUrl || null;
                } catch(e) {}
            }
        }

        updateWorkerUI({
            name: name || "Worker",
            service: service,
            wallet: userData.balance || 50,
            workerIndex: userData.mobile ? userData.mobile.slice(-6) : 100001,
            photo: photo,
            photoUrl: photo
        });
        if (photo) {
            applyWorkerPhoto(photo);
        }

        // Initialize KYC status from session
        currentWorkerVerificationStatus = userData.verificationStatus || 'approved';
        currentWorkerRejectReason = userData.kycRejectReason || '';
        currentWorkerAadharPhoto = userData.aadharCardPhoto || null;
        updateKycUI(currentWorkerVerificationStatus, currentWorkerRejectReason);

        // Fallback: Query Firebase worker node or order history
        const uid = currentWorkerUid || getLocalWorkerId();
        if (uid) {
            database.ref('workers/' + uid).on('value', (snap) => {
                const wData = snap.val();
                if (wData) {
                    const fbName = wData.name || wData.fullName || wData.workerName;
                    if (fbName && fbName !== "Worker") {
                        applyWorkerName(fbName);
                    }
                    if (wData.photo || wData.photoUrl) {
                        applyWorkerPhoto(wData.photo || wData.photoUrl);
                    }
                    if (wData.verificationStatus !== undefined) {
                        currentWorkerVerificationStatus = wData.verificationStatus;
                        currentWorkerRejectReason = wData.kycRejectReason || '';
                        if (wData.aadharCardPhoto) currentWorkerAadharPhoto = wData.aadharCardPhoto;
                        updateKycUI(currentWorkerVerificationStatus, currentWorkerRejectReason);
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
                database.ref('workers/accounts/workers/' + workerMobile).on('value', aSnap => {
                    const aData = aSnap.val();
                    if (aData) {
                        if (aData.photo || aData.photoUrl) {
                            applyWorkerPhoto(aData.photo || aData.photoUrl);
                        }
                        if (aData.verificationStatus !== undefined) {
                            currentWorkerVerificationStatus = aData.verificationStatus;
                            currentWorkerRejectReason = aData.kycRejectReason || '';
                            if (aData.aadharCardPhoto) currentWorkerAadharPhoto = aData.aadharCardPhoto;
                            updateKycUI(currentWorkerVerificationStatus, currentWorkerRejectReason);
                        }
                    }
                });

                database.ref('workers/local_worker_' + workerMobile).once('value').then(lwSnap => {
                    const lwData = lwSnap.val();
                    if (lwData && (lwData.photo || lwData.photoUrl)) {
                        applyWorkerPhoto(lwData.photo || lwData.photoUrl);
                    }
                    if (lwData && lwData.verificationStatus !== undefined) {
                        currentWorkerVerificationStatus = lwData.verificationStatus;
                        currentWorkerRejectReason = lwData.kycRejectReason || '';
                        if (lwData.aadharCardPhoto) currentWorkerAadharPhoto = lwData.aadharCardPhoto;
                        updateKycUI(currentWorkerVerificationStatus, currentWorkerRejectReason);
                    }
                }).catch(() => {});

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
            (order.status === 'Accepted' || order.status === 'On The Way' || order.status === 'In Progress') &&
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
    } else if (status === 'In Progress') {
        statusEl.innerText = 'काम चालू आहे • On Site';
        statusEl.className = 'text-[10px] font-bold text-amber-600';
        metaEl.innerText = 'दारावर पोहोचले • स्टार्ट पिन व्हेरिफाइड';
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

                // Resolve worker photo across all possible sources
                let finalPhoto = workerData.photo || workerData.photoUrl || userData.photo || userData.photoUrl || localSession.photo || localSession.photoUrl || null;
                const workerMobile = userData.mobile || localSession.mobile || getCurrentWorkerMobile();
                if (!finalPhoto && workerMobile) {
                    try {
                        const k1 = JSON.parse(localStorage.getItem('gharmitra_user_worker_' + workerMobile) || '{}');
                        finalPhoto = k1.photo || k1.photoUrl || null;
                    } catch(e) {}
                    if (!finalPhoto) {
                        try {
                            const k2 = JSON.parse(localStorage.getItem('gharkam_user_' + workerMobile) || '{}');
                            finalPhoto = k2.photo || k2.photoUrl || null;
                        } catch(e) {}
                    }
                }

                const combinedData = {
                    name: finalName,
                    service: finalService,
                    wallet: workerData.wallet !== undefined ? workerData.wallet : (localSession.balance || 50),
                    workerIndex: workerData.workerIndex || Math.floor(100000 + Math.random() * 900000),
                    rating: calcRating,
                    totalReviews: calcTotalReviews,
                    photo: finalPhoto,
                    photoUrl: finalPhoto
                };

                if (!workerSnap.exists()) {
                    // Do not overwrite activeOrderId if an order was accepted
                    // while the worker profile was being initialized.
                    workerRef.update(combinedData);
                } else if (finalPhoto && (!workerData.photo || !workerData.photoUrl)) {
                    workerRef.update({ photo: finalPhoto, photoUrl: finalPhoto }).catch(() => {});
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
    const photoToApply = data.photo || data.photoUrl;
    if (photoToApply) {
        applyWorkerPhoto(photoToApply);
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
        syncApkDashboardData();
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

function openCreditModal() {
    const modal = document.getElementById('creditModal');
    if (modal) {
        const curWalletEl = document.getElementById('walletAmount');
        const modalWalletEl = document.getElementById('modalCurrentWallet');
        if (curWalletEl && modalWalletEl) {
            modalWalletEl.innerText = curWalletEl.innerText;
        }
        modal.classList.remove('hidden');
        const input = document.getElementById('creditAmountInput');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }
}

function closeCreditModal() {
    const modal = document.getElementById('creditModal');
    if (modal) modal.classList.add('hidden');
}

function setQuickCreditAmount(amt) {
    const input = document.getElementById('creditAmountInput');
    if (input) input.value = amt;
}

function submitCreditPayment() {
    const input = document.getElementById('creditAmountInput');
    let amt = parseInt(input ? input.value : 0, 10);
    if (!amt || isNaN(amt) || amt < 10) {
        alert("कृपया किमान ₹१० किंवा त्याहून अधिक रक्कम टाका (Minimum amount is ₹10).");
        if (input) {
            input.value = '10';
            input.focus();
        }
        return;
    }
    payWithRazorpay(amt);
}

async function payWithRazorpay(customAmount) {
    // Enforce minimum ₹10 as requested
    const parsedAmount = parseInt(customAmount, 10);
    const amountToAdd = (!isNaN(parsedAmount) && parsedAmount >= 10) ? parsedAmount : 10;
    const amountInPaise = amountToAdd * 100;
    const RAZORPAY_KEY = window.RAZORPAY_KEY_ID || 'rzp_live_TfQXrLjDz1z9nO';
    const backendApiBase = window.GHARMITRA_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

    // Attempt to create order via backend if available
    let backendOrder = null;
    if (backendApiBase) {
        try {
            const resp = await fetch(`${backendApiBase}/api/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: amountToAdd, isRupees: true })
            });
            if (resp.ok) {
                backendOrder = await resp.json();
            }
        } catch (err) {
            console.log('[Razorpay] Backend offline, falling back to direct checkout', err);
        }
    }

    // Ensure any security shield or blur is cleared before opening Razorpay
    document.body.classList.remove('screen-protected-blur');
    const shield = document.getElementById('securityScreenShield');
    if (shield) shield.style.display = 'none';

    const options = {
        key: RAZORPAY_KEY,
        amount: (backendOrder && backendOrder.amount) ? backendOrder.amount : amountInPaise,
        currency: 'INR',
        name: 'Gharmitra Online',
        description: `Gharmitra Partner Service Credits (₹${amountToAdd})`,
        prefill: {
            name: (window.auth && auth.currentUser && auth.currentUser.displayName) || 'Gharmitra Partner',
            email: (window.auth && auth.currentUser && auth.currentUser.email) || 'partner@gharmitra.online',
            contact: (typeof getCurrentWorkerMobile === 'function' ? getCurrentWorkerMobile() : '') || '9876543210'
        },
        config: {
            display: {
                blocks: {
                    upi: {
                        name: "Pay via UPI / QR",
                        instruments: [
                            { method: "upi" }
                        ]
                    }
                },
                sequence: ["block.upi", "block.other"],
                preferences: {
                    show_default_blocks: true
                }
            }
        },
        handler: async function (response) {
            console.log('[Razorpay Response]', response);

            // If backend order was used, verify signature with backend
            if (backendOrder && response.razorpay_signature) {
                try {
                    const verifyResp = await fetch(`${backendApiBase}/api/verify-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });
                    const verifyData = await verifyResp.json();
                    if (!verifyData.success) {
                        alert('पेमेंट स्वाक्षरी पडताळणी अयशस्वी: ' + (verifyData.message || 'Signature mismatch'));
                        return;
                    }
                } catch (verifyErr) {
                    console.warn('[Razorpay Signature Check Warning]', verifyErr);
                }
            }

            // Secure server-authoritative recharge
            try {
                const token = localStorage.getItem('gharmitra_auth_token');
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                fetch(`${backendApiBase}/api/wallet/recharge`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        amount: amountToAdd
                    })
                }).then(r => r.json()).then(rData => {
                    if (rData.success && rData.balance !== undefined) {
                        const el = document.getElementById('walletAmount');
                        if (el) el.innerText = rData.balance;
                    }
                }).catch(err => console.warn('[Wallet Recharge Error]', err));
            } catch (err) {
                console.warn('[Wallet Recharge Error]', err);
            }

            alert(`पेमेंट यशस्वी! पेमेंट आयडी: ${response.razorpay_payment_id}\nखात्यात ₹${amountToAdd} क्रेडिट जमा झाले!`);
            closeCreditModal();
        },
        modal: {
            ondismiss: function () {
                console.log('[Razorpay] User cancelled the checkout modal');
                document.body.classList.remove('screen-protected-blur');
            }
        },
        theme: { color: '#2563eb' }
    };

    if (backendOrder && backendOrder.order_id) {
        options.order_id = backendOrder.order_id;
    } else if (window.RAZORPAY_TEST_ORDER_ID) {
        options.order_id = window.RAZORPAY_TEST_ORDER_ID;
    }

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (failResp) {
        console.error('[Razorpay Payment Failed]', failResp);
        document.body.classList.remove('screen-protected-blur');
        alert('पेमेंट अयशस्वी झाले: ' + (failResp.error?.description || 'कृपया पुन्हा प्रयत्न करा.'));
    });
    rzp.open();
}

function addMoneyToFirebaseWallet(amount) {
    // Client-side direct write removed for security.
    // Balances are authoritatively managed and verified server-side.
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
    if (!isDutyOn) {
        if (currentWorkerVerificationStatus !== 'approved') {
            showWorkerKycAlertModal(currentWorkerVerificationStatus, currentWorkerRejectReason);
            return;
        }
    }
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
    updateApkDutyUI();
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
        if (currentWorkerVerificationStatus !== 'approved') {
            jobsContainer.innerHTML = `
                <div class="text-center py-10">
                    <span class="text-5xl block mb-3">🪪</span>
                    <p class="font-bold text-amber-700 text-sm">आधार कार्ड पडताळणी प्रलंबित आहे</p>
                    <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">महिला व कौटुंबिक सुरक्षिततेसाठी ॲडमिन मंजुरीनंतरच कामे उपलब्ध होतील.</p>
                </div>`;
            jobCountBadge.innerText = "KYC Pending";
            return;
        }
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

    // 10-Minute Emergency SOS Alert Check
    let pendingEmergencyOrder = null;
    let pendingEmergencyKey = null;
    keys.forEach(k => {
        const ord = allOrdersData[k];
        if (ord && ord.isEmergency && ord.status === 'Pending') {
            const isAreaMatch = (ord.area === selectedArea || !ord.area);
            if (isAreaMatch && !pendingEmergencyOrder) {
                pendingEmergencyOrder = ord;
                pendingEmergencyKey = k;
            }
        }
    });

    if (pendingEmergencyOrder && isDutyOn && currentWorkerVerificationStatus === 'approved') {
        showEmergencySosAlert(pendingEmergencyKey, pendingEmergencyOrder);
    } else {
        hideEmergencySosAlert();
    }
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
        const voiceUrl = item.voiceNoteUrl || item.voiceNote || item.audioUrl || null;
        const isAreaMatch = (item.area === selectedArea || !item.area);

        const jobService = (item.service || "").replace(/^\/+/, '').trim().toLowerCase();
        const workerService = (currentWorkerService || "").replace(/^\/+/, '').trim().toLowerCase();
        const isServiceMatch = (jobService === workerService);

        const photoHtml = imgUrl ? `<div class="my-2"><div class="relative cursor-pointer group rounded-xl overflow-hidden border border-slate-200" onclick="openImagePreview('${imgUrl}')"><img src="${imgUrl}" class="w-full h-44 object-cover"></div></div>` : '';
        const voiceHtml = voiceUrl ? `
            <div class="my-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 shadow-2xs space-y-2">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs shadow-xs shrink-0">
                            <i class="fa-solid fa-microphone"></i>
                        </span>
                        <div>
                            <h5 class="text-xs font-black text-slate-800">ग्राहकाचा व्हॉइस मेसेज (Customer Voice Note)</h5>
                            <p class="text-[10px] text-slate-500">कामाचे सविस्तर वर्णन ऐकण्यासाठी प्ले करा</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs shrink-0">
                        <i class="fa-solid fa-volume-high text-emerald-600"></i> ऑडिओ उपलब्ध
                    </span>
                </div>
                <audio controls controlsList="nodownload" preload="metadata" class="w-full h-9 rounded-xl border border-emerald-200 bg-white" src="${voiceUrl}">
                    तुमच्या ब्राउझरमध्ये ऑडिओ प्लेअर सपोर्ट नाही.
                </audio>
            </div>` : '';

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

            const hasGps = !!(item.hasExactGps || (item.customerLat && item.customerLng));
            const mapQuery = hasGps ? `${item.customerLat},${item.customerLng}` : encodeURIComponent(item.address);
            const gpsBadge = hasGps ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full ml-1"><i class="fa-solid fa-crosshairs text-emerald-600"></i> अचूक GPS</span>` : '';

            jobCard.innerHTML = `
            <div class="flex justify-between items-start">
            <div><span class="bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full">⚡ ${escapeHtml(item.service)}</span><h4 class="font-bold text-slate-800 text-sm mt-2"><i class="fa-solid fa-user text-blue-600"></i> ${escapeHtml(item.customerName)}</h4></div>
            <span class="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">${escapeHtml(item.budget || "₹500")}</span>
            </div>
            <div class="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p><i class="fa-solid fa-location-dot text-red-500 mr-1.5"></i><strong>पत्ता:</strong> ${escapeHtml(item.address)}${gpsBadge}</p>
            <p><i class="fa-regular fa-calendar text-blue-500 mr-1.5"></i><strong>तारीख:</strong> ${item.date || 'Not specified'}</p>
            <p><i class="fa-regular fa-clock text-blue-500 mr-1.5"></i><strong>वेळ:</strong> ${item.time || 'Not specified'}</p>
            <p class="text-slate-400"><i class="fa-solid fa-shield-halved text-emerald-500 mr-1.5"></i>कॉलिंग सुविधा (Masked Call) On The Way केल्यानंतर सुरू होईल.</p>
            </div>
            ${voiceHtml}
            ${photoHtml}
            <div class="flex items-center justify-between text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-2 rounded-xl">
                <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> नवीन काम स्वीकारा</span>
                <span class="bg-amber-200/80 px-2.5 py-0.5 rounded-md font-extrabold" data-offer-expires="${item.offerExpiresAt}">30 sec left</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
            <button onclick="acceptOrder('${key}')" class="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5">🤝 Accept Order</button>
            <button onclick="declineOrder('${key}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1 border border-slate-200" title="हे काम सोडून पुढील काम पहा">❌ Skip</button>
            </div>
            <a href="https://maps.google.com/?q=${mapQuery}" target="_blank" class="block text-center text-[11px] font-bold text-emerald-600 hover:underline py-1"><i class="fa-solid fa-map-location-dot mr-1"></i> नकाशावर पत्ता पहा</a>`;
            jobsContainer.appendChild(jobCard);
        }

        if ((item.status === 'Accepted' || item.status === 'On The Way' || item.status === 'In Progress') && key === activeOrderId) {
            const rawCustPhone = item.customerMobile || '';
            const cleanCustDigits = String(rawCustPhone).replace(/[^\d+]/g, '');
            const custTelHref = cleanCustDigits
                ? (cleanCustDigits.startsWith('+') ? `tel:${cleanCustDigits}` : `tel:+91${cleanCustDigits.slice(-10)}`)
                : '#';
            const maskedCustPhone = window.GharmitraCallMasking
                ? window.GharmitraCallMasking.maskDisplayNumber(rawCustPhone)
                : (rawCustPhone ? '+91 ••••• ••' + String(rawCustPhone).slice(-3) : 'उपलब्ध नाही');

            const activeHasGps = !!(item.hasExactGps || (item.customerLat && item.customerLng));
            const activeNavDest = activeHasGps ? `${item.customerLat},${item.customerLng}` : encodeURIComponent(item.address);
            const activeGpsBadge = activeHasGps ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full ml-1"><i class="fa-solid fa-crosshairs text-emerald-600"></i> अचूक GPS</span>` : '';

            const isSosDispatched = !!(item.assignedBy && (item.assignedBy.includes('Force Dispatch') || item.assignedBy.includes('SOS')));
            const activeCard = document.createElement('div');
            activeCard.className = isSosDispatched
                ? "bg-white p-5 rounded-2xl border-2 border-amber-500 shadow-xl space-y-4 ring-2 ring-amber-400/30"
                : "bg-white p-5 rounded-2xl border border-emerald-200 shadow-md space-y-4";
            activeCard.innerHTML = `
            <div class="flex justify-between items-center border-b pb-3 border-slate-100 flex-wrap gap-2">
            <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-slate-800 text-xs">🛠️ Active Task In-Progress</span>
                ${isSosDispatched ? `<span class="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-sm"><i class="fa-solid fa-bolt text-amber-900 animate-pulse"></i> ⚡ ॲडमिन इमर्जन्सी डिस्पॅच</span>` : ''}
            </div>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${item.status === 'In Progress' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-700'}">${item.status}</span>
            </div>

            <div class="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100 text-xs space-y-1.5 text-slate-700">
            <p><strong>ग्राहक:</strong> ${item.customerName}</p>
            <p><strong>सेवा:</strong> ${item.service}</p>
            <p><strong>पत्ता:</strong> ${escapeHtml(item.address)}${activeGpsBadge}</p>
            <p><strong>तारीख:</strong> ${item.date || 'Not specified'}</p>
            <p><strong>वेळ:</strong> ${item.time || 'Not specified'}</p>
            ${(item.status === 'On The Way' || item.status === 'In Progress')
                ? `<div class="bg-white p-3 rounded-xl border border-emerald-200 space-y-2 mt-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-slate-700"><i class="fa-solid fa-shield-halved text-emerald-600"></i> ग्राहक संपर्क:</span>
                        <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">सुरक्षित संपर्क</span>
                    </div>
                    <p class="text-xs text-slate-700"><strong>ग्राहक:</strong> ${item.customerName || 'Customer'} (<span class="font-bold text-blue-600">${maskedCustPhone}</span>)</p>
                    <a href="${custTelHref}" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-2 ${cleanCustDigits ? '' : 'opacity-50 pointer-events-none'}">
                        <i class="fa-solid fa-phone"></i> ग्राहकाला थेट कॉल करा
                    </a>
                   </div>`
                : `<p class="text-slate-500"><i class="fa-solid fa-lock mr-1"></i>कॉलिंग सुविधा On The Way केल्यानंतर सुरू होईल.</p>`}
            </div>
            ${voiceHtml}
            ${photoHtml}
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
                     <a id="workerNavBtn" href="https://www.google.com/maps/dir/?api=1&destination=${activeNavDest}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-xl text-[11px] transition shadow-sm flex items-center justify-center gap-1.5 shrink-0">
                         <i class="fa-solid fa-diamond-turn-right"></i> Google Navigation
                     </a>
                 </div>
             </div>
            <div class="grid grid-cols-2 gap-2">
            <a href="https://maps.google.com/?q=${activeNavDest}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">📍 Map</a>
            <button onclick="openChatModal('${key}', '${item.customerName}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5">💬 Chat</button>
            </div>
            ${item.status === 'Accepted' ? `
            <div class="pt-1">
                <button onclick="updateStatus('${key}', 'On The Way')" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2">
                    🚗 On The Way (ग्राहकाकडे निघा)
                </button>
            </div>
            ` : `
            <div class="pt-1">
                <button onclick="updateStatus('${key}', 'Completed')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2">
                    ✓ Complete Work (काम पूर्ण झाले)
                </button>
            </div>
            `}`;
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

    // Sync into APK app containers
    const apkJobsContainer = document.getElementById('apkAvailableJobsContainer');
    const apkAcceptedContainer = document.getElementById('apkAcceptedJobsContainer');
    const apkJobCountBadgeSub = document.getElementById('apkJobCountBadgeSub');
    if (apkJobsContainer && jobsContainer) {
        apkJobsContainer.innerHTML = jobsContainer.innerHTML;
    }
    if (apkAcceptedContainer && acceptedContainer) {
        apkAcceptedContainer.innerHTML = acceptedContainer.innerHTML;
    }
    if (apkJobCountBadgeSub) {
        apkJobCountBadgeSub.innerText = `${pendingCount} New Jobs`;
    }

    syncApkDashboardData();
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
                        workerPhoto: document.getElementById('workerHeaderAvatar')?.src || '',
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
        computeSha256(otp + "_" + orderId).then(otpHash => {
            database.ref("orders/" + orderId).update({
                completionOtpHash: otpHash,
                otpGeneratedAt: firebase.database.ServerValue.TIMESTAMP
            });
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

        computeSha256(enteredOtp + "_" + currentCompletingOrderId).then(enteredHash => {
        const storedHash = orderData.completionOtpHash;
        const legacyPlainOtp = String(orderData.completionOtp || '').trim();
        const isMatch = (storedHash && enteredHash === storedHash) || (legacyPlainOtp && enteredOtp === legacyPlainOtp);

        if (!isMatch) {
            if (statusMsg) {
                statusMsg.className = 'text-xs font-bold p-2.5 rounded-xl text-center bg-red-50 text-red-600 border border-red-200 block animate-shake';
                statusMsg.innerText = '❌ चुकीचा OTP! ग्राहकाच्या ईमेल किंवा स्क्रीनवरील योग्य OTP टाका.';
            }
            return;
        }

        finalizeOrderCompletion(currentCompletingOrderId);
    });
    return;
    if (false) {
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

        // Check if this was a 10-Minute Emergency SOS Order: Credit ₹30 extra bonus!
        database.ref("orders/" + orderId).once("value").then((snap) => {
            const ordData = snap.val();
            if (ordData && ordData.isEmergency && ordData.emergencyBonusToWorker === 30 && !ordData.bonusCredited) {
                const bonusAmount = 30;
                const workerId = (workerProfile && workerProfile.uid) || currentWorkerUid || ('local_worker_' + currentWorkerMobile);
                if (workerId) {
                    database.ref('workers/' + workerId + '/walletBalance').transaction((curr) => {
                        return (curr || 0) + bonusAmount;
                    });
                    database.ref('walletTransactions/' + workerId).push({
                        type: 'CREDIT',
                        amount: bonusAmount,
                        reason: 'Emergency SOS Extra Bonus (१०-मिनिट काम पूर्ण)',
                        orderId: orderId,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    });
                    database.ref('orders/' + orderId).update({
                        bonusCredited: true,
                        bonusCreditedAt: firebase.database.ServerValue.TIMESTAMP
                    });
                    if (typeof showApkToast === 'function') {
                        showApkToast("🎉 ₹३० इमर्जन्सी एक्स्ट्रा बोनस तुमच्या वॉलेटमध्ये जमा झाला!");
                    }
                }
            }
        }).catch(err => console.error('Bonus credit error:', err));

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

// =========================================================
// Dedicated Worker APK Mobile App Dashboard Controller
// =========================================================

function updateApkDutyUI() {
    const apkPillDot = document.getElementById('apkHeaderDutyDot');
    const apkPillText = document.getElementById('apkHeaderDutyText');
    if (apkPillDot) {
        apkPillDot.className = isDutyOn ? "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" : "w-2.5 h-2.5 rounded-full bg-rose-500";
    }
    if (apkPillText) {
        apkPillText.innerText = isDutyOn ? "Duty ON" : "Duty OFF";
    }

    const apkOnlineTitle = document.getElementById('apkOnlineStatusTitle');
    const apkOnlineSub = document.getElementById('apkOnlineStatusSub');
    const apkSwitchBg = document.getElementById('apkDutySwitchBg');
    const apkSwitchThumb = document.getElementById('apkDutySwitchThumb');
    const apkOnlineCard = document.getElementById('apkOnlineStatusCard');

    if (isDutyOn) {
        if (apkOnlineTitle) apkOnlineTitle.innerHTML = 'You are <span class="text-slate-900 font-extrabold">Online</span>';
        if (apkOnlineSub) apkOnlineSub.innerText = 'You will receive new job requests';
        if (apkSwitchBg) apkSwitchBg.className = "w-12 h-7 bg-emerald-500 rounded-full p-1 transition-colors duration-300 flex items-center justify-end cursor-pointer shrink-0";
        if (apkSwitchThumb) apkSwitchThumb.className = "w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300";
        if (apkOnlineCard) apkOnlineCard.className = "bg-[#eafaf1] border border-[#c7eed8] rounded-2xl p-3.5 mx-3.5 mt-3 flex items-center justify-between shadow-xs transition cursor-pointer";
    } else {
        if (apkOnlineTitle) apkOnlineTitle.innerHTML = 'You are <span class="text-slate-700 font-extrabold">Offline</span>';
        if (apkOnlineSub) apkOnlineSub.innerText = 'Turn ON duty to receive new job requests';
        if (apkSwitchBg) apkSwitchBg.className = "w-12 h-7 bg-slate-300 rounded-full p-1 transition-colors duration-300 flex items-center justify-start cursor-pointer shrink-0";
        if (apkSwitchThumb) apkSwitchThumb.className = "w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300";
        if (apkOnlineCard) apkOnlineCard.className = "bg-slate-100 border border-slate-200 rounded-2xl p-3.5 mx-3.5 mt-3 flex items-center justify-between shadow-xs transition cursor-pointer";
    }

    const apkBigBtn = document.getElementById('apkBigDutyBtn');
    if (apkBigBtn) {
        if (isDutyOn) {
            apkBigBtn.className = "w-full bg-[#ff4d4f] hover:bg-[#ff3538] text-white font-bold py-3.5 rounded-2xl shadow-md text-sm flex items-center justify-center gap-2 cursor-pointer transition active:scale-98";
            apkBigBtn.innerHTML = '<i class="fa-solid fa-power-off"></i> Go Offline';
        } else {
            apkBigBtn.className = "w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl shadow-md text-sm flex items-center justify-center gap-2 cursor-pointer transition active:scale-98";
            apkBigBtn.innerHTML = '<i class="fa-solid fa-power-off"></i> Go Online';
        }
    }
}

function calculateApkAnalytics(timeframe = 'weekly') {
    if (!allOrdersData) return;
    const workerUid = currentWorkerUid || getLocalWorkerId();
    const session = getStoredWorkerSession();
    const workerMobile = session ? session.mobile : null;

    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let totalJobs = 0;
    let totalEarnings = 0;
    const uniqueCustomers = new Set();
    let ratingSum = 0;
    let ratingCount = 0;

    Object.values(allOrdersData).forEach(order => {
        if (!order || order.status !== 'Completed') return;
        const isMatch = (
            (workerUid && (order.workerUid === workerUid || order.workerUid === ('local_worker_' + workerMobile))) ||
            (workerMobile && (order.workerMobile === workerMobile || order.workerUid === ('local_worker_' + workerMobile)))
        );
        if (!isMatch) return;

        let orderTime = order.completedAt || order.timestamp;
        if (!orderTime && order.date) {
            const p = new Date(order.date).getTime();
            if (!isNaN(p)) orderTime = p;
        }
        if (!orderTime) orderTime = Date.now();

        if (timeframe === 'weekly' && orderTime < startOfWeek) return;
        if (timeframe === 'monthly' && orderTime < startOfMonth) return;

        totalJobs++;
        const amt = parseInt(order.budget ? String(order.budget).replace(/[^0-9]/g, '') : '500', 10) || 500;
        totalEarnings += amt;

        if (order.customerMobile) uniqueCustomers.add(order.customerMobile);
        if (order.customerRating || order.rating) {
            ratingSum += Number(order.customerRating || order.rating);
            ratingCount++;
        }
    });

    const jobsEl = document.getElementById('apkWeekTotalJobs');
    const earnEl = document.getElementById('apkWeekTotalEarnings');
    const custEl = document.getElementById('apkWeekCustomers');
    const rateEl = document.getElementById('apkWeekAvgRating');

    if (jobsEl) jobsEl.innerText = totalJobs;
    if (earnEl) earnEl.innerText = '₹' + totalEarnings;
    if (custEl) custEl.innerText = uniqueCustomers.size;
    if (rateEl) {
        const avg = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : (document.getElementById('workerAvgRating')?.innerText || '5.0');
        rateEl.innerText = avg;
    }
}

function changeApkAnalyticsFilter(val) {
    calculateApkAnalytics(val);
}

function syncApkDashboardData() {
    try {
        const nameVal = document.getElementById('workerUsername')?.innerText || 'Worker';
        const apkName = document.getElementById('apkWorkerName');
        if (apkName && nameVal !== 'Loading...') apkName.innerText = nameVal;

        const avatarSrc = document.getElementById('workerHeaderAvatar')?.src;
        const apkAvatar = document.getElementById('apkWorkerAvatar');
        if (apkAvatar && avatarSrc) apkAvatar.src = avatarSrc;

        const idVal = document.getElementById('workerID')?.innerText || 'GK-000000';
        const apkId = document.getElementById('apkWorkerId');
        if (apkId) apkId.innerText = idVal;

        const serviceVal = document.getElementById('workerService')?.innerText || 'Cleaning';
        const apkService = document.getElementById('apkWorkerService');
        if (apkService && serviceVal !== 'Loading...') apkService.innerText = serviceVal;

        const ratingVal = document.getElementById('workerAvgRating')?.innerText || '5.0';
        const revVal = document.getElementById('workerTotalReviews')?.innerText || '0';
        const apkRating = document.getElementById('apkWorkerAvgRating');
        const apkReviews = document.getElementById('apkWorkerTotalReviews');
        if (apkRating) apkRating.innerText = ratingVal;
        if (apkReviews) apkReviews.innerText = `(${revVal} Reviews)`;

        const walletVal = document.getElementById('walletAmount')?.innerText || '50';
        const apkWallet = document.getElementById('apkWalletAmount');
        const modalWallet = document.getElementById('modalPaymentsWalletBalance');
        if (apkWallet) apkWallet.innerText = walletVal;
        if (modalWallet) modalWallet.innerText = walletVal;

        const todayEarnVal = document.getElementById('todayEarnings')?.innerText || '0';
        const todayJobsVal = document.getElementById('todayJobsCount')?.innerText || '0';
        const apkTodayEarn = document.getElementById('apkTodayEarnings');
        const apkTodayJobs = document.getElementById('apkTodayJobsCount');
        if (apkTodayEarn) apkTodayEarn.innerText = todayEarnVal;
        if (apkTodayJobs) apkTodayJobs.innerText = todayJobsVal;

        const jobCountVal = document.getElementById('jobCount')?.innerText || '0 New Jobs';
        const countDigits = (jobCountVal.match(/\d+/) || ['0'])[0];
        const apkJobBadge = document.getElementById('apkJobCountBadge');
        if (apkJobBadge) {
            apkJobBadge.innerText = countDigits;
            apkJobBadge.style.display = (parseInt(countDigits, 10) > 0) ? 'flex' : 'none';
        }

        const areaSelect = document.getElementById('workingAreaSelect');
        const apkAreaSelect = document.getElementById('apkWorkingAreaSelect');
        if (areaSelect && apkAreaSelect) {
            const currentArea = areaSelect.value || 'Swargate';
            if (apkAreaSelect.value !== currentArea) apkAreaSelect.value = currentArea;
        }

        updateApkDutyUI();

        const apkKyc = document.getElementById('apkKycBadge');
        if (apkKyc) {
            if (currentWorkerVerificationStatus === 'approved') {
                apkKyc.className = "bg-amber-100/90 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer";
                apkKyc.innerHTML = '<i class="fa-solid fa-circle-check text-blue-600"></i> Verified Partner';
            } else if (currentWorkerVerificationStatus === 'rejected') {
                apkKyc.className = "bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer";
                apkKyc.innerHTML = '✕ KYC Rejected (Reupload)';
            } else {
                apkKyc.className = "bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer";
                apkKyc.innerHTML = '⏳ Pending Verification';
            }
        }

        const filterSelect = document.getElementById('apkAnalyticsTimeFilter');
        calculateApkAnalytics(filterSelect ? filterSelect.value : 'weekly');
    } catch(e) {
        console.warn('syncApkDashboardData error:', e);
    }
}

function scrollToApkJobs() {
    const el = document.getElementById('apkJobsSection');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function focusApkAreaSelect() {
    const el = document.getElementById('apkWorkingAreaSelect');
    if (el) {
        el.focus();
        if (typeof el.showPicker === 'function') {
            try { el.showPicker(); } catch(e) {}
        }
    }
}

function onApkAreaSelectChanged(val) {
    const webArea = document.getElementById('workingAreaSelect');
    if (webArea) {
        webArea.value = val;
        filterAreaJobs();
    }
    showApkToast('📍 भाग बदलला: ' + val);
}

function copyWorkerIdToClipboard() {
    const id = document.getElementById('apkWorkerId')?.innerText || document.getElementById('workerID')?.innerText || 'GK-846473';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id).then(() => {
            showApkToast('✅ Worker ID ' + id + ' Copied!');
        }).catch(() => {
            showApkToast('ID: ' + id);
        });
    } else {
        showApkToast('ID: ' + id);
    }
}

function showApkToast(msg) {
    const t = document.getElementById('apkToast');
    if (!t) return;
    t.innerText = msg;
    t.classList.remove('hidden');
    t.classList.add('block');
    t.style.opacity = '1';
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => {
            t.classList.add('hidden');
            t.classList.remove('block');
        }, 300);
    }, 2200);
}

// Modals: My Jobs
function openWorkerMyJobsModal(tab = 'active') {
    const m = document.getElementById('workerMyJobsModal');
    if (!m) return;
    m.classList.remove('hidden');
    switchMyJobsTab(tab);
    renderMyJobsModalContent();
}

function closeWorkerMyJobsModal() {
    const m = document.getElementById('workerMyJobsModal');
    if (m) m.classList.add('hidden');
}

function switchMyJobsTab(tab) {
    const btnActive = document.getElementById('myJobsTabBtnActive');
    const btnComp = document.getElementById('myJobsTabBtnCompleted');
    const listActive = document.getElementById('myJobsActiveList');
    const listComp = document.getElementById('myJobsCompletedList');

    if (tab === 'completed') {
        if (btnActive) btnActive.className = "pb-2 text-slate-400 hover:text-slate-700";
        if (btnComp) btnComp.className = "pb-2 text-blue-600 border-b-2 border-blue-600";
        if (listActive) listActive.classList.add('hidden');
        if (listComp) listComp.classList.remove('hidden');
    } else {
        if (btnActive) btnActive.className = "pb-2 text-blue-600 border-b-2 border-blue-600";
        if (btnComp) btnComp.className = "pb-2 text-slate-400 hover:text-slate-700";
        if (listActive) listActive.classList.remove('hidden');
        if (listComp) listComp.classList.add('hidden');
    }
}

function renderMyJobsModalContent() {
    const activeList = document.getElementById('myJobsActiveList');
    const compList = document.getElementById('myJobsCompletedList');
    const activeSrc = document.getElementById('acceptedJobsContainer');

    if (activeList) {
        if (activeSrc && activeSrc.children.length > 0 && !activeSrc.innerText.includes('You have not accepted')) {
            activeList.innerHTML = activeSrc.innerHTML;
        } else {
            activeList.innerHTML = `
                <div class="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4">
                    <i class="fa-solid fa-briefcase text-2xl text-slate-300 mb-2"></i>
                    <p class="text-xs font-bold text-slate-600">सध्या कोणतेही चालू काम नाही.</p>
                    <p class="text-[11px] text-slate-400 mt-1">नवीन कामे स्वीकारण्यासाठी Duty ON ठेवा.</p>
                </div>
            `;
        }
    }

    if (compList && allOrdersData) {
        const workerUid = currentWorkerUid || getLocalWorkerId();
        const session = getStoredWorkerSession();
        const workerMobile = session ? session.mobile : null;

        const completedOrders = Object.entries(allOrdersData).filter(([id, order]) => {
            if (!order || order.status !== 'Completed') return false;
            return (
                (workerUid && (order.workerUid === workerUid || order.workerUid === ('local_worker_' + workerMobile))) ||
                (workerMobile && (order.workerMobile === workerMobile || order.workerUid === ('local_worker_' + workerMobile)))
            );
        }).sort((a, b) => (b[1].completedAt || b[1].timestamp || 0) - (a[1].completedAt || a[1].timestamp || 0));

        if (completedOrders.length === 0) {
            compList.innerHTML = `
                <div class="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4">
                    <i class="fa-solid fa-clock-rotate-left text-2xl text-slate-300 mb-2"></i>
                    <p class="text-xs font-bold text-slate-600">कोणतेही पूर्ण झालेले काम आढळले नाही.</p>
                </div>
            `;
        } else {
            let html = '';
            completedOrders.forEach(([id, order]) => {
                const timeVal = order.completedAt || order.timestamp || Date.now();
                const dateStr = new Date(timeVal).toLocaleDateString('mr-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                const budgetVal = (order.budget || '₹500').replace('₹', '');
                html += `
                    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                        <div class="space-y-0.5">
                            <span class="font-bold text-slate-800 block">${order.service || 'काम'}</span>
                            <span class="text-[10px] text-slate-500 block">${order.area || 'पुणे'} • ${dateStr}</span>
                            <span class="text-[10px] text-emerald-600 font-bold block">✓ पूर्ण झाले</span>
                        </div>
                        <div class="text-right">
                            <span class="text-sm font-black text-emerald-700 block">₹${budgetVal}</span>
                            ${order.customerRating ? `<span class="text-[10px] text-amber-500 font-bold">★ ${order.customerRating}</span>` : ''}
                        </div>
                    </div>
                `;
            });
            compList.innerHTML = html;
        }
    }
}

// Modals: Payments
function openWorkerPaymentsModal() {
    const m = document.getElementById('workerPaymentsModal');
    if (!m) return;
    const curWallet = document.getElementById('walletAmount')?.innerText || '50';
    const modalBal = document.getElementById('modalPaymentsWalletBalance');
    if (modalBal) modalBal.innerText = curWallet;
    m.classList.remove('hidden');
}

function closeWorkerPaymentsModal() {
    const m = document.getElementById('workerPaymentsModal');
    if (m) m.classList.add('hidden');
}

// Modals: Ratings
function openWorkerRatingsModal() {
    const m = document.getElementById('workerRatingsModal');
    if (!m) return;
    const avg = document.getElementById('workerAvgRating')?.innerText || '5.0';
    const count = document.getElementById('workerTotalReviews')?.innerText || '0';
    const scoreEl = document.getElementById('modalRatingsScore');
    const countEl = document.getElementById('modalRatingsCount');
    if (scoreEl) scoreEl.innerText = avg;
    if (countEl) countEl.innerText = count.replace(/[^0-9]/g, '') || '0';

    const listEl = document.getElementById('modalReviewsList');
    if (listEl && allOrdersData) {
        const workerUid = currentWorkerUid || getLocalWorkerId();
        const reviews = Object.values(allOrdersData).filter(o => o && o.customerRating && (o.workerUid === workerUid || o.workerMobile === (getStoredWorkerSession()?.mobile)));
        if (reviews.length === 0) {
            listEl.innerHTML = '<p class="text-center py-6 text-slate-400 text-xs">अद्याप कोणताही अभिप्राय आलेला नाही.</p>';
        } else {
            let html = '';
            reviews.forEach(r => {
                html += `
                    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-slate-800">${r.customerName || 'ग्राहक'}</span>
                            <span class="text-amber-500 font-bold">★ ${r.customerRating}</span>
                        </div>
                        <p class="text-slate-600 text-[11px]">${r.customerReview || 'उत्कृष्ट आणि वेळेवर सेवा!'}</p>
                    </div>
                `;
            });
            listEl.innerHTML = html;
        }
    }
    m.classList.remove('hidden');
}

function closeWorkerRatingsModal() {
    const m = document.getElementById('workerRatingsModal');
    if (m) m.classList.add('hidden');
}

// Modals: Support
function openWorkerSupportModal() {
    const m = document.getElementById('workerSupportModal');
    if (m) m.classList.remove('hidden');
}

function closeWorkerSupportModal() {
    const m = document.getElementById('workerSupportModal');
    if (m) m.classList.add('hidden');
}

// Modals: Profile
function openWorkerProfileModal() {
    const m = document.getElementById('workerProfileModal');
    if (m) m.classList.remove('hidden');
}

function closeWorkerProfileModal() {
    const m = document.getElementById('workerProfileModal');
    if (m) m.classList.add('hidden');
}

function workerLogout() {
    if (confirm("तुम्हाला खात्रीने लॉगआऊट करायचे आहे का?")) {
        try {
            localStorage.removeItem('current_worker_session');
            sessionStorage.removeItem('current_worker_session');
            localStorage.removeItem('current_user_session');
            if (firebase && firebase.auth) firebase.auth().signOut().catch(() => {});
        } catch(e) {}
        window.location.href = "index.html";
    }
}

// Modals: Notifications
function openWorkerNotificationsModal() {
    const m = document.getElementById('workerNotificationsModal');
    if (!m) return;
    const list = document.getElementById('modalNotificationsList');
    if (list && typeof database !== 'undefined') {
        database.ref('broadcastNotifications').limitToLast(10).once('value', snap => {
            const val = snap.val();
            if (!val) {
                list.innerHTML = '<p class="text-center py-8 text-slate-400 text-xs">कोणतीही नवीन सूचना नाही.</p>';
                return;
            }
            let html = '';
            Object.values(val).reverse().forEach(item => {
                if (item.audience === 'CUSTOMERS') return;
                const timeStr = new Date(item.createdAt || item.timestamp || Date.now()).toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' });
                html += `
                    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-slate-800">${item.title || 'सूचना'}</span>
                            <span class="text-[10px] text-slate-400">${timeStr}</span>
                        </div>
                        <p class="text-slate-600 text-[11px]">${item.body || ''}</p>
                    </div>
                `;
            });
            list.innerHTML = html || '<p class="text-center py-8 text-slate-400 text-xs">कोणतीही नवीन सूचना नाही.</p>';
        });
    }
    m.classList.remove('hidden');
}

function closeWorkerNotificationsModal() {
    const m = document.getElementById('workerNotificationsModal');
    if (m) m.classList.add('hidden');
}

// Bottom Navigation Switcher
function apkNavSwitch(tab) {
    const tabs = ['home', 'jobs', 'payments', 'support', 'profile'];
    tabs.forEach(t => {
        const btn = document.getElementById('apkNavBtn' + t.charAt(0).toUpperCase() + t.slice(1));
        if (!btn) return;
        if (t === tab) {
            btn.className = "flex flex-col items-center justify-center text-blue-600 font-bold text-[10px] py-1 px-3 transition cursor-pointer";
        } else {
            btn.className = "flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 font-bold text-[10px] py-1 px-3 transition cursor-pointer";
        }
    });

    if (tab === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'jobs') {
        scrollToApkJobs();
    } else if (tab === 'payments') {
        openWorkerPaymentsModal();
    } else if (tab === 'support') {
        openWorkerSupportModal();
    } else if (tab === 'profile') {
        openWorkerProfileModal();
    }
}

// Initial sync on page ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(syncApkDashboardData, 600);
});

// Bind all to window
window.updateApkDutyUI = updateApkDutyUI;
window.calculateApkAnalytics = calculateApkAnalytics;
window.changeApkAnalyticsFilter = changeApkAnalyticsFilter;
window.syncApkDashboardData = syncApkDashboardData;
window.scrollToApkJobs = scrollToApkJobs;
window.focusApkAreaSelect = focusApkAreaSelect;
window.onApkAreaSelectChanged = onApkAreaSelectChanged;
window.copyWorkerIdToClipboard = copyWorkerIdToClipboard;
window.showApkToast = showApkToast;
window.openWorkerMyJobsModal = openWorkerMyJobsModal;
window.closeWorkerMyJobsModal = closeWorkerMyJobsModal;
window.switchMyJobsTab = switchMyJobsTab;
window.openWorkerPaymentsModal = openWorkerPaymentsModal;
window.closeWorkerPaymentsModal = closeWorkerPaymentsModal;
window.openWorkerRatingsModal = openWorkerRatingsModal;
window.closeWorkerRatingsModal = closeWorkerRatingsModal;
window.openWorkerSupportModal = openWorkerSupportModal;
window.closeWorkerSupportModal = closeWorkerSupportModal;
window.openWorkerProfileModal = openWorkerProfileModal;
window.closeWorkerProfileModal = closeWorkerProfileModal;
window.workerLogout = workerLogout;
window.openWorkerNotificationsModal = openWorkerNotificationsModal;
window.closeWorkerNotificationsModal = closeWorkerNotificationsModal;
window.apkNavSwitch = apkNavSwitch;


// ==========================================
// 10-MINUTE EMERGENCY SOS ALERT & SIREN SYSTEM (+₹30 WORKER BONUS)
// ==========================================
let sirenOscillator = null;
let sirenGainNode = null;
let sirenAudioCtx = null;
let isSirenPlaying = false;
let activeSosOrderId = null;

function playEmergencySirenAlert() {
    if (isSirenPlaying) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        sirenAudioCtx = new AudioContext();
        isSirenPlaying = true;
        
        let freq = 600;
        let goingUp = true;
        const osc = sirenAudioCtx.createOscillator();
        const gain = sirenAudioCtx.createGain();
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.25, sirenAudioCtx.currentTime);
        osc.connect(gain);
        gain.connect(sirenAudioCtx.destination);
        osc.start();
        sirenOscillator = osc;
        sirenGainNode = gain;

        const sirenInterval = setInterval(() => {
            if (!isSirenPlaying || !sirenAudioCtx || !sirenOscillator) {
                clearInterval(sirenInterval);
                return;
            }
            if (goingUp) {
                freq += 35;
                if (freq >= 950) goingUp = false;
            } else {
                freq -= 35;
                if (freq <= 550) goingUp = true;
            }
            try {
                osc.frequency.setValueAtTime(freq, sirenAudioCtx.currentTime);
            } catch(e) {}
        }, 50);

        if (navigator.vibrate) {
            navigator.vibrate([400, 200, 400, 200, 800]);
        }
    } catch(e) {
        console.warn('Audio siren error:', e);
    }
}

function stopEmergencySirenAlert() {
    isSirenPlaying = false;
    if (sirenOscillator) {
        try { sirenOscillator.stop(); } catch(e) {}
        sirenOscillator = null;
    }
    if (sirenAudioCtx) {
        try { sirenAudioCtx.close(); } catch(e) {}
        sirenAudioCtx = null;
    }
}
window.playEmergencySirenAlert = playEmergencySirenAlert;
window.stopEmergencySirenAlert = stopEmergencySirenAlert;

function showEmergencySosAlert(key, order) {
    activeSosOrderId = key;
    playEmergencySirenAlert();

    const apkCard = document.getElementById('workerSosEmergencyCard');
    const webCard = document.getElementById('websiteSosEmergencyCard');

    const probText = order.service || 'तात्काळ इमर्जन्सी मदत';
    const addrText = (order.address || '') + (order.area ? ' (' + order.area + ')' : '');
    const custText = order.customerName || 'ग्राहक';

    if (apkCard) {
        apkCard.classList.remove('hidden');
        const p = document.getElementById('apkSosProblemText');
        const a = document.getElementById('apkSosAddressText');
        const c = document.getElementById('apkSosCustomerText');
        if (p) p.innerText = probText;
        if (a) a.innerText = addrText;
        if (c) c.innerText = custText;
    }
    if (webCard) {
        webCard.classList.remove('hidden');
        const p = document.getElementById('webSosProblemText');
        const a = document.getElementById('webSosAddressText');
        const c = document.getElementById('webSosCustomerText');
        if (p) p.innerText = probText;
        if (a) a.innerText = addrText;
        if (c) c.innerText = custText;
    }
}

function hideEmergencySosAlert() {
    stopEmergencySirenAlert();
    activeSosOrderId = null;
    const apkCard = document.getElementById('workerSosEmergencyCard');
    const webCard = document.getElementById('websiteSosEmergencyCard');
    if (apkCard) apkCard.classList.add('hidden');
    if (webCard) webCard.classList.add('hidden');
}

async function acceptEmergencySosOrder() {
    if (!activeSosOrderId) {
        alert("सध्या कोणतीही इमर्जन्सी ऑर्डर उपलब्ध नाही.");
        return;
    }
    const orderToAccept = activeSosOrderId;
    hideEmergencySosAlert();
    if (typeof acceptJob === 'function') {
        acceptJob(orderToAccept);
    }
}
window.acceptEmergencySosOrder = acceptEmergencySosOrder;
