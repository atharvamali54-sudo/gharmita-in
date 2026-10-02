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

let currentCustomerLocation = null;

function populateSavedAddress() {
    const addressInput = document.getElementById('customerAddress');
    const areaSelect = document.getElementById('areaSelect');
    const savedBadge = document.getElementById('savedAddressBadge');

    let savedAddr = '';
    try {
        savedAddr = localStorage.getItem('gharmitra_saved_address') || localStorage.getItem('gharmitra_customer_address') || '';
    } catch(e) {}

    let savedArea = '';
    try {
        savedArea = localStorage.getItem('gharmitra_saved_area') || '';
    } catch(e) {}

    if (customerProfile) {
        if (customerProfile.address && !savedAddr) savedAddr = customerProfile.address;
        if (customerProfile.area && !savedArea) savedArea = customerProfile.area;
    }

    if (addressInput && savedAddr && !addressInput.value) {
        addressInput.value = savedAddr;
        if (savedBadge) {
            savedBadge.classList.remove('hidden');
            savedBadge.classList.add('inline-flex');
            const badgeText = document.getElementById('savedAddressBadgeText');
            if (badgeText) badgeText.innerText = "पत्ता सेव्ह आहे (Saved)";
        }
    }

    if (areaSelect && savedArea && (!areaSelect.value || areaSelect.value === 'Swargate')) {
        areaSelect.value = savedArea;
    }

    // Populate APK Form Inputs (Active in APK App mode)
    const apkAddressInput = document.getElementById('apkCustomerAddress');
    const apkAreaSelect = document.getElementById('apkAreaSelect');
    const apkNameInput = document.getElementById('apkCustomerName');
    const apkMobileInput = document.getElementById('apkCustomerMobile');
    const apkDateInput = document.getElementById('apkBookingDate');
    const nameInput = document.getElementById('customerName');
    const mobileInput = document.getElementById('customerMobile');

    if (apkAddressInput && savedAddr && !apkAddressInput.value) {
        apkAddressInput.value = savedAddr;
    }
    if (apkAreaSelect && savedArea && (!apkAreaSelect.value || apkAreaSelect.value === 'Dhankawadi')) {
        apkAreaSelect.value = savedArea;
    }
    if (customerProfile) {
        if (customerProfile.name) {
            if (nameInput && !nameInput.value) nameInput.value = customerProfile.name;
            if (apkNameInput && !apkNameInput.value) apkNameInput.value = customerProfile.name;
        }
        if (customerProfile.mobile) {
            if (mobileInput && !mobileInput.value) mobileInput.value = customerProfile.mobile;
            if (apkMobileInput && !apkMobileInput.value) apkMobileInput.value = customerProfile.mobile;
        }
    }
    if (apkDateInput && !apkDateInput.value) {
        apkDateInput.valueAsDate = new Date();
    }
    setupApkFieldSync();

    try {
        const savedLocStr = localStorage.getItem('gharmitra_saved_location');
        if (savedLocStr) {
            const savedLoc = JSON.parse(savedLocStr);
            if (savedLoc && savedLoc.lat && savedLoc.lng) {
                currentCustomerLocation = savedLoc;
                renderGpsLocationBadge(savedLoc.lat, savedLoc.lng, savedLoc.accuracy);
            }
        }
    } catch (e) {}

    setTimeout(() => {
        if (typeof initCustomerPinMap === 'function') {
            initCustomerPinMap();
        }
        if (typeof setupAreaSelectMapSync === 'function') {
            setupAreaSelectMapSync();
        }
    }, 150);
}

function handleApkAddressChange() {
    const apkAddressInput = document.getElementById('apkCustomerAddress');
    const addressInput = document.getElementById('customerAddress');
    if (!apkAddressInput) return;
    const val = apkAddressInput.value.trim();
    if (addressInput) addressInput.value = val;
    handleAddressChange();
}
window.handleApkAddressChange = handleApkAddressChange;

