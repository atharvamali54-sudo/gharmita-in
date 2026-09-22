/**
 * Gharmitra - Cloud Telephony Backend (Number Masking)
 * Compatible with Firebase Cloud Functions / Express / Node.js
 * 
 * Supports:
 * 1. Exotel Click-to-Call (Used by Swiggy, Zomato, Ola in India)
 * 2. Twilio Programmable Voice & Proxy
 * 3. Inbound Dynamic Relay Webhook
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');
const querystring = require('querystring');

if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * EXOTEL CONFIGURATION (Enter your details when you buy Exotel plan)
 */
const EXOTEL_CONFIG = {
    accountSid: process.env.EXOTEL_SID || "YOUR_EXOTEL_ACCOUNT_SID",
    apiKey: process.env.EXOTEL_API_KEY || "YOUR_EXOTEL_API_KEY",
    apiToken: process.env.EXOTEL_API_TOKEN || "YOUR_EXOTEL_API_TOKEN",
    virtualNumber: process.env.EXOTEL_VIRTUAL_NUMBER || "02071954421" // The Virtual Caller ID
};

/**
 * 1. EXOTEL CLICK-TO-CALL (BRIDGE CALL)
 * This function initiates a call between Customer and Worker.
 * Neither party sees the real phone number.
 * Both parties see the Exotel Virtual Number on their mobile screen.
 */
exports.initiateExotelMaskedCall = functions.https.onCall(async (data, context) => {
    const { orderId, initiatorRole } = data; // initiatorRole: 'customer' or 'worker'

    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'OrderId is required.');
    }

    // 1. Fetch real phone numbers securely from Firebase Database (never exposed to client)
    const orderSnapshot = await admin.database().ref(`orders/${orderId}`).once('value');
    const order = orderSnapshot.val();

    if (!order) {
        throw new functions.https.HttpsError('not-found', 'Order not found.');
    }

    if (!['Accepted', 'On The Way'].includes(order.status)) {
        throw new functions.https.HttpsError('failed-precondition', 'Order must be Accepted or On The Way.');
    }

    const customerMobile = order.customerMobile;
    const workerMobile = order.workerMobile;

    if (!customerMobile || !workerMobile) {
        throw new functions.https.HttpsError('failed-precondition', 'Phone numbers missing in order.');
    }

    // Initiator gets called first, then other party is bridged
    const fromNumber = initiatorRole === 'customer' ? customerMobile : workerMobile;
    const toNumber = initiatorRole === 'customer' ? workerMobile : customerMobile;

    // 2. Prepare Exotel API Request
    const postData = querystring.stringify({
        From: fromNumber,
        To: toNumber,
        CallerId: EXOTEL_CONFIG.virtualNumber,
        CallType: 'trans' // Transactional call
    });

    const authHeader = 'Basic ' + Buffer.from(`${EXOTEL_CONFIG.apiKey}:${EXOTEL_CONFIG.apiToken}`).toString('base64');

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.exotel.com',
            port: 443,
            path: `/v1/Accounts/${EXOTEL_CONFIG.accountSid}/Calls/connect.json`,
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const responseJson = JSON.parse(body);
                    resolve({
                        success: true,
                        maskedCallerId: EXOTEL_CONFIG.virtualNumber,
                        callSid: responseJson?.Call?.Sid || null
                    });
                } catch (e) {
                    resolve({ success: true, raw: body, maskedCallerId: EXOTEL_CONFIG.virtualNumber });
                }
            });
        });

        req.on('error', (err) => {
            console.error('Exotel Call error:', err);
            reject(new functions.https.HttpsError('internal', 'Telephony provider connection failed.'));
        });

        req.write(postData);
        req.end();
    });
});

/**
 * 2. INBOUND CALL ROUTING WEBHOOK
 * When a user dials the single central virtual number directly from their phone,
 * Exotel/Twilio hits this webhook to determine who to connect to.
 */
exports.handleInboundCallWebhook = functions.https.onRequest(async (req, res) => {
    const callerNumber = (req.query.From || req.body.From || '').replace(/\D/g, '').slice(-10);

    if (!callerNumber) {
        return res.status(400).send("Caller ID missing");
    }

    // Check if caller is a customer with an active order
    const ordersSnap = await admin.database().ref('orders').once('value');
    const allOrders = ordersSnap.val() || {};

    let targetNumber = null;

    for (const [id, ord] of Object.entries(allOrders)) {
        if (['Accepted', 'On The Way'].includes(ord.status)) {
            const custMob = (ord.customerMobile || '').slice(-10);
            const workMob = (ord.workerMobile || '').slice(-10);

            if (callerNumber === custMob && workMob) {
                // Customer is calling -> route to worker
                targetNumber = ord.workerMobile;
                break;
            } else if (callerNumber === workMob && custMob) {
                // Worker is calling -> route to customer
                targetNumber = ord.customerMobile;
                break;
            }
        }
    }

    if (!targetNumber) {
        // No active order found
        return res.json({
            action: "say",
            text: "Gharmitra मध्ये आपले स्वागत आहे. सध्या आपल्या मोबाईल क्रमांकावर कोणतीही सक्रिय ऑर्डर सुरू नाही."
        });
    }

    // Forward the call while keeping CallerId masked
    return res.json({
        action: "dial",
        to: targetNumber,
        callerId: EXOTEL_CONFIG.virtualNumber
    });
});
