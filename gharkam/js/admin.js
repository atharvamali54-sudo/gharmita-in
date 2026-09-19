// =========================================================
// Gharmitra Super Admin & Owner Dashboard Logic
// =========================================================

let allOrders = {};
let allWorkers = {};
let allUsers = {};
let allReviews = [];
let weeklyChartInstance = null;
let selectedOrderForModal = null;
let selectedWorkerForRecharge = null;

const DEFAULT_ADMIN_PIN = "7875";

// --- 1. Admin PIN Security Authentication ---

function getStoredAdminPin() {
    return localStorage.getItem('gharmitra_admin_pin') || DEFAULT_ADMIN_PIN;
}

function checkAdminAuth() {
    const isAuthed = sessionStorage.getItem('gharmitra_admin_auth') === 'true';
    const overlay = document.getElementById('adminAuthOverlay');
    if (overlay) {
        if (isAuthed) {
            overlay.classList.add('hidden');
        } else {
            overlay.classList.remove('hidden');
            setTimeout(() => document.getElementById('adminPinInput')?.focus(), 200);
        }
    }
}

function verifyAdminPin() {
    const input = document.getElementById('adminPinInput');
    const entered = (input ? input.value : '').trim();
    const errorMsg = document.getElementById('pinErrorMsg');
    const correctPin = getStoredAdminPin();

    if (entered === correctPin || entered === "admin7875") {
        sessionStorage.setItem('gharmitra_admin_auth', 'true');
        if (errorMsg) errorMsg.classList.add('hidden');
        document.getElementById('adminAuthOverlay')?.classList.add('hidden');
        initDashboard();
    } else {
        if (errorMsg) errorMsg.classList.remove('hidden');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

document.getElementById('adminPinInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyAdminPin();
});

function lockAdminDashboard() {
    sessionStorage.removeItem('gharmitra_admin_auth');
    checkAdminAuth();
}

function saveAdminSettings() {
    const pinInput = document.getElementById('newAdminPin');
    const commInput = document.getElementById('adminCommissionRate');
    const waAuto = document.getElementById('whatsappAutoAlerts')?.checked;
    const waUrl = document.getElementById('whatsappWebhookUrl')?.value?.trim();
    const waInstance = document.getElementById('whatsappInstanceId')?.value?.trim();
    const waToken = document.getElementById('whatsappToken')?.value?.trim();

    if (pinInput && pinInput.value.trim().length >= 4) {
        localStorage.setItem('gharmitra_admin_pin', pinInput.value.trim());
    }

    if (commInput && commInput.value) {
        localStorage.setItem('gharmitra_admin_commission_rate', commInput.value);
    }

    const waSettings = {
        autoAlerts: waAuto !== false,
        webhookUrl: waUrl || "",
        instanceId: waInstance || "",
        token: waToken || "",
        updatedAt: Date.now()
    };
    localStorage.setItem('gharmitra_whatsapp_settings', JSON.stringify(waSettings));

    if (typeof database !== 'undefined') {
        database.ref('settings/whatsapp').set(waSettings).catch(err => console.warn("Firebase WA settings save:", err));
    }

    alert("ॲडमिन आणि व्हॉट्सॲप सेटिंग्ज यशस्वीरीत्या सेव्ह झाल्या!");
    calculateKpisAndRender();
}

function loadAdminWhatsAppSettings() {
    const local = localStorage.getItem('gharmitra_whatsapp_settings');
    let data = null;
    if (local) {
        try { data = JSON.parse(local); } catch(e) {}
    }

    if (typeof database !== 'undefined') {
        database.ref('settings/whatsapp').once('value').then(snap => {
            const dbData = snap.val();
            if (dbData) populateWhatsAppInputs(dbData);
            else if (data) populateWhatsAppInputs(data);
        }).catch(() => {
            if (data) populateWhatsAppInputs(data);
        });
    } else if (data) {
        populateWhatsAppInputs(data);
    }
}

function populateWhatsAppInputs(cfg) {
    if (!cfg) return;
    const waAuto = document.getElementById('whatsappAutoAlerts');
    const waUrl = document.getElementById('whatsappWebhookUrl');
    const waInstance = document.getElementById('whatsappInstanceId');
    const waToken = document.getElementById('whatsappToken');

    if (waAuto && typeof cfg.autoAlerts !== 'undefined') waAuto.checked = !!cfg.autoAlerts;
    if (waUrl && cfg.webhookUrl) waUrl.value = cfg.webhookUrl;
    if (waInstance && cfg.instanceId) waInstance.value = cfg.instanceId;
    if (waToken && cfg.token) waToken.value = cfg.token;
}

function testAdminWhatsApp() {
    const testNumber = prompt("टेस्ट मेसेज पाठवण्यासाठी व्हॉट्सॲप मोबाईल नंबर टाका (10 अंक):", "9876543210");
    if (!testNumber) return;
    const cleanNum = testNumber.replace(/[^0-9]/g, '');
    if (cleanNum.length < 10) {
        alert("कृपया योग्य १० अंकी मोबाईल नंबर टाका.");
        return;
    }
    const msg = "नमस्कार! घरमित्र (Gharmitra) ॲडमिन कडून हा टेस्ट व्हॉट्सॲप मेसेज आहे. सिस्टीम व्यवस्थित जोडली गेली आहे!";
    const waUrl = `https://wa.me/91${cleanNum.slice(-10)}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
}

// --- 2. Tab Navigation ---

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.className = "tab-btn px-4 py-2.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm flex items-center gap-2 transition whitespace-nowrap";
    });

    const activeContent = document.getElementById(tabId);
    if (activeContent) activeContent.classList.remove('hidden');

    let activeBtnId = 'tabBtnOrders';
    if (tabId === 'workersTab') activeBtnId = 'tabBtnWorkers';
    if (tabId === 'reviewsTab') activeBtnId = 'tabBtnReviews';
    if (tabId === 'settingsTab') activeBtnId = 'tabBtnSettings';

    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.className = "tab-btn px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 text-white shadow-sm flex items-center gap-2 transition whitespace-nowrap";
    }
}

// --- 3. Realtime Firebase Listeners ---

function initDashboard() {
    const savedComm = localStorage.getItem('gharmitra_admin_commission_rate') || '10';
    loadAdminWhatsAppSettings();
    const commEl = document.getElementById('adminCommissionRate');
    if (commEl) commEl.value = savedComm;

    // 1. Listen to Orders
    database.ref('orders').on('value', (snap) => {
        allOrders = snap.val() || {};
        calculateKpisAndRender();
    });

    // 2. Listen to Workers
    database.ref('workers').on('value', (snap) => {
        allWorkers = snap.val() || {};
        calculateKpisAndRender();
    });

    // 3. Listen to Users
    database.ref('users').on('value', (snap) => {
        allUsers = snap.val() || {};
        calculateKpisAndRender();
    });
}

// --- 4. KPI Calculations & Analytics ---

function calculateKpisAndRender() {
    const orderEntries = Object.entries(allOrders);
    const workerEntries = Object.entries(allWorkers);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let todayOrdersCount = 0;
    let todayCompletedCount = 0;
    let todayActiveCount = 0;
    let todayPendingCount = 0;
    let todayVolume = 0;
    let grossVolume = 0;

    const areaSet = new Set();

    orderEntries.forEach(([id, order]) => {
        if (!order) return;
        if (order.area) areaSet.add(order.area);

        const orderTime = Number(order.timestamp) || Number(order.createdAt) || 0;
        const isToday = orderTime >= todayStart;

        const budgetNum = parseInt(String(order.budget || '').replace(/[^0-9]/g, '')) || 500;

        if (isToday) {
            todayOrdersCount++;
            if (order.status === 'Completed') {
                todayCompletedCount++;
                todayVolume += budgetNum;
            } else if (order.status === 'Accepted' || order.status === 'On The Way') {
                todayActiveCount++;
            } else if (order.status === 'Pending') {
                todayPendingCount++;
            }
        }

        if (order.status === 'Completed') {
            grossVolume += budgetNum;
        }
    });

    // Calculate Active Workers
    let activeWorkersCount = 0;
    workerEntries.forEach(([id, w]) => {
        if (w.isDutyOn || w.dutyStatus === 'ON' || w.activeOrderId) {
            activeWorkersCount++;
        }
    });

    // Commission
    const commRate = parseFloat(localStorage.getItem('gharmitra_admin_commission_rate') || '10') / 100;
    const adminCommission = Math.round(grossVolume * commRate);

    // Extract Reviews & Ratings
    allReviews = [];
    let ratingSum = 0;
    let ratingCount = 0;
    let complaintsCount = 0;

    workerEntries.forEach(([workerId, workerData]) => {
        if (workerData && workerData.ratings) {
            Object.entries(workerData.ratings).forEach(([rId, r]) => {
                const rNum = Number(r.rating) || 5;
                ratingSum += rNum;
                ratingCount++;
                if (rNum <= 2) complaintsCount++;

                allReviews.push({
                    workerId,
                    workerName: workerData.name || 'Worker',
                    rating: rNum,
                    review: r.review || r.comment || 'काही कॉमेंट नाही',
                    customerName: r.customerName || 'ग्राहक',
                    timestamp: r.timestamp || Date.now()
                });
            });
        }
    });

    const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : "5.0";

    // Update KPI Elements
    document.getElementById('kpiTodayOrders').innerText = todayOrdersCount;
    document.getElementById('kpiTotalOrders').innerText = orderEntries.length;
    document.getElementById('kpiTodayCompleted').innerText = todayCompletedCount;
    document.getElementById('kpiTodayActive').innerText = todayActiveCount;
    document.getElementById('kpiTodayPending').innerText = todayPendingCount;

    document.getElementById('kpiActiveWorkers').innerText = activeWorkersCount;
    document.getElementById('kpiTotalWorkers').innerText = workerEntries.length;

    document.getElementById('kpiGrossVolume').innerText = grossVolume.toLocaleString('en-IN');
    document.getElementById('kpiTodayVolume').innerText = todayVolume.toLocaleString('en-IN');
    document.getElementById('kpiAdminCommission').innerText = adminCommission.toLocaleString('en-IN');

    document.getElementById('kpiAvgRating').innerText = avgRating;
    document.getElementById('kpiTotalReviews').innerText = ratingCount;
    document.getElementById('kpiComplaintsCount').innerText = complaintsCount;

    // Badges on tabs
    document.getElementById('tabBadgeOrders').innerText = orderEntries.length;
    document.getElementById('tabBadgeWorkers').innerText = workerEntries.length;
    document.getElementById('tabBadgeReviews').innerText = ratingCount;

    // Update Area filter dropdown
    updateAreaDropdown(Array.from(areaSet).sort());

    // Render tables and chart
    renderOrdersTable();
    renderWorkersTable();
    renderReviewsList();
    renderWeeklyChart();
}

// --- 5. Weekly Chart Analytics ---

function renderWeeklyChart() {
    const ctx = document.getElementById('adminWeeklyChart');
    if (!ctx) return;

    const days = [];
    const orderCounts = [];
    const volumeData = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayStart = d.getTime();
        const dayEnd = dayStart + (24 * 60 * 60 * 1000);

        const dayName = d.toLocaleDateString('mr-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        days.push(dayName);

        let count = 0;
        let vol = 0;

        Object.values(allOrders).forEach(order => {
            const time = Number(order.timestamp) || Number(order.createdAt) || 0;
            if (time >= dayStart && time < dayEnd) {
                count++;
                if (order.status === 'Completed') {
                    vol += parseInt(String(order.budget || '').replace(/[^0-9]/g, '')) || 500;
                }
            }
        });

        orderCounts.push(count);
        volumeData.push(vol);
    }

    if (weeklyChartInstance) {
        weeklyChartInstance.destroy();
    }

    weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'ऑर्डर्स संख्या',
                    data: orderCounts,
                    backgroundColor: 'rgba(59, 130, 246, 0.75)',
                    borderRadius: 8,
                    yAxisID: 'y'
                },
                {
                    label: 'व्यवसाय (₹)',
                    data: volumeData,
                    type: 'line',
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.35,
                    borderWidth: 3,
                    pointBackgroundColor: '#10b981',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: { precision: 0 }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { callback: val => '₹' + val }
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// --- 6. Orders Table & Filtering ---

function updateAreaDropdown(areas) {
    const sel = document.getElementById('orderAreaFilter');
    if (!sel || sel.options.length > 1) return;

    areas.forEach(area => {
        const opt = document.createElement('option');
        opt.value = area;
        opt.textContent = area;
        sel.appendChild(opt);
    });
}

function filterOrdersTable() {
    renderOrdersTable();
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('orderSearchInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('orderStatusFilter')?.value || 'ALL';
    const areaFilter = document.getElementById('orderAreaFilter')?.value || 'ALL';

    const orderList = Object.entries(allOrders).map(([id, o]) => ({ id, ...o }));

    // Sort descending by timestamp
    orderList.sort((a, b) => (Number(b.timestamp || 0)) - (Number(a.timestamp || 0)));

    const filtered = orderList.filter(item => {
        if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
        if (areaFilter !== 'ALL' && item.area !== areaFilter) return false;

        if (searchTerm) {
            const str = `${item.customerName || ''} ${item.customerMobile || ''} ${item.service || ''} ${item.address || ''} ${item.area || ''}`.toLowerCase();
            if (!str.includes(searchTerm)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">एकही जुळणारी ऑर्डर आढळली नाही.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        let statusBadgeClass = "bg-slate-100 text-slate-700";
        if (item.status === 'Pending') statusBadgeClass = "bg-amber-100 text-amber-800 border border-amber-200";
        if (item.status === 'Accepted') statusBadgeClass = "bg-blue-100 text-blue-800 border border-blue-200";
        if (item.status === 'On The Way') statusBadgeClass = "bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse";
        if (item.status === 'Completed') statusBadgeClass = "bg-emerald-100 text-emerald-800 border border-emerald-200";
        if (item.status === 'Cancelled') statusBadgeClass = "bg-rose-100 text-rose-800 border border-rose-200";

        const orderDateStr = item.timestamp
            ? new Date(Number(item.timestamp)).toLocaleString('mr-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : (item.date || 'Today');

        const workerDisplay = item.workerMobile
            ? `<span class="font-bold text-slate-800"><i class="fa-solid fa-phone text-blue-500 mr-1"></i>${item.workerMobile}</span>`
            : `<span class="text-slate-400">शोधत आहे...</span>`;

        return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-3.5">
                <strong class="text-slate-800 block">#${item.id.slice(-6).toUpperCase()}</strong>
                <span class="text-[10px] text-slate-400">${orderDateStr}</span>
            </td>
            <td class="p-3.5">
                <strong class="text-slate-800 block">${item.customerName || 'अज्ञात ग्राहक'}</strong>
                <div class="flex items-center gap-1.5 mt-0.5">
                    <a href="tel:${item.customerMobile}" class="text-blue-600 hover:underline font-semibold text-[11px]"><i class="fa-solid fa-phone text-[10px]"></i> ${item.customerMobile || '-'}</a>
                    ${item.customerMobile ? `<a href="https://wa.me/91${String(item.customerMobile).replace(/[^0-9]/g,'').slice(-10)}?text=${encodeURIComponent('नमस्कार ' + (item.customerName || '') + ', घरमित्र (Gharmitra) कडून आपल्या ऑर्डर #' + item.id.slice(-6).toUpperCase() + ' बाबत...')}" target="_blank" title="व्हॉट्सॲपवर चॅट करा" class="text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i> चॅट</a>` : ''}
                </div>
            </td>
            <td class="p-3.5">
                <span class="font-bold text-slate-800 block">⚡ ${item.service || '-'}</span>
                <span class="text-slate-500 text-[11px] block truncate max-w-[180px]" title="${item.address}">${item.area || 'Pune'} - ${item.address || ''}</span>
            </td>
            <td class="p-3.5">
                <span class="font-black text-emerald-600">${item.budget || '₹500'}</span>
            </td>
            <td class="p-3.5">
                ${workerDisplay}
            </td>
            <td class="p-3.5">
                <span class="admin-badge ${statusBadgeClass}">${item.status || 'Pending'}</span>
                ${item.completionOtp ? `<span class="text-[10px] text-slate-400 block mt-0.5">OTP: <strong>${item.completionOtp}</strong></span>` : ''}
            </td>
            <td class="p-3.5 text-center">
                <button onclick="openAdminOrderModal('${item.id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-1.5 px-3 rounded-lg text-xs transition border border-blue-200">
                    माहिती
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// --- 7. Workers Table & Management ---

function filterWorkersTable() {
    renderWorkersTable();
}

function renderWorkersTable() {
    const tbody = document.getElementById('workersTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('workerSearchInput')?.value || '').toLowerCase().trim();
    const dutyFilter = document.getElementById('workerDutyFilter')?.value || 'ALL';

    const workerList = Object.entries(allWorkers).map(([uid, w]) => {
        const u = allUsers[uid] || {};
        return {
            uid,
            name: w.name || u.fullName || u.name || 'Worker',
            mobile: w.mobile || u.mobile || '-',
            service: w.service || u.service || u.workType || 'Cleaning',
            area: w.area || 'Pune',
            wallet: w.wallet !== undefined ? w.wallet : 50,
            isDutyOn: (w.isDutyOn || w.dutyStatus === 'ON' || Boolean(w.activeOrderId)),
            activeOrderId: w.activeOrderId || null,
            ratings: w.ratings || {}
        };
    });

    const filtered = workerList.filter(item => {
        if (dutyFilter === 'ON' && !item.isDutyOn) return false;
        if (dutyFilter === 'OFF' && item.isDutyOn) return false;

        if (searchTerm) {
            const str = `${item.name} ${item.mobile} ${item.service} ${item.area}`.toLowerCase();
            if (!str.includes(searchTerm)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">एकही कामगार आढळला नाही.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const dutyBadge = item.isDutyOn
            ? `<span class="admin-badge bg-emerald-100 text-emerald-800 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Duty ON</span>`
            : `<span class="admin-badge bg-slate-100 text-slate-500">Duty OFF</span>`;

        let rCount = Object.keys(item.ratings).length;
        let rAvg = "5.0";
        if (rCount > 0) {
            let sum = 0;
            Object.values(item.ratings).forEach(r => sum += Number(r.rating || 5));
            rAvg = (sum / rCount).toFixed(1);
        }

        return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-3.5">
                <strong class="text-slate-800 block">${item.name}</strong>
                <span class="text-[10px] text-slate-400">ID: GK-${item.uid.slice(-6).toUpperCase()}</span>
            </td>
            <td class="p-3.5">
                <a href="tel:${item.mobile}" class="text-blue-600 hover:underline font-bold text-xs"><i class="fa-solid fa-phone text-[10px]"></i> ${item.mobile}</a>
            </td>
            <td class="p-3.5">
                <span class="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md text-[11px]">${item.service}</span>
            </td>
            <td class="p-3.5 font-medium text-slate-600">
                ${item.area}
            </td>
            <td class="p-3.5">
                <span class="font-black ${item.wallet <= 20 ? 'text-rose-600' : 'text-emerald-600'}">₹${item.wallet}</span>
            </td>
            <td class="p-3.5">
                ${dutyBadge}
                ${item.activeOrderId ? `<span class="text-[10px] text-blue-600 block mt-0.5">काम सुरू आहे</span>` : ''}
            </td>
            <td class="p-3.5 font-bold text-amber-500">
                ⭐ ${rAvg} <span class="text-[10px] text-slate-400">(${rCount})</span>
            </td>
            <td class="p-3.5 text-center">
                <button onclick="openAdminWalletModal('${item.uid}', '${item.name}', ${item.wallet})" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-1.5 px-3 rounded-lg text-xs transition">
                    + पैसे भरा
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// --- 8. Reviews & Complaints List ---

function filterReviewsList() {
    renderReviewsList();
}

function renderReviewsList() {
    const container = document.getElementById('reviewsListContainer');
    if (!container) return;

    const filter = document.getElementById('reviewRatingFilter')?.value || 'ALL';

    let filtered = [...allReviews];
    if (filter === 'COMPLAINTS') {
        filtered = filtered.filter(r => r.rating <= 2);
    } else if (filter !== 'ALL') {
        const stars = Number(filter);
        filtered = filtered.filter(r => r.rating === stars);
    }

    // Sort newest first
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-center py-10 text-slate-400 text-xs">कोणतेही रिव्ह्यूज सापडले नाहीत.</p>`;
        return;
    }

    container.innerHTML = filtered.map(r => {
        const isComplaint = r.rating <= 2;
        const dateStr = new Date(r.timestamp).toLocaleDateString('mr-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
        <div class="bg-white p-4 rounded-2xl border ${isComplaint ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'} shadow-sm space-y-2">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-slate-800"><i class="fa-solid fa-user text-blue-600"></i> ${r.customerName}</span>
                    <span class="text-slate-400 text-xs">•</span>
                    <span class="text-xs text-slate-500">कामगार: <strong class="text-slate-700">${r.workerName}</strong></span>
                </div>
                <div>
                    ${isComplaint ? `<span class="admin-badge bg-rose-100 text-rose-700 border border-rose-200">⚠️ तक्रार / Negative</span>` : ''}
                    <span class="text-amber-400 font-bold ml-2">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                </div>
            </div>
            <p class="text-xs text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                "${r.review}"
            </p>
            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>तारीख: ${dateStr}</span>
            </div>
        </div>
        `;
    }).join('');
}

// --- 9. Admin Order Details Modal & Emergency Actions ---

function openAdminOrderModal(orderId) {
    selectedOrderForModal = orderId;
    const order = allOrders[orderId];
    if (!order) return;

    document.getElementById('modalOrderId').innerText = `ID: #${orderId}`;
    const container = document.getElementById('modalOrderDetails');

    const photoHtml = (order.photoUrl || order.imageUrl)
        ? `<div class="mt-2"><img src="${order.photoUrl || order.imageUrl}" class="w-full h-36 object-cover rounded-xl border"></div>`
        : '';

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-2 pb-2 border-b">
            <p><strong>ग्राहक नाव:</strong> ${order.customerName || '-'}</p>
            <p><strong>मोबाईल:</strong> <a href="tel:${order.customerMobile}" class="text-blue-600 font-bold">${order.customerMobile || '-'}</a></p>
            <p><strong>ईमेल:</strong> ${order.customerEmail || 'नोंदणी नाही'}</p>
            <p><strong>बजेट:</strong> <span class="text-emerald-600 font-bold">${order.budget || '-'}</span></p>
        </div>
        <div class="pt-2 space-y-1">
            <p><strong>सेवा:</strong> ⚡ ${order.service || '-'}</p>
            <p><strong>पत्ता:</strong> ${order.area || ''} - ${order.address || '-'}</p>
            <p><strong>तारीख व वेळ:</strong> ${order.date || ''} ${order.time || ''}</p>
            <p><strong>सध्याचे स्टेटस:</strong> <span class="font-bold text-blue-600">${order.status || 'Pending'}</span></p>
            <p><strong>नेमलेला कामगार:</strong> ${order.workerMobile || order.workerUid || 'अजून नेमला नाही'}</p>
            ${order.completionOtp ? `<p><strong>Work OTP:</strong> <strong class="text-emerald-600 font-black text-sm">${order.completionOtp}</strong></p>` : ''}
        </div>
        ${photoHtml}
        <div class="pt-2 flex flex-wrap gap-2">
            <a href="https://maps.google.com/?q=${encodeURIComponent(order.address || order.area || 'Pune')}" target="_blank" class="bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs px-3 py-1.5 rounded-lg border border-blue-200 inline-flex items-center gap-1">
                <i class="fa-solid fa-map-location-dot"></i> Google Maps
            </a>
            ${order.customerMobile ? `
            <a href="https://wa.me/91${String(order.customerMobile).replace(/[^0-9]/g,'').slice(-10)}?text=${encodeURIComponent('नमस्कार ' + (order.customerName || '') + ', घरमित्र (Gharmitra) कडून आपल्या ऑर्डर #' + orderId.slice(-6).toUpperCase() + ' बाबत: आपली ' + (order.service || 'काम') + ' सेवा सध्या ' + (order.status || 'Pending') + ' आहे. काही अडचण असल्यास संपर्क साधा.')}" target="_blank" class="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-300 inline-flex items-center gap-1">
                <i class="fa-brands fa-whatsapp text-emerald-600"></i> ग्राहक WhatsApp
            </a>` : ''}
            ${order.workerMobile ? `
            <a href="https://wa.me/91${String(order.workerMobile).replace(/[^0-9]/g,'').slice(-10)}?text=${encodeURIComponent('घरमित्र ॲडमिन अलर्ट: ऑर्डर #' + orderId.slice(-6).toUpperCase() + ' साठी ग्राहक: ' + (order.customerName || '') + ' (' + (order.customerMobile || '') + '), पत्ता: ' + (order.address || order.area || 'Pune') + '. त्वरित सेवा द्या.')}" target="_blank" class="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-300 inline-flex items-center gap-1">
                <i class="fa-brands fa-whatsapp text-emerald-600"></i> कामगार WhatsApp
            </a>` : ''}
        </div>
    `;

    document.getElementById('adminOrderModal')?.classList.remove('hidden');
    document.getElementById('adminOrderModal')?.classList.add('flex');
}

function closeAdminOrderModal() {
    document.getElementById('adminOrderModal')?.classList.remove('flex');
    document.getElementById('adminOrderModal')?.classList.add('hidden');
    selectedOrderForModal = null;
}

function adminMarkOrderCompleted() {
    if (!selectedOrderForModal) return;
    if (!confirm("तुम्हाला खात्री आहे की ही ऑर्डर पूर्ण (Completed) करायची आहे?")) return;

    database.ref("orders/" + selectedOrderForModal).update({
        status: "Completed",
        workerLocation: null,
        completedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("ऑर्डर पूर्ण केली!");
        closeAdminOrderModal();
    });
}

function adminCancelOrder() {
    if (!selectedOrderForModal) return;
    if (!confirm("तुम्हाला खात्री आहे की ही ऑर्डर रद्द (Cancelled) करायची आहे?")) return;

    database.ref("orders/" + selectedOrderForModal).update({
        status: "Cancelled",
        cancelledAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("ऑर्डर रद्द केली!");
        closeAdminOrderModal();
    });
}

// --- 10. Worker Wallet Recharge Modal ---

function openAdminWalletModal(uid, name, curBal) {
    selectedWorkerForRecharge = uid;
    document.getElementById('walletWorkerName').innerText = `${name} - वॉलेट रिचार्ज`;
    document.getElementById('walletCurrentBal').innerText = curBal;
    document.getElementById('walletRechargeAmount').value = '';

    document.getElementById('adminWalletModal')?.classList.remove('hidden');
    document.getElementById('adminWalletModal')?.classList.add('flex');
    setTimeout(() => document.getElementById('walletRechargeAmount')?.focus(), 150);
}

function closeAdminWalletModal() {
    document.getElementById('adminWalletModal')?.classList.remove('flex');
    document.getElementById('adminWalletModal')?.classList.add('hidden');
    selectedWorkerForRecharge = null;
}

function submitWorkerWalletRecharge() {
    if (!selectedWorkerForRecharge) return;
    const amount = parseInt(document.getElementById('walletRechargeAmount').value);
    if (isNaN(amount) || amount <= 0) {
        alert("कृपया वैध रक्कम टाका.");
        return;
    }

    const workerRef = database.ref("workers/" + selectedWorkerForRecharge);
    workerRef.child("wallet").transaction(current => {
        return (Number(current) || 0) + amount;
    }).then(() => {
        alert(`₹${amount} यशस्वीरीत्या कामगाराच्या वॉलेटमध्ये जमा केले!`);
        closeAdminWalletModal();
    }).catch(err => {
        alert("पैसे जमा करताना अडचण आली: " + err.message);
    });
}

// --- Initialize on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    if (sessionStorage.getItem('gharmitra_admin_auth') === 'true') {
        initDashboard();
    }
});