function focusApkAddressForEdit() {
    const apkAddressInput = document.getElementById('apkCustomerAddress');
    if (apkAddressInput) {
        apkAddressInput.focus();
        apkAddressInput.select();
        apkAddressInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
window.focusApkAddressForEdit = focusApkAddressForEdit;

function resetCustomerGpsLocation() {
    try {
        localStorage.removeItem('gharmitra_saved_location');
    } catch(e) {}
    currentCustomerLocation = null;
    const badge = document.getElementById('gpsLocationBadge');
    const apkBadge = document.getElementById('apkGpsLocationBadge');
    if (badge) {
        badge.classList.add('hidden');
        badge.classList.remove('inline-flex');
    }
    if (apkBadge) {
        apkBadge.classList.add('hidden');
        apkBadge.classList.remove('inline-flex');
    }
    const pinCoords = document.getElementById('pinCoordsText');
    const apkPinCoords = document.getElementById('apkPinCoordsText');
    if (pinCoords) pinCoords.innerText = '';
    if (apkPinCoords) apkPinCoords.innerText = '';
}
window.resetCustomerGpsLocation = resetCustomerGpsLocation;

function setupApkFieldSync() {
    const pairs = [
        ['customerName', 'apkCustomerName'],
        ['customerMobile', 'apkCustomerMobile'],
        ['serviceSelect', 'apkServiceSelect'],
        ['areaSelect', 'apkAreaSelect'],
        ['customerAddress', 'apkCustomerAddress'],
        ['budgetInput', 'apkBudgetInput'],
        ['bookingDate', 'apkBookingDate'],
        ['bookingTime', 'apkBookingTime']
    ];

    pairs.forEach(([pId, aId]) => {
        const pEl = document.getElementById(pId);
        const aEl = document.getElementById(aId);
        if (pEl && aEl && !aEl._syncHooked) {
            aEl._syncHooked = true;
            aEl.addEventListener('input', () => { pEl.value = aEl.value; });
            aEl.addEventListener('change', () => {
                pEl.value = aEl.value;
                if (aId === 'apkAreaSelect') {
                    if (typeof setupAreaSelectMapSync === 'function') {
                        const evt = new Event('change');
                        pEl.dispatchEvent(evt);
                    }
                }
            });
            pEl.addEventListener('input', () => { aEl.value = pEl.value; });
            pEl.addEventListener('change', () => { aEl.value = pEl.value; });
        }
    });
}
window.setupApkFieldSync = setupApkFieldSync;

function handleAddressChange() {
    const addressInput = document.getElementById('customerAddress');
    const savedBadge = document.getElementById('savedAddressBadge');
    const badgeText = document.getElementById('savedAddressBadgeText');
    if (!addressInput) return;

    const val = addressInput.value.trim();
    if (val) {
        try {
            localStorage.setItem('gharmitra_saved_address', val);
            localStorage.setItem('gharmitra_customer_address', val);
        } catch(e) {}

        if (customerProfile) {
            customerProfile.address = val;
            try {
                localStorage.setItem('current_user_session', JSON.stringify(customerProfile));
            } catch(e) {}
        }

        if (savedBadge) {
            savedBadge.classList.remove('hidden');
            savedBadge.classList.add('inline-flex');
        }
        if (badgeText) {
            badgeText.innerText = "पत्ता सेव्ह केला (Auto-saved)";
        }
    } else {
        if (savedBadge) {
            savedBadge.classList.add('hidden');
            savedBadge.classList.remove('inline-flex');
        }
    }
}

function focusAddressForEdit() {
    const addressInput = document.getElementById('customerAddress');
    if (addressInput) {
        addressInput.focus();
        addressInput.select();
        addressInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function renderGpsLocationBadge(lat, lng, accuracy) {
    const badge = document.getElementById('gpsLocationBadge');
    const text = document.getElementById('gpsLocationText');
    const link = document.getElementById('gpsMapLink');

    const apkBadge = document.getElementById('apkGpsLocationBadge');
    const apkText = document.getElementById('apkGpsLocationText');

    if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('inline-flex');
    }
    if (apkBadge) {
        apkBadge.classList.remove('hidden');
        apkBadge.classList.add('inline-flex');
    }

    const accText = accuracy ? ` (±${accuracy}m)` : '';
    if (text) text.innerText = `अचूक GPS जोडले${accText}`;
    if (apkText) apkText.innerText = `अचूक स्थान शोधले${accText}`;
    if (link) {
        link.href = `https://www.google.com/maps?q=${lat},${lng}`;
    }
}

let customerPinMap = null;
let customerPinMarker = null;
let customerPinGpsCircle = null;
let gpsWatchId = null;

function initCustomerPinMap(forcedLat, forcedLng) {
    const isApp = document.documentElement.classList.contains('is-app-env');
    const targetMapId = (isApp && document.getElementById('apkCustomerPinMap')) ? 'apkCustomerPinMap' : 'customerPinMap';
    const mapEl = document.getElementById(targetMapId);
    if (!mapEl || typeof L === 'undefined') return;

    if (customerPinMap) {
        if (forcedLat && forcedLng) {
            updateCustomerPinMapLocation(forcedLat, forcedLng, false);
        }
        setTimeout(() => {
            try { customerPinMap.invalidateSize(); } catch(e) {}
        }, 150);
        return;
    }

    let startLat = 18.5074;
    let startLng = 73.8077;
    let startZoom = 14;

    if (forcedLat && forcedLng) {
        startLat = Number(forcedLat);
        startLng = Number(forcedLng);
        startZoom = 16;
    } else if (currentCustomerLocation && currentCustomerLocation.lat && currentCustomerLocation.lng) {
        startLat = Number(currentCustomerLocation.lat);
        startLng = Number(currentCustomerLocation.lng);
        startZoom = 16;
    } else {
        const areaSelect = document.getElementById('areaSelect');
        if (areaSelect && areaSelect.value && PUNE_AREA_COORDINATES[areaSelect.value]) {
            startLat = PUNE_AREA_COORDINATES[areaSelect.value].lat;
            startLng = PUNE_AREA_COORDINATES[areaSelect.value].lng;
            startZoom = 15;
        }
    }

    try {
        customerPinMap = L.map(targetMapId, {
            zoomControl: true,
            attributionControl: false
        }).setView([startLat, startLng], startZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(customerPinMap);

        const pinIcon = L.divIcon({
            className: 'customer-pin-icon',
            html: `
                <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: grab;">
                    <div style="background: #ef4444; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(239,68,68,0.5); border: 2.5px solid white;">
                        <i class="fa-solid fa-house" style="transform: rotate(45deg); font-size: 13px;"></i>
                    </div>
                    <div style="width: 10px; height: 4px; background: rgba(0,0,0,0.3); border-radius: 50%; margin-top: -2px;"></div>
                </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });

        customerPinMarker = L.marker([startLat, startLng], {
            draggable: true,
            icon: pinIcon
        }).addTo(customerPinMap);

        const updateFromPin = (lat, lng) => {
            lat = Number(lat.toFixed(6));
            lng = Number(lng.toFixed(6));
            currentCustomerLocation = {
                lat: lat,
                lng: lng,
                accuracy: 5,
                timestamp: Date.now(),
                userAdjusted: true
            };
            try {
                localStorage.setItem('gharmitra_saved_location', JSON.stringify(currentCustomerLocation));
            } catch(e) {}

            const coordsSpan = document.getElementById('pinCoordsText');
            const apkCoordsSpan = document.getElementById('apkPinCoordsText');
            if (coordsSpan) coordsSpan.innerText = `${lat}, ${lng}`;
            if (apkCoordsSpan) apkCoordsSpan.innerText = `${lat}, ${lng}`;

            renderGpsLocationBadge(lat, lng, 5);

            const savedBadge = document.getElementById('savedAddressBadge');
            if (savedBadge) {
                savedBadge.classList.remove('hidden');
                savedBadge.classList.add('inline-flex');
                const badgeText = document.getElementById('savedAddressBadgeText');
                if (badgeText) badgeText.innerText = "मॅपवर जागा निश्चित केली";
            }

            // Sync with nearest Pune Area
            let closestArea = null;
            let minDistance = Infinity;
            if (typeof PUNE_AREA_COORDINATES === 'object') {
                for (const [areaName, coords] of Object.entries(PUNE_AREA_COORDINATES)) {
                    const d = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
                    if (d < minDistance) {
                        minDistance = d;
                        closestArea = areaName;
                    }
                }
            }
            const areaSelect = document.getElementById('areaSelect');
            const apkAreaSelect = document.getElementById('apkAreaSelect');
            if (areaSelect && closestArea && minDistance < 10) {
                areaSelect.value = closestArea;
                if (apkAreaSelect) apkAreaSelect.value = closestArea;
                try {
                    localStorage.setItem('gharmitra_saved_area', closestArea);
                } catch(e) {}
            }
        };

        customerPinMarker.on('dragend', function (e) {
            const pos = e.target.getLatLng();
            updateFromPin(pos.lat, pos.lng);
            const pinInfo = document.getElementById('pinAccuracyInfo');
            if (pinInfo) {
                pinInfo.innerHTML = '<span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-check"></i> घराची अचूक जागा मॅपवर निश्चित केली!</span>';
            }
        });

        customerPinMap.on('click', function (e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            customerPinMarker.setLatLng([lat, lng]);
            updateFromPin(lat, lng);
            const pinInfo = document.getElementById('pinAccuracyInfo');
            if (pinInfo) {
                pinInfo.innerHTML = '<span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-check"></i> घराची अचूक जागा मॅपवर निश्चित केली!</span>';
            }
        });

        const coordsSpan = document.getElementById('pinCoordsText');
        if (coordsSpan) {
            coordsSpan.innerText = `${startLat.toFixed(5)}, ${startLng.toFixed(5)}`;
        }

        setTimeout(() => {
            try { customerPinMap.invalidateSize(); } catch(e) {}
        }, 300);

    } catch (mapErr) {
        console.warn("Could not initialize customerPinMap:", mapErr);
    }
}

function updateCustomerPinMapLocation(lat, lng, flyTo = true) {
    if (!customerPinMap) {
        initCustomerPinMap(lat, lng);
        return;
    }
    if (customerPinMarker) {
        customerPinMarker.setLatLng([lat, lng]);
    }
    if (customerPinMap) {
        if (flyTo) {
            customerPinMap.setView([lat, lng], 17);
        } else {
            customerPinMap.panTo([lat, lng]);
        }
        setTimeout(() => {
            try { customerPinMap.invalidateSize(); } catch(e) {}
        }, 200);
    }
    const coordsSpan = document.getElementById('pinCoordsText');
    const apkCoordsSpan = document.getElementById('apkPinCoordsText');
    if (coordsSpan) coordsSpan.innerText = `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    if (apkCoordsSpan) apkCoordsSpan.innerText = `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

function setupAreaSelectMapSync() {
    const areaSelect = document.getElementById('areaSelect');
    if (!areaSelect || areaSelect._mapSyncHooked) return;
    areaSelect._mapSyncHooked = true;
    areaSelect.addEventListener('change', function() {
        const chosen = this.value;
        if (chosen && PUNE_AREA_COORDINATES[chosen]) {
            const coords = PUNE_AREA_COORDINATES[chosen];
            if (!currentCustomerLocation || !currentCustomerLocation.userAdjusted) {
                currentCustomerLocation = {
                    lat: coords.lat,
                    lng: coords.lng,
                    accuracy: 100,
                    timestamp: Date.now()
                };
                updateCustomerPinMapLocation(coords.lat, coords.lng, true);
                renderGpsLocationBadge(coords.lat, coords.lng, 100);
            }
        }
    });
}

async function detectCustomerExactLocation() {
    if (typeof triggerHapticFeedback === 'function') {
        triggerHapticFeedback(60);
    }
    const btn = document.getElementById('detectGpsBtn');
    const apkBtn = document.getElementById('apkDetectGpsBtn');
    const originalBtnHtml = btn ? btn.innerHTML : '';
    const originalApkBtnHtml = apkBtn ? apkBtn.innerHTML : '';
    const pinInfo = document.getElementById('pinAccuracyInfo');
    const apkPinInfo = document.getElementById('apkPinAccuracyInfo');

    if (!navigator.geolocation) {
        alert("आपल्या डिव्हाइसवर Geolocation (GPS) सपोर्ट उपलब्ध नाही.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-satellite-dish fa-spin text-blue-600"></i> <span>GPS अचूक शोधत आहे...</span>';
    }
    if (apkBtn) {
        apkBtn.disabled = true;
        apkBtn.innerHTML = '<i class="fa-solid fa-satellite-dish fa-spin text-blue-600"></i> <span>GPS शोधत आहे...</span>';
    }
    if (pinInfo) {
        pinInfo.innerHTML = '<span class="text-blue-600 font-semibold"><i class="fa-solid fa-satellite-dish fa-spin"></i> सॅटेलाइट GPS सिग्नल शोधत आहे...</span>';
    }
    if (apkPinInfo) {
        apkPinInfo.innerHTML = '<span class="text-blue-600 font-semibold"><i class="fa-solid fa-satellite-dish fa-spin"></i> सॅटेलाइट GPS शोधत आहे...</span>';
    }

    let bestFix = null;
    const maxWaitTime = 7000;

    const finalizeGpsLocation = async (position) => {
        try {
            if (typeof triggerHapticFeedback === 'function') {
                triggerHapticFeedback(60);
            }
            const lat = Number(position.coords.latitude.toFixed(6));
            const lng = Number(position.coords.longitude.toFixed(6));
            const accuracy = Math.round(position.coords.accuracy || 0);

            currentCustomerLocation = {
                lat: lat,
                lng: lng,
                accuracy: accuracy,
                timestamp: Date.now(),
                userAdjusted: true
            };

            try {
                localStorage.setItem('gharmitra_saved_location', JSON.stringify(currentCustomerLocation));
            } catch(e) {}

            updateCustomerPinMapLocation(lat, lng, true);

            // Find closest Pune Area from PUNE_AREA_COORDINATES
            let closestArea = null;
            let minDistance = Infinity;
            if (typeof PUNE_AREA_COORDINATES === 'object') {
                for (const [areaName, coords] of Object.entries(PUNE_AREA_COORDINATES)) {
                    const d = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
                    if (d < minDistance) {
                        minDistance = d;
                        closestArea = areaName;
                    }
                }
            }

            const areaSelect = document.getElementById('areaSelect');
            if (areaSelect && closestArea && minDistance < 15) {
                areaSelect.value = closestArea;
                try {
                    localStorage.setItem('gharmitra_saved_area', closestArea);
                } catch(e) {}
            }

            // Reverse geocode via OpenStreetMap Nominatim with fallback
            let detectedAddressText = "";
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                    headers: { 'Accept-Language': 'mr,en' }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.address) {
                        const a = data.address;
                        const parts = [];
                        if (a.building || a.house_number || a.apartment) {
                            parts.push(a.building || a.house_number || a.apartment);
                        }
                        if (a.road || a.pedestrian || a.suburb) {
                            parts.push(a.road || a.pedestrian || a.suburb);
                        }
                        if (a.neighbourhood || a.residential) {
                            parts.push(a.neighbourhood || a.residential);
                        }
                        if (closestArea && !parts.some(p => p.toLowerCase().includes(closestArea.toLowerCase()))) {
                            parts.push(closestArea);
                        }
                        parts.push('Pune');
                        if (a.postcode) {
                            parts.push(a.postcode);
                        }
                        detectedAddressText = parts.filter(Boolean).join(', ');
                    }
                }
            } catch (fetchErr) {
                console.warn("Nominatim fetch error:", fetchErr);
            }

            const addressInput = document.getElementById('customerAddress');
            if (addressInput) {
                const currentVal = addressInput.value.trim();
                if (!currentVal) {
                    addressInput.value = detectedAddressText || `${closestArea || 'Pune'}, Maharashtra (GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`;
                } else if (detectedAddressText && !currentVal.toLowerCase().includes(closestArea ? closestArea.toLowerCase() : 'pune')) {
                    addressInput.value = `${currentVal}, ${detectedAddressText}`;
                }
                try {
                    localStorage.setItem('gharmitra_saved_address', addressInput.value.trim());
                    localStorage.setItem('gharmitra_customer_address', addressInput.value.trim());
                } catch(e) {}
            }

            renderGpsLocationBadge(lat, lng, accuracy);

            const savedBadge = document.getElementById('savedAddressBadge');
            if (savedBadge) {
                savedBadge.classList.remove('hidden');
                savedBadge.classList.add('inline-flex');
                const badgeText = document.getElementById('savedAddressBadgeText');
                if (badgeText) badgeText.innerText = "पत्ता व अचूक GPS सेव्ह झाले";
            }

            if (btn) {
                btn.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-600"></i> <span class="text-emerald-700">GPS लॉक (±${accuracy}m)</span>`;
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-crosshairs text-blue-600"></i> <span>अचूक लोकेशन मिळवा (GPS)</span>';
                }, 3000);
            }

            if (pinInfo) {
                pinInfo.innerHTML = `<span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-check"></i> अचूक GPS लॉक (±${accuracy}m)</span> • मॅपवर पिन हलवून सूक्ष्म बदल करू शकता`;
            }

        } catch (err) {
            console.error("GPS processing error:", err);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
            if (apkBtn) {
                apkBtn.disabled = false;
                apkBtn.innerHTML = originalApkBtnHtml;
            }
        }
    };

    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    let isDone = false;
    const stopWatching = () => {
        if (isDone) return;
        isDone = true;
        if (gpsWatchId !== null) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
        }
        if (bestFix) {
            finalizeGpsLocation(bestFix);
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
            if (apkBtn) {
                apkBtn.disabled = false;
                apkBtn.innerHTML = originalApkBtnHtml;
            }
            if (pinInfo) {
                pinInfo.innerHTML = '<i class="fa-solid fa-hand-pointer text-blue-500"></i> मॅपवर कुठेही टॅप करा किंवा लाल पिन ड्रॅग करा';
            }
        }
    };

    const timer = setTimeout(stopWatching, maxWaitTime);

    gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const acc = position.coords.accuracy || 999;
            if (!bestFix || acc < (bestFix.coords.accuracy || 999)) {
                bestFix = position;
            }

            if (btn) {
                btn.innerHTML = `<i class="fa-solid fa-satellite-dish fa-spin text-blue-600"></i> <span>GPS अचूक करत आहे... (±${Math.round(acc)}m)</span>`;
            }

            // High precision satellite fix achieved (<= 20 meters)
            if (acc <= 20) {
                clearTimeout(timer);
                stopWatching();
            }
        },
        (err) => {
            console.warn("Geolocation watch error:", err);
            if (bestFix) {
                clearTimeout(timer);
                stopWatching();
            } else {
                clearTimeout(timer);
                if (gpsWatchId !== null) {
                    navigator.geolocation.clearWatch(gpsWatchId);
                    gpsWatchId = null;
                }
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                }
                if (pinInfo) {
                    pinInfo.innerHTML = '<i class="fa-solid fa-hand-pointer text-blue-500"></i> मॅपवर कुठेही टॅप करा किंवा लाल पिन ड्रॅग करा';
                }
                let errorMsg = "GPS अचूक लोकेशन मिळवण्यात अडचण आली.";
                if (err.code === 1) {
                    errorMsg = "लोकेशन ॲक्सेस नाकारला गेला. कृपया ब्राउझर / ॲपमध्ये Location Permission Allow (चालू) करा.";
                } else if (err.code === 2) {
                    errorMsg = "डिव्हाइसचे लोकेशन उपलब्ध नाही. कृपया फोनचे GPS चालू करा.";
                } else if (err.code === 3) {
                    errorMsg = "लोकेशन शोधण्याची वेळ संपली. कृपया पुन्हा प्रयत्न करा.";
                }
                alert(errorMsg);
            }
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        }
    );
}

function populateBookingProfile() {
    customerProfile = readCustomerSession();
    if (!customerProfile) {
        populateSavedAddress();
        return;
    }

    const nameInput = document.getElementById('customerName');
    const mobileInput = document.getElementById('customerMobile');
    if (nameInput) nameInput.value = customerProfile.fullName || customerProfile.name || '';
    if (mobileInput) mobileInput.value = customerProfile.mobile || '';

    populateSavedAddress();
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
    const profAddress = document.getElementById('profileAddress');
    if (profAddress) {
        profAddress.value = customerProfile.address || localStorage.getItem('gharmitra_saved_address') || '';
    }
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
            address: profile.address || '',
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
    const profAddress = document.getElementById('profileAddress');
    const nextAddress = profAddress ? profAddress.value.trim() : '';

    if (!nextName || !nextEmail || !/^\d{10}$/.test(nextMobile)) {
        setProfileStatus('पूर्ण नाव, योग्य email आणि 10-digit mobile number द्या.', 'error');
        return;
    }

    const currentName = customerProfile.fullName || customerProfile.name || '';
    const currentAddress = customerProfile.address || '';
    const emailChanged = nextEmail !== String(customerProfile.email || '').toLowerCase();
    const mobileChanged = nextMobile !== String(customerProfile.mobile || '');
    const addressChanged = nextAddress !== currentAddress;

    const nextProfile = { ...customerProfile, fullName: nextName, name: nextName, email: nextEmail, mobile: nextMobile, address: nextAddress, role: 'customer' };

    if (!emailChanged && !mobileChanged) {
        if (nextName === currentName && !addressChanged) {
            setProfileStatus('कोणताही बदल केलेला नाही.', 'info');
            return;
        }
        writeCustomerProfile(nextProfile, customerProfile.mobile);
        if (nextAddress) {
            try {
                localStorage.setItem('gharmitra_saved_address', nextAddress);
                localStorage.setItem('gharmitra_customer_address', nextAddress);
            } catch(e) {}
            const addrField = document.getElementById('customerAddress');
            if (addrField) addrField.value = nextAddress;
            const savedBadge = document.getElementById('savedAddressBadge');
            if (savedBadge) {
                savedBadge.classList.remove('hidden');
                savedBadge.classList.add('inline-flex');
            }
        }
        setProfileStatus('प्रोफाइल माहिती व पत्ता यशस्वीरीत्या अपडेट झाले.', 'success');
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

        // ==========================================
        // VOICE NOTE RECORDING & PREVIEW LOGIC
        // ==========================================
        let voiceMediaRecorder = null;
        let voiceAudioChunks = [];
        let voiceStream = null;
        let voiceRecordTimer = null;
        let voiceRecordSeconds = 0;
        const MAX_VOICE_RECORD_SECONDS = 30;
        let currentVoiceNoteBlob = null;
        let currentVoiceNoteDataUrl = "";
        let isVoicePlaying = false;

        function triggerHapticFeedback(duration = 60) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                try {
                    navigator.vibrate(duration);
                } catch (e) {
                    console.debug('Haptic feedback error:', e);
                }
            }
        }

        async function startVoiceRecording() {
            triggerHapticFeedback(60);

            const promptEl = document.getElementById('voiceRecordPrompt');
            const activeEl = document.getElementById('voiceRecordingActive');
            const previewEl = document.getElementById('voiceAudioPreviewCard');
            const badgeEl = document.getElementById('voiceNoteBadge');

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("तुमच्या ब्राउझरमध्ये व्हॉइस रेकॉर्डिंग सपोर्ट नाही / Voice recording is not supported in this browser.");
                return;
            }

            try {
                voiceAudioChunks = [];
                voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });

                let mimeType = 'audio/webm;codecs=opus';
                if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
                    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                        mimeType = 'audio/webm;codecs=opus';
                    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                        mimeType = 'audio/mp4';
                    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                        mimeType = 'audio/ogg';
                    } else {
                        mimeType = '';
                    }
                }

                voiceMediaRecorder = mimeType ? new MediaRecorder(voiceStream, { mimeType }) : new MediaRecorder(voiceStream);

                voiceMediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        voiceAudioChunks.push(event.data);
                    }
                };

                voiceMediaRecorder.onstop = () => {
                    if (voiceStream) {
                        voiceStream.getTracks().forEach(track => track.stop());
                        voiceStream = null;
                    }
                    if (voiceRecordTimer) {
                        clearInterval(voiceRecordTimer);
                        voiceRecordTimer = null;
                    }

                    if (voiceAudioChunks.length > 0) {
                        const recordedBlob = new Blob(voiceAudioChunks, { type: voiceMediaRecorder.mimeType || 'audio/webm' });
                        currentVoiceNoteBlob = recordedBlob;

                        const reader = new FileReader();
                        reader.onloadend = () => {
                            currentVoiceNoteDataUrl = reader.result;
                            setupVoicePreviewPlayer(currentVoiceNoteDataUrl);
                        };
                        reader.readAsDataURL(recordedBlob);
                    }
                };

                voiceMediaRecorder.start(200);
                voiceRecordSeconds = 0;
                updateVoiceTimerDisplay();

                if (promptEl) promptEl.classList.add('hidden');
                if (previewEl) previewEl.classList.add('hidden');
                if (badgeEl) badgeEl.classList.add('hidden');
                if (activeEl) {
                    activeEl.classList.remove('hidden');
                    activeEl.classList.add('flex');
                }

                voiceRecordTimer = setInterval(() => {
                    voiceRecordSeconds++;
                    updateVoiceTimerDisplay();
                    if (voiceRecordSeconds >= MAX_VOICE_RECORD_SECONDS) {
                        stopVoiceRecording();
                    }
                }, 1000);

            } catch (err) {
                console.error("Microphone access error:", err);
                alert("मायक्रोफोन परवानगी नाकारली किंवा त्रुटी आली / Microphone permission denied or error: " + err.message);
            }
        }

        function stopVoiceRecording() {
            triggerHapticFeedback(60);

            if (voiceMediaRecorder && voiceMediaRecorder.state !== 'inactive') {
                try {
                    voiceMediaRecorder.stop();
                } catch (e) {
                    console.error("Error stopping voice recorder:", e);
                }
            }
            if (voiceRecordTimer) {
                clearInterval(voiceRecordTimer);
                voiceRecordTimer = null;
            }
        }

        function updateVoiceTimerDisplay() {
            const timerDisplay = document.getElementById('voiceRecordTimer');
            if (!timerDisplay) return;
            const mins = String(Math.floor(voiceRecordSeconds / 60)).padStart(2, '0');
            const secs = String(voiceRecordSeconds % 60).padStart(2, '0');
            timerDisplay.innerText = `${mins}:${secs} / 00:30`;
        }

        function setupVoicePreviewPlayer(audioSrc) {
            const promptEl = document.getElementById('voiceRecordPrompt');
            const activeEl = document.getElementById('voiceRecordingActive');
            const previewEl = document.getElementById('voiceAudioPreviewCard');
            const badgeEl = document.getElementById('voiceNoteBadge');
            const audioEl = document.getElementById('voiceAudioElement');
            const progressBar = document.getElementById('voiceProgressBar');
            const currentTimeEl = document.getElementById('voiceCurrentTime');
            const totalTimeEl = document.getElementById('voiceTotalTime');
            const durationBadge = document.getElementById('voiceAudioDurationBadge');

            if (activeEl) {
                activeEl.classList.add('hidden');
                activeEl.classList.remove('flex');
            }
            if (promptEl) promptEl.classList.add('hidden');
            if (badgeEl) {
                badgeEl.classList.remove('hidden');
                badgeEl.classList.add('inline-flex');
            }
            if (previewEl) previewEl.classList.remove('hidden');

            const apkPromptEl = document.getElementById('apkVoiceRecordPrompt');
            const apkActiveEl = document.getElementById('apkVoiceRecordingActive');
            const apkBadgeEl = document.getElementById('apkVoiceNoteBadge');
            const apkPreviewEl = document.getElementById('apkVoiceAudioPreviewCard');
            if (apkActiveEl) {
                apkActiveEl.classList.add('hidden');
                apkActiveEl.classList.remove('flex');
            }
            if (apkPromptEl) apkPromptEl.classList.add('hidden');
            if (apkBadgeEl) {
                apkBadgeEl.classList.remove('hidden');
                apkBadgeEl.classList.add('inline-flex');
            }
            if (apkPreviewEl) apkPreviewEl.classList.remove('hidden');

            if (audioEl) {
                audioEl.src = audioSrc;
                audioEl.load();

                audioEl.onloadedmetadata = () => {
                    const dur = Math.round(audioEl.duration) || voiceRecordSeconds || 0;
                    const durStr = `00:${String(dur).padStart(2, '0')}`;
                    if (totalTimeEl) totalTimeEl.innerText = durStr;
                    if (durationBadge) durationBadge.innerText = `${dur}s`;
                };

                audioEl.ontimeupdate = () => {
                    if (audioEl.duration) {
                        const percent = (audioEl.currentTime / audioEl.duration) * 100;
                        if (progressBar) progressBar.style.width = percent + '%';
                        const curSec = Math.floor(audioEl.currentTime);
                        if (currentTimeEl) currentTimeEl.innerText = `00:${String(curSec).padStart(2, '0')}`;
                    }
                };

                audioEl.onended = () => {
                    isVoicePlaying = false;
                    const playIcon = document.getElementById('voicePlayIcon');
                    if (playIcon) playIcon.className = 'fa-solid fa-play text-white text-xs ml-0.5';
                    if (progressBar) progressBar.style.width = '0%';
                    if (currentTimeEl) currentTimeEl.innerText = '00:00';
                };
            }
        }

        function togglePlayVoicePreview() {
            triggerHapticFeedback(60);
            const audioEl = document.getElementById('voiceAudioElement');
            const playIcon = document.getElementById('voicePlayIcon');
            if (!audioEl) return;

            if (isVoicePlaying) {
                audioEl.pause();
                isVoicePlaying = false;
                if (playIcon) playIcon.className = 'fa-solid fa-play text-white text-xs ml-0.5';
            } else {
                audioEl.play().then(() => {
                    isVoicePlaying = true;
                    if (playIcon) playIcon.className = 'fa-solid fa-pause text-white text-xs';
                }).catch(err => {
                    console.error("Audio playback error:", err);
                });
            }
        }

        function seekVoicePreview(event) {
            const audioEl = document.getElementById('voiceAudioElement');
            const track = document.getElementById('voiceProgressTrack');
            if (!audioEl || !track || !audioEl.duration) return;

            const rect = track.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const fraction = Math.max(0, Math.min(1, clickX / rect.width));
            audioEl.currentTime = fraction * audioEl.duration;
        }

        function deleteVoiceNote() {
            triggerHapticFeedback(60);

            const audioEl = document.getElementById('voiceAudioElement');
            if (audioEl) {
                audioEl.pause();
                audioEl.src = "";
            }
            isVoicePlaying = false;
            currentVoiceNoteBlob = null;
            currentVoiceNoteDataUrl = "";
            voiceAudioChunks = [];
            voiceRecordSeconds = 0;

            const promptEl = document.getElementById('voiceRecordPrompt');
            const activeEl = document.getElementById('voiceRecordingActive');
            const previewEl = document.getElementById('voiceAudioPreviewCard');
            const badgeEl = document.getElementById('voiceNoteBadge');
            const playIcon = document.getElementById('voicePlayIcon');
            const progressBar = document.getElementById('voiceProgressBar');
            const currentTimeEl = document.getElementById('voiceCurrentTime');

            if (playIcon) playIcon.className = 'fa-solid fa-play text-white text-xs ml-0.5';
            if (progressBar) progressBar.style.width = '0%';
            if (currentTimeEl) currentTimeEl.innerText = '00:00';

            if (previewEl) previewEl.classList.add('hidden');
            if (activeEl) {
                activeEl.classList.add('hidden');
                activeEl.classList.remove('flex');
            }
            if (badgeEl) badgeEl.classList.add('hidden');
            if (promptEl) promptEl.classList.remove('hidden');

            const apkPromptEl = document.getElementById('apkVoiceRecordPrompt');
            const apkActiveEl = document.getElementById('apkVoiceRecordingActive');
            const apkBadgeEl = document.getElementById('apkVoiceNoteBadge');
            const apkPreviewEl = document.getElementById('apkVoiceAudioPreviewCard');
            const apkPlayIcon = document.getElementById('apkVoicePlayIcon');
            const apkProgressBar = document.getElementById('apkVoiceProgressBar');
            const apkCurrentTime = document.getElementById('apkVoiceCurrentTime');

            if (apkPlayIcon) apkPlayIcon.className = 'fa-solid fa-play ml-0.5';
            if (apkProgressBar) apkProgressBar.style.width = '0%';
            if (apkCurrentTime) apkCurrentTime.innerText = '00:00';
            if (apkPreviewEl) apkPreviewEl.classList.add('hidden');
            if (apkActiveEl) {
                apkActiveEl.classList.add('hidden');
                apkActiveEl.classList.remove('flex');
            }
            if (apkBadgeEl) apkBadgeEl.classList.add('hidden');
            if (apkPromptEl) apkPromptEl.classList.remove('hidden');
        }

        window.startVoiceRecording = startVoiceRecording;
        window.stopVoiceRecording = stopVoiceRecording;
        window.togglePlayVoicePreview = togglePlayVoicePreview;
        window.seekVoicePreview = seekVoicePreview;
        window.deleteVoiceNote = deleteVoiceNote;
        window.triggerHapticFeedback = triggerHapticFeedback;

        function resetSubmitButtons(isEmergency = false) {
            const submitBtn = document.getElementById('submitBtn');
            const apkSubmitBtn = document.getElementById('apkSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                if (isEmergency) {
                    submitBtn.className = 'w-full bg-red-600 hover:bg-red-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-red-500/25 transition text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer';
                    submitBtn.innerHTML = '<i class="fa-solid fa-bolt text-yellow-300"></i> <span>₹५० भरा आणि १०-मिनिट इमर्जन्सी बुक करा</span>';
                } else {
                    submitBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer';
                    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Book Appointment Now</span>';
                }
            }
            if (apkSubmitBtn) {
                apkSubmitBtn.disabled = false;
                if (isEmergency) {
                    apkSubmitBtn.className = 'w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-black text-base py-3.5 px-6 rounded-2xl shadow-lg shadow-red-500/25 transition flex items-center justify-center gap-2 cursor-pointer mt-5';
                    apkSubmitBtn.innerHTML = '<i class="fa-solid fa-bolt text-yellow-300"></i> <span>₹५० भरा आणि १०-मिनिट इमर्जन्सी बुक करा</span>';
                } else {
                    apkSubmitBtn.className = 'w-full bg-[#1868fe] hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-base py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer mt-5';
                    apkSubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Book Appointment Now</span>';
                }
            }
        }
        window.resetSubmitButtons = resetSubmitButtons;

        async function handleApkFormSubmit(e) {
            if (e) e.preventDefault();
            await handleFormSubmit(e);
        }
        window.handleApkFormSubmit = handleApkFormSubmit;

        async function handleFormSubmit(e) {
            if (e) e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            const apkSubmitBtn = document.getElementById('apkSubmitBtn');
            
            const isEmergency = (document.querySelector('input[name="bookingType"]:checked')?.value === 'emergency') ||
                                (document.querySelector('input[name="apkBookingType"]:checked')?.value === 'emergency');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = isEmergency
                    ? '<i class="fa-solid fa-spinner fa-spin"></i> <span>₹५० पेमेंट गेटवे उघडत आहे...</span>'
                    : '<i class="fa-solid fa-spinner fa-spin"></i> <span>Booking in progress...</span>';
            }
            if (apkSubmitBtn) {
                apkSubmitBtn.disabled = true;
                apkSubmitBtn.innerHTML = isEmergency
                    ? '<i class="fa-solid fa-spinner fa-spin"></i> <span>₹५० पेमेंट गेटवे उघडत आहे...</span>'
                    : '<i class="fa-solid fa-spinner fa-spin"></i> <span>Booking in progress...</span>';
            }

            const service = document.getElementById('apkServiceSelect')?.value || document.getElementById('serviceSelect')?.value;
            const name = (document.getElementById('apkCustomerName')?.value || document.getElementById('customerName')?.value || '').trim();
            const mobile = (document.getElementById('apkCustomerMobile')?.value || document.getElementById('customerMobile')?.value || '').trim();
            const area = document.getElementById('apkAreaSelect')?.value || document.getElementById('areaSelect')?.value;
            const address = (document.getElementById('apkCustomerAddress')?.value || document.getElementById('customerAddress')?.value || '').trim();
            const budget = document.getElementById('apkBudgetInput')?.value || document.getElementById('budgetInput')?.value;
            const date = document.getElementById('apkBookingDate')?.value || document.getElementById('bookingDate')?.value;
            const time = document.getElementById('apkBookingTime')?.value || document.getElementById('bookingTime')?.value;
            const photoInput = (document.getElementById('apkJobPhoto')?.files?.length)
                ? document.getElementById('apkJobPhoto')
                : document.getElementById('jobPhoto');

            if (!service || !name || !mobile || mobile.length !== 10 || !area || !address) {
                alert("कृपया सर्व आवश्यक माहिती आणि अचूक १० अंकी मोबाईल नंबर भरा!");
                resetSubmitButtons(isEmergency);
                return;
            }

            if (isEmergency) {
                const RAZORPAY_KEY = window.RAZORPAY_KEY_ID || 'rzp_live_TfQXrLjDz1z9nO';
                const amountInPaise = 5000;

                const options = {
                    key: RAZORPAY_KEY,
                    amount: amountInPaise,
                    currency: 'INR',
                    name: 'घरमित्र (Gharmitra) Pune',
                    description: `१०-मिनिट इमर्जन्सी SOS (₹५० ॲडव्हान्स) - ${service}`,
                    prefill: {
                        name: name,
                        contact: mobile,
                        email: (customerProfile && customerProfile.email) || 'customer@gharmitra.online'
                    },
                    theme: { color: '#dc2626' },
                    config: {
                        display: {
                            blocks: {
                                upi: {
                                    name: "Pay via UPI / QR (GPay, PhonePe, Paytm)",
                                    instruments: [{ method: "upi" }]
                                }
                            },
                            sequence: ["block.upi", "block.other"],
                            preferences: { show_default_blocks: true }
                        }
                    },
                    handler: async function (resp) {
                        try {
                            const paymentId = resp.razorpay_payment_id || ('PAY_SOS_' + Date.now());
                            await executeOrderCreation({
                                isEmergency: true,
                                paymentId: paymentId,
                                service, name, mobile, area, address, budget, date, time, photoInput
                            });
                        } catch (err) {
                            console.error('[SOS Save Error]', err);
                            alert("ऑर्डर सेव्ह करताना अडचण आली: " + err.message);
                        } finally {
                            resetSubmitButtons(isEmergency);
                        }
                    },
                    modal: {
                        ondismiss: function () {
                            resetSubmitButtons(isEmergency);
                            alert("पेमेंट रद्द झाले. १०-मिनिट इमर्जन्सी सेवेसाठी ₹५० ॲडव्हान्स भरणे आवश्यक आहे.");
                        }
                    }
                };

                try {
                    if (typeof Razorpay !== 'undefined') {
                        const rzp = new Razorpay(options);
                        rzp.on('payment.failed', function (failResp) {
                            alert("पेमेंट अयशस्वी झाले: " + (failResp.error ? failResp.error.description : 'कृपया पुन्हा प्रयत्न करा'));
                            resetSubmitButtons(isEmergency);
                        });
                        rzp.open();
                    } else {
                        const proceed = confirm("Razorpay थेट पेमेंट: ₹५० ॲडव्हान्स घरमित्र खात्यात जमा करून १०-मिनिट सायरन सुरू करायचा का?");
                        if (proceed) {
                            await options.handler({ razorpay_payment_id: 'PAY_SOS_TEST_' + Date.now() });
                        } else {
                            resetSubmitButtons(isEmergency);
                        }
                    }
                } catch(err) {
                    console.error('[SOS Checkout Error]', err);
                    alert("पेमेंट सुरू करताना अडचण आली: " + err.message);
                    resetSubmitButtons(isEmergency);
                }
                return;
            }

            // Normal Booking Flow
            try {
                await executeOrderCreation({
                    isEmergency: false,
                    service, name, mobile, area, address, budget, date, time, photoInput
                });
            } catch (err) {
                console.error("Booking Error:", err);
                alert("बुकिंग करताना अडचण आली: " + err.message);
            } finally {
                resetSubmitButtons(false);
            }
        }
        window.handleFormSubmit = handleFormSubmit;

        async function executeOrderCreation(params) {
            const { isEmergency, paymentId, service, name, mobile, area, address, budget, date, time, photoInput } = params;
            let photoUrl = "";

            if (photoInput && photoInput.files && photoInput.files.length > 0) {
                const file = photoInput.files[0];
                if (file.size <= 5 * 1024 * 1024) {
                    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
                    if (allowedMimes.includes(file.type.toLowerCase())) {
                        const formData = new FormData();
                        formData.append("image", file);
                        const apiKey = "d541e208822d67e4ed1fc4244d04c0c3"; 
                        try {
                            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                                method: "POST",
                                body: formData
                            });
                            const result = await response.json();
                            if (result.success) {
                                photoUrl = result.data.url; 
                            }
                        } catch(e) {
                            console.warn("Photo upload skipped:", e);
                        }
                    }
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

            try {
                if (address) {
                    localStorage.setItem('gharmitra_saved_address', address.trim());
                    localStorage.setItem('gharmitra_customer_address', address.trim());
                }
                if (area) {
                    localStorage.setItem('gharmitra_saved_area', area);
                }
                if (customerProfile) {
                    customerProfile.address = address.trim();
                    customerProfile.area = area;
                    localStorage.setItem('current_user_session', JSON.stringify(customerProfile));
                }
            } catch(e) {}

            const custLat = (currentCustomerLocation && currentCustomerLocation.lat) ? Number(currentCustomerLocation.lat) : (PUNE_AREA_COORDINATES[area] ? PUNE_AREA_COORDINATES[area].lat : 18.5204);
            const custLng = (currentCustomerLocation && currentCustomerLocation.lng) ? Number(currentCustomerLocation.lng) : (PUNE_AREA_COORDINATES[area] ? PUNE_AREA_COORDINATES[area].lng : 73.8567);
            const custMapsUrl = (currentCustomerLocation && currentCustomerLocation.lat)
                ? `https://www.google.com/maps?q=${currentCustomerLocation.lat},${currentCustomerLocation.lng}`
                : `https://maps.google.com/?q=${encodeURIComponent(address + ', ' + area + ', Pune')}`;

            const payload = {
                service: service,
                customerName: name,
                customerMobile: mobile,
                customerEmail: customerEmail,
                area: area,
                address: address,
                customerLat: custLat,
                customerLng: custLng,
                customerLocationAccuracy: (currentCustomerLocation && currentCustomerLocation.accuracy) ? currentCustomerLocation.accuracy : null,
                customerMapsUrl: custMapsUrl,
                hasExactGps: !!(currentCustomerLocation && currentCustomerLocation.lat),
                budget: isEmergency ? ("₹" + (budget || 500) + " (₹50 ॲडव्हान्स प्राप्त)") : ("₹" + (budget || 500)),
                date: date || new Date().toISOString().split('T')[0],
                time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                photoUrl: photoUrl,
                voiceNoteUrl: currentVoiceNoteDataUrl || "",
                hasVoiceNote: !!currentVoiceNoteDataUrl,
                status: "Pending",
                completionOtp: String(Math.floor(1000 + Math.random() * 9000)),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            if (isEmergency) {
                payload.isEmergency = true;
                payload.orderType = "emergency_sos";
                payload.priority = "SOS_CRITICAL";
                payload.advancePaidToAdmin = 50;
                payload.emergencyBonusToWorker = 30;
                payload.bonusCredited = false;
                payload.paymentId = paymentId || ("PAY_SOS_" + Date.now());
                payload.paymentStatus = "Captured";
                payload.paidToAdminAt = firebase.database.ServerValue.TIMESTAMP;
            }

            await newOrderRef.set(payload);
            deleteVoiceNote();

            if (isEmergency) {
                alert("🎉 ₹५० ॲडव्हान्स यशस्वीरित्या जमा झाला!\n\n🚨 १०-मिनिट इमर्जन्सी ऑर्डर नोंदवली गेली आहे! जवळच्या कारागिराला तात्काळ सायरन अलर्ट पाठवला गेला आहे.");
            } else {
                alert("तुमची अपॉइंटमेंट यशस्वीरीत्या बुक झाली आहे!");
            }

            trackLiveStatus(currentOrderId);

            setTimeout(() => {
                const liveCol = document.getElementById('customerLiveStatusColumn');
                if (liveCol) {
                    liveCol.classList.remove('hidden');
                    liveCol.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                const apkLiveCard = document.getElementById('apkCustomerLiveStatusCard');
                if (apkLiveCard) {
                    apkLiveCard.classList.remove('hidden');
                    apkLiveCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 200);
        }
        window.executeOrderCreation = executeOrderCreation;

        // ==========================================
        // FAMILY SAFETY SHARE CARD LOGIC
        // ==========================================
        let currentTrackedOrderData = null;

        function shareFamilySafetyOnWhatsApp() {
            triggerHapticFeedback(60);

            const orderId = currentOrderId || '';
            const orderData = currentTrackedOrderData || {};

            const shortOrderId = orderId ? orderId.slice(-6).toUpperCase() : 'N/A';
            const workerName = orderData.workerName || 'Verified Professional';
            const workerMobile = orderData.workerMobile || 'Masked / Protected';
            const serviceName = orderData.service || 'Home Service';
            const address = orderData.address || 'Pune';
            const workerRating = document.getElementById('safetyWorkerRating') ? document.getElementById('safetyWorkerRating').innerText : '4.9 Verified';

            const originUrl = (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null')
                ? window.location.origin
                : 'https://gharmitra.online';
            const liveTrackLink = orderId ? `${originUrl}/gharkam/customer.html?track=${encodeURIComponent(orderId)}` : originUrl;

            const message = 
`🛡️ *GHARMITRA FAMILY SAFETY DETAILS*
━━━━━━━━━━━━━━━━━━━━
Dear Family, here are the verified details of the home service technician visiting our home:

👤 *Worker Name:* ${workerName}
📞 *Mobile:* ${workerMobile}
⭐ *Rating:* ${workerRating}
🛠️ *Service:* ${serviceName}
📍 *Address:* ${address}
🆔 *Order ID:* #${shortOrderId}
🔒 *Verification Status:* Identity & Police Verified (Aadhaar Verified)

🗺️ *Live Tracking & Safety:*
${liveTrackLink}

_Sent securely via Gharmitra Family Safety Shield._`;

            const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
        }

        window.shareFamilySafetyOnWhatsApp = shareFamilySafetyOnWhatsApp;

        function setLiveStatusVisible(isVisible) {
            const mainContainer = document.getElementById('customerMainContainer');
            const bookingCol = document.getElementById('customerBookingColumn');
            const liveCol = document.getElementById('customerLiveStatusColumn');

            if (!liveCol) return;

            if (isVisible) {
                liveCol.classList.remove('hidden');
                if (mainContainer) {
                    mainContainer.classList.add('max-w-6xl');
                }
                if (bookingCol) {
                    bookingCol.classList.remove('lg:col-span-12');
                    bookingCol.classList.add('lg:col-span-7');
                }
            } else {
                liveCol.classList.add('hidden');
                if (mainContainer) {
                    mainContainer.classList.add('max-w-6xl');
                }
                if (bookingCol) {
                    bookingCol.classList.remove('lg:col-span-7');
                    bookingCol.classList.add('lg:col-span-12');
                }
            }
        }

        function closeLiveStatusView() {
            if (activeListener) {
                database.ref("orders/" + activeListener).off();
                activeListener = null;
            }
            if (workerLocationListener && activeLocationOrderId) {
                database.ref("orders/" + activeLocationOrderId + "/workerLiveLocation").off();
                workerLocationListener = null;
                activeLocationOrderId = null;
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem('gharmitra_active_order_id');
                }
            } catch (e) {}
            currentOrderId = null;
            setLiveStatusVisible(false);
            if (typeof window !== 'undefined' && window.scrollTo) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        const lastTrackedCustomerOrderStatus = {};

        function trackLiveStatus(orderId) {
            if (!orderId) return;
            currentOrderId = orderId;
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('gharmitra_active_order_id', orderId);
                }
            } catch (e) {}

            setLiveStatusVisible(true);

            if (activeListener) {
                database.ref("orders/" + activeListener).off();
            }
            activeListener = orderId;

            database.ref("orders/" + orderId).on("value", (snapshot) => {
                const data = snapshot.val();
                if(!data) return;

                // Push Notification Alert for Customer on status changes
                const prevStatus = lastTrackedCustomerOrderStatus[orderId];
                if (prevStatus && prevStatus !== data.status) {
                    if (window.GharmitraPush && typeof window.GharmitraPush.showSystemNotification === 'function') {
                        const workerName = data.workerName || 'घरमित्र कामगार';
                        const srv = data.service || 'घरकाम';
                        if (data.status === 'Accepted') {
                            window.GharmitraPush.showSystemNotification({
                                title: `👷 ऑर्डर स्वीकारली: ${srv}`,
                                body: `${workerName} यांनी तुमची ऑर्डर स्वीकारली आहे आणि ते लवकरच पोहोचतील.`,
                                url: 'customer.html',
                                tag: 'cust-order-' + orderId
                            });
                        } else if (data.status === 'On The Way') {
                            window.GharmitraPush.showSystemNotification({
                                title: `🚴 कामगार निघाला आहे: ${workerName}`,
                                body: `${workerName} तुमच्या घराकडे निघाले आहेत. थेट नकाशावर ट्रॅक करा!`,
                                url: 'customer.html',
                                tag: 'cust-order-' + orderId
                            });
                        } else if (data.status === 'In Progress') {
                            window.GharmitraPush.showSystemNotification({
                                title: `🛠️ काम सुरू झाले: ${srv}`,
                                body: `${workerName} यांनी कामाला सुरुवात केली आहे.`,
                                url: 'customer.html',
                                tag: 'cust-order-' + orderId
                            });
                        } else if (data.status === 'Completed') {
                            window.GharmitraPush.showSystemNotification({
                                title: `🎉 काम पूर्ण झाले: ${srv}`,
                                body: `ऑर्डर यशस्वीरित्या पूर्ण झाली! कृपया अनुभव रेटिंग द्या.`,
                                url: 'customer.html',
                                tag: 'cust-order-' + orderId
                            });
                        }
                    }
                }
                lastTrackedCustomerOrderStatus[orderId] = data.status;

                currentTrackedOrderData = data;

                // Sync APK Live Status Card
                const apkLiveCard = document.getElementById('apkCustomerLiveStatusCard');
                if (apkLiveCard) {
                    apkLiveCard.classList.remove('hidden');
                    const apkSrv = document.getElementById('apkStatusService');
                    const apkBud = document.getElementById('apkStatusBudget');
                    const apkWork = document.getElementById('apkStatusWorker');
                    const apkRating = document.getElementById('apkStatusWorkerRating');
                    const apkBadgeText = document.getElementById('apkStatusBadgeText');
                    const apkOtpCard = document.getElementById('apkCompletionOtpCard');
                    const apkOtpCode = document.getElementById('apkOtpCodeDisplay');
                    const apkCommActions = document.getElementById('apkCommActions');
                    const apkCallBtn = document.getElementById('apkCallWorkerBtn');

                    if (apkSrv) apkSrv.innerText = data.service || "-";
                    if (apkBud) apkBud.innerText = data.budget || "-";
                    if (apkWork) apkWork.innerText = data.workerName || "Finding Worker...";
                    if (apkBadgeText) apkBadgeText.innerText = data.status || "Pending";

                    if (apkOtpCard && apkOtpCode && data.completionOtp && data.status !== 'Completed' && data.status !== 'Cancelled') {
                        apkOtpCard.classList.remove('hidden');
                        apkOtpCode.innerText = data.completionOtp;
                    } else if (apkOtpCard) {
                        apkOtpCard.classList.add('hidden');
                    }

                    const canComm = data.status === 'Accepted' || data.status === 'On The Way' || data.status === 'In Progress';
                    if (apkCommActions) {
                        apkCommActions.classList.toggle('hidden', !canComm);
                        apkCommActions.classList.toggle('grid', canComm);
                    }
                    if (apkCallBtn && data.workerMobile) {
                        const cleanNum = String(data.workerMobile).replace(/[^\d+]/g, '');
                        apkCallBtn.href = cleanNum.startsWith('+') ? `tel:${cleanNum}` : `tel:+91${cleanNum.slice(-10)}`;
                    }
                }

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

                // Family Safety Share Card
                const safetyCard = document.getElementById('familySafetyShareCard');
                if (safetyCard) {
                    const isWorkerAssigned = !!(data.workerName || data.workerMobile || ['Accepted', 'On The Way', 'In Progress', 'Completed'].includes(data.status));
                    if (isWorkerAssigned && data.status !== 'Cancelled') {
                        safetyCard.classList.remove('hidden');

                        const safetyWorkerName = document.getElementById('safetyWorkerName');
                        const safetyWorkerAvatar = document.getElementById('safetyWorkerAvatar');
                        const safetyWorkerService = document.getElementById('safetyWorkerService');
                        const safetyWorkerPhone = document.getElementById('safetyWorkerPhone');
                        const safetyWorkerRating = document.getElementById('safetyWorkerRating');

                        if (safetyWorkerName) safetyWorkerName.innerText = data.workerName || "Verified Partner";
                        if (safetyWorkerAvatar) {
                            safetyWorkerAvatar.src = data.workerPhoto || "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=100&auto=format&fit=crop&q=80";
                        }
                        if (safetyWorkerService) safetyWorkerService.innerText = data.service || "Home Service";
                        if (safetyWorkerPhone) safetyWorkerPhone.innerText = maskedWorkerNumber;
                        if (safetyWorkerRating && ratingDisplay) {
                            safetyWorkerRating.innerText = ratingDisplay.innerText || "4.9 Verified";
                        }
                    } else {
                        safetyCard.classList.add('hidden');
                    }
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
                const target = document.getElementById('customerLiveStatusColumn') || document.getElementById('liveStatusContainer') || document.getElementById('stepsTrackerContainer');
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
        window.trackLiveStatus = trackLiveStatus;
        window.setLiveStatusVisible = setLiveStatusVisible;
        window.closeLiveStatusView = closeLiveStatusView;
        window.initCustomerOrderState = initCustomerOrderState;
        window.detectCustomerExactLocation = detectCustomerExactLocation;
        window.handleAddressChange = handleAddressChange;
        window.focusAddressForEdit = focusAddressForEdit;
        window.populateSavedAddress = populateSavedAddress;
        window.renderGpsLocationBadge = renderGpsLocationBadge;
        window.initCustomerPinMap = initCustomerPinMap;
        window.updateCustomerPinMapLocation = updateCustomerPinMapLocation;
        window.setupAreaSelectMapSync = setupAreaSelectMapSync;


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

// =========================================================
// Customer Live Status Visibility & Initialization
// =========================================================
function initCustomerOrderState() {
    populateSavedAddress();

    // 1. Check URL param first: e.g. customer.html?track=-Oabc123
    let urlTrackId = null;
    try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            urlTrackId = params.get('track');
        }
    } catch (e) {}

    if (urlTrackId) {
        trackLiveStatus(urlTrackId);
        return;
    }

    // 2. Check localStorage for active order
    let savedOrderId = null;
    try {
        if (typeof localStorage !== 'undefined') {
            savedOrderId = localStorage.getItem('gharmitra_active_order_id');
        }
    } catch (e) {}

    if (savedOrderId && typeof database !== 'undefined') {
        database.ref("orders/" + savedOrderId).once("value").then((snapshot) => {
            const data = snapshot.val();
            const activeStatuses = ['Pending', 'Accepted', 'On The Way', 'In Progress'];
            if (data && activeStatuses.includes(data.status)) {
                trackLiveStatus(savedOrderId);
            } else {
                try {
                    if (typeof localStorage !== 'undefined') {
                        localStorage.removeItem('gharmitra_active_order_id');
                    }
                } catch (e) {}
                setLiveStatusVisible(false);
            }
        }).catch(() => {
            setLiveStatusVisible(false);
        });
    } else {
        setLiveStatusVisible(false);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCustomerOrderState);
    } else {
        initCustomerOrderState();
    }
}


// ==========================================
// 10-MINUTE EMERGENCY SOS BREAKDOWN SYSTEM (₹50 ADVANCE TO ADMIN)
// ==========================================

function openEmergencySosModal() {
    const modal = document.getElementById('emergencySosModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const nameInput = document.getElementById('sosCustomerName');
    const mobileInput = document.getElementById('sosCustomerMobile');
    const areaSelect = document.getElementById('sosAreaSelect');
    const addressInput = document.getElementById('sosAddress');

    const curName = document.getElementById('apkCustomerName')?.value || document.getElementById('customerName')?.value || (customerProfile && customerProfile.name) || '';
    const curMobile = document.getElementById('apkCustomerMobile')?.value || document.getElementById('customerMobile')?.value || (customerProfile && customerProfile.mobile) || '';
    const curArea = document.getElementById('apkAreaSelect')?.value || document.getElementById('areaSelect')?.value || (customerProfile && customerProfile.area) || 'Dhankawadi';
    const curAddress = document.getElementById('apkCustomerAddress')?.value || document.getElementById('customerAddress')?.value || (customerProfile && customerProfile.address) || '';

    if (nameInput && !nameInput.value) nameInput.value = curName;
    if (mobileInput && !mobileInput.value) mobileInput.value = curMobile;
    if (areaSelect && curArea) areaSelect.value = curArea;
    if (addressInput && !addressInput.value) addressInput.value = curAddress;
}
window.openEmergencySosModal = openEmergencySosModal;

function closeEmergencySosModal() {
    const modal = document.getElementById('emergencySosModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}
window.closeEmergencySosModal = closeEmergencySosModal;

function detectSosGpsLocation() {
    const btn = document.getElementById('sosGpsBtn');
    const text = document.getElementById('sosGpsText');
    const addr = document.getElementById('sosAddress');
    const area = document.getElementById('sosAreaSelect');

    if (!navigator.geolocation) {
        alert("आपल्या डिव्हाइसवर GPS उपलब्ध नाही.");
        return;
    }
    if (btn) {
        btn.disabled = true;
        if (text) text.innerText = "GPS शोधत आहे...";
    }
    navigator.geolocation.getCurrentPosition((pos) => {
        if (btn) {
            btn.disabled = false;
            if (text) text.innerText = "✓ GPS स्थान मिळाले";
        }
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        currentCustomerLocation = {
            lat: lat,
            lng: lng,
            accuracy: Math.round(pos.coords.accuracy || 10),
            timestamp: Date.now()
        };
        let closestArea = null;
        let minDistance = Infinity;
        if (typeof PUNE_AREA_COORDINATES === 'object') {
            for (const [areaName, coords] of Object.entries(PUNE_AREA_COORDINATES)) {
                const d = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
                if (d < minDistance) {
                    minDistance = d;
                    closestArea = areaName;
                }
            }
        }
        if (area && closestArea) {
            area.value = closestArea;
        }
        if (addr && (!addr.value.trim() || addr.value.startsWith('GPS:'))) {
            addr.value = `GPS: ${lat}, ${lng} (${closestArea || 'Pune'})`;
        }
    }, (err) => {
        if (btn) {
            btn.disabled = false;
            if (text) text.innerText = "GPS स्थान घ्या";
        }
        alert("GPS स्थान मिळवता आले नाही. कृपया पत्ता मॅन्युअली टाईप करा.");
    }, { enableHighAccuracy: true, timeout: 8000 });
}
window.detectSosGpsLocation = detectSosGpsLocation;

async function handleEmergencySosSubmit(e) {
    if (e) e.preventDefault();
    const submitBtn = document.getElementById('sosSubmitBtn');
    const categoryEl = document.querySelector('input[name="sosCategory"]:checked');
    const category = categoryEl ? categoryEl.value : 'Emergency SOS Breakdown';

    const name = document.getElementById('sosCustomerName')?.value.trim();
    const mobile = document.getElementById('sosCustomerMobile')?.value.trim();
    const area = document.getElementById('sosAreaSelect')?.value;
    const address = document.getElementById('sosAddress')?.value.trim();

    if (!name || !mobile || mobile.length !== 10 || !address) {
        alert("कृपया सर्व माहिती आणि अचूक १० अंकी मोबाईल नंबर भरा!");
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>₹५० पेमेंट गेटवे उघडत आहे...</span>';
    }

    const RAZORPAY_KEY = window.RAZORPAY_KEY_ID || 'rzp_live_TfQXrLjDz1z9nO';
    const amountInPaise = 5000;

    const options = {
        key: RAZORPAY_KEY,
        amount: amountInPaise,
        currency: 'INR',
        name: 'Gharmitra Online',
        description: `10-Min Emergency SOS Advance (₹50) - ${category}`,
        prefill: {
            name: name,
            contact: mobile,
            email: (customerProfile && customerProfile.email) || 'customer@gharmitra.online'
        },
        theme: { color: '#dc2626' },
        config: {
            display: {
                blocks: {
                    upi: {
                        name: "Pay via UPI / QR (GPay, PhonePe, Paytm)",
                        instruments: [{ method: "upi" }]
                    }
                },
                sequence: ["block.upi", "block.other"],
                preferences: { show_default_blocks: true }
            }
        },
        handler: async function (resp) {
            console.log('[Emergency SOS Razorpay Success]', resp);
            try {
                const paymentId = resp.razorpay_payment_id || ('PAY_SOS_' + Date.now());
                const custLat = (currentCustomerLocation && currentCustomerLocation.lat) ? Number(currentCustomerLocation.lat) : (PUNE_AREA_COORDINATES[area] ? PUNE_AREA_COORDINATES[area].lat : 18.5204);
                const custLng = (currentCustomerLocation && currentCustomerLocation.lng) ? Number(currentCustomerLocation.lng) : (PUNE_AREA_COORDINATES[area] ? PUNE_AREA_COORDINATES[area].lng : 73.8567);

                const newOrderRef = database.ref("orders").push();
                currentOrderId = newOrderRef.key;

                const payload = {
                    service: "🚨 " + category,
                    customerName: name,
                    customerMobile: mobile,
                    customerEmail: (customerProfile && customerProfile.email) || "",
                    area: area,
                    address: address,
                    customerLat: custLat,
                    customerLng: custLng,
                    hasExactGps: !!(currentCustomerLocation && currentCustomerLocation.lat),
                    customerMapsUrl: `https://www.google.com/maps?q=${custLat},${custLng}`,
                    budget: "₹५० ॲडव्हान्स जमा + कामाचा अंदाज",
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isEmergency: true,
                    orderType: "emergency_sos",
                    priority: "SOS_CRITICAL",
                    advancePaidToAdmin: 50,
                    emergencyBonusToWorker: 30,
                    bonusCredited: false,
                    paymentId: paymentId,
                    paymentStatus: "Captured",
                    status: "Pending",
                    completionOtp: String(Math.floor(1000 + Math.random() * 9000)),
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };

                await newOrderRef.set(payload);

                closeEmergencySosModal();
                alert("🎉 ₹५० ॲडव्हान्स यशस्वीरित्या जमा झाला!\n\n🚨 १०-मिनिट इमर्जन्सी सायरन वाजवला गेला आहे! पुण्यातील जवळच्या उपलब्ध कारागिराला तातडीने पाठवले जात आहे.");
                
                trackLiveStatus(currentOrderId);

                const apkLiveCard = document.getElementById('apkCustomerLiveStatusCard');
                if (apkLiveCard) {
                    apkLiveCard.classList.remove('hidden');
                    apkLiveCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch(saveErr) {
                console.error('[SOS Save Error]', saveErr);
                alert("ऑर्डर सेव्ह करताना अडचण आली: " + saveErr.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> <span>₹५० भरा आणि १०-मिनिट सायरन वाजवा</span>';
                }
            }
        },
        modal: {
            ondismiss: function () {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> <span>₹५० भरा आणि १०-मिनिट सायरन वाजवा</span>';
                }
            }
        }
    };

    try {
        if (typeof Razorpay !== 'undefined') {
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (failResp) {
                console.error('[Emergency SOS Payment Failed]', failResp);
                alert("पेमेंट अयशस्वी झाले: " + (failResp.error ? failResp.error.description : 'कृपया पुन्हा प्रयत्न करा'));
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> <span>₹५० भरा आणि १०-मिनिट सायरन वाजवा</span>';
                }
            });
            rzp.open();
        } else {
            const proceed = confirm("Razorpay थेट पेमेंट: ₹५० ॲडव्हान्स घरमित्र खात्यात जमा करून १०-मिनिट सायरन सुरू करायचा का?");
            if (proceed) {
                await options.handler({ razorpay_payment_id: 'PAY_SOS_TEST_' + Date.now() });
            } else {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> <span>₹५० भरा आणि १०-मिनिट सायरन वाजवा</span>';
                }
            }
        }
    } catch(err) {
        console.error('[SOS Checkout Error]', err);
        alert("पेमेंट सुरू करताना अडचण आली: " + err.message);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> <span>₹५० भरा आणि १०-मिनिट सायरन वाजवा</span>';
        }
    }
}
window.handleEmergencySosSubmit = handleEmergencySosSubmit;

// ==========================================
// 🚨 BOOKING TYPE TOGGLES & HELPERS (Normal vs Emergency)
// ==========================================

function toggleBookingType(type) {
    const isEmergency = (type === 'emergency');
    const normalLabel = document.getElementById('normalBookingLabel');
    const emergencyLabel = document.getElementById('emergencyBookingLabel');
    const notice = document.getElementById('emergencyBookingNotice');
    const submitBtn = document.getElementById('submitBtn');

    if (normalLabel && emergencyLabel) {
        if (isEmergency) {
            normalLabel.className = 'cursor-pointer border-2 border-slate-200 bg-white hover:border-blue-400 p-3.5 rounded-2xl flex items-start gap-3 transition shadow-xs';
            emergencyLabel.className = 'cursor-pointer border-2 border-red-600 bg-red-50/60 p-3.5 rounded-2xl flex items-start gap-3 transition shadow-xs';
        } else {
            normalLabel.className = 'cursor-pointer border-2 border-blue-600 bg-blue-50/50 p-3.5 rounded-2xl flex items-start gap-3 transition shadow-xs';
            emergencyLabel.className = 'cursor-pointer border-2 border-slate-200 bg-white hover:border-red-400 p-3.5 rounded-2xl flex items-start gap-3 transition shadow-xs';
        }
    }
    if (notice) {
        if (isEmergency) notice.classList.remove('hidden');
        else notice.classList.add('hidden');
    }
    if (submitBtn) {
        if (isEmergency) {
            submitBtn.className = 'w-full bg-red-600 hover:bg-red-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-red-500/25 transition text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer';
            submitBtn.innerHTML = '<i class="fa-solid fa-bolt text-yellow-300"></i> <span>₹५० भरा आणि १०-मिनिट इमर्जन्सी बुक करा</span>';
        } else {
            submitBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2 mt-4 cursor-pointer';
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Book Appointment Now</span>';
        }
    }

    // Sync with APK inputs
    const apkNormalRadio = document.querySelector('input[name="apkBookingType"][value="normal"]');
    const apkEmergencyRadio = document.querySelector('input[name="apkBookingType"][value="emergency"]');
    if (apkNormalRadio && apkEmergencyRadio) {
        if (isEmergency) apkEmergencyRadio.checked = true;
        else apkNormalRadio.checked = true;
        syncApkBookingTypeUI(isEmergency);
    }
}
window.toggleBookingType = toggleBookingType;

function toggleApkBookingType(type) {
    const isEmergency = (type === 'emergency');
    const apkNormalRadio = document.querySelector('input[name="apkBookingType"][value="normal"]');
    const apkEmergencyRadio = document.querySelector('input[name="apkBookingType"][value="emergency"]');
    if (apkNormalRadio && apkEmergencyRadio) {
        if (isEmergency) apkEmergencyRadio.checked = true;
        else apkNormalRadio.checked = true;
    }
    syncApkBookingTypeUI(isEmergency);

    // Sync with Website inputs
    const webNormalRadio = document.querySelector('input[name="bookingType"][value="normal"]');
    const webEmergencyRadio = document.querySelector('input[name="bookingType"][value="emergency"]');
    if (webNormalRadio && webEmergencyRadio) {
        if (isEmergency) webEmergencyRadio.checked = true;
        else webNormalRadio.checked = true;
        toggleBookingType(isEmergency ? 'emergency' : 'normal');
    }
}
window.toggleApkBookingType = toggleApkBookingType;

function syncApkBookingTypeUI(isEmergency) {
    const apkNormalLabel = document.getElementById('apkNormalBookingLabel');
    const apkEmergencyLabel = document.getElementById('apkEmergencyBookingLabel');
    const apkNotice = document.getElementById('apkEmergencyBookingNotice');
    const apkSubmitBtn = document.getElementById('apkSubmitBtn');

    if (apkNormalLabel && apkEmergencyLabel) {
        if (isEmergency) {
            apkNormalLabel.className = 'cursor-pointer border-2 border-slate-200 bg-white hover:border-blue-400 p-3 rounded-xl flex items-start gap-2.5 transition shadow-xs';
            apkEmergencyLabel.className = 'cursor-pointer border-2 border-red-600 bg-red-50/60 p-3 rounded-xl flex items-start gap-2.5 transition shadow-xs';
        } else {
            apkNormalLabel.className = 'cursor-pointer border-2 border-blue-600 bg-blue-50/50 p-3 rounded-xl flex items-start gap-2.5 transition shadow-xs';
            apkEmergencyLabel.className = 'cursor-pointer border-2 border-slate-200 bg-white hover:border-red-400 p-3 rounded-xl flex items-start gap-2.5 transition shadow-xs';
        }
    }
    if (apkNotice) {
        if (isEmergency) apkNotice.classList.remove('hidden');
        else apkNotice.classList.add('hidden');
    }
    if (apkSubmitBtn) {
        if (isEmergency) {
            apkSubmitBtn.className = 'w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-black text-base py-3.5 px-6 rounded-2xl shadow-lg shadow-red-500/25 transition flex items-center justify-center gap-2 cursor-pointer mt-5';
            apkSubmitBtn.innerHTML = '<i class="fa-solid fa-bolt text-yellow-300"></i> <span>₹५० भरा आणि १०-मिनिट इमर्जन्सी बुक करा</span>';
        } else {
            apkSubmitBtn.className = 'w-full bg-[#1868fe] hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-base py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer mt-5';
            apkSubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Book Appointment Now</span>';
        }
    }
}
window.syncApkBookingTypeUI = syncApkBookingTypeUI;

// Keep safe stubs for backward-compatibility
window.openEmergencySosModal = function() {
    toggleBookingType('emergency');
    const f = document.getElementById('bookingForm') || document.getElementById('apkBookingForm');
    if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
window.closeEmergencySosModal = function() {};
window.detectSosGpsLocation = function() { if (typeof detectCustomerExactLocation === 'function') detectCustomerExactLocation(); };
window.handleEmergencySosSubmit = function(e) { if (e) e.preventDefault(); handleFormSubmit(e); };
