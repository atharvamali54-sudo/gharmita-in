const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.RAZORPAY_KEY_ID) {
    require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 5000;

// Security: Standard HTTP Hardening Headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Enable CORS and JSON parsing with request size limit
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' }));

// In-Memory Rate Limiter to prevent brute-force and DoS
const rateLimitMap = new Map();
function rateLimiter(maxRequests = 30, windowMs = 60 * 1000) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + windowMs;
        } else {
            record.count++;
        }
        rateLimitMap.set(ip, record);
        if (record.count > maxRequests) {
            return res.status(429).json({ error: 'Too many requests. Please slow down.' });
        }
        next();
    };
}

// Clean up stale rate-limit records every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
            rateLimitMap.delete(ip);
        }
    }
}, 10 * 60 * 1000);

// Initialize Razorpay SDK instance - strictly requiring env variables without hardcoded fallbacks
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
    console.warn('[SECURITY WARNING] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in backend/.env!');
}

const razorpay = (keyId && keySecret) ? new Razorpay({
    key_id: keyId,
    key_secret: keySecret
}) : null;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Gharmitra Razorpay Backend',
        key_configured: Boolean(keyId && keySecret)
    });
});

// Expose public key for frontend clients (NEVER secret)
app.get('/api/config', (req, res) => {
    res.json({
        key_id: keyId || ''
    });
});

/**
 * STEP 1: BACKEND - Create Order
 * Endpoint: POST /api/create-order
 * Request body: { amount: Number (in INR rupees or paise), receipt: String }
 */
app.post('/api/create-order', rateLimiter(20, 60 * 1000), async (req, res) => {
    try {
        if (!razorpay) {
            return res.status(503).json({ error: 'Payment gateway credentials are not configured on server' });
        }

        let { amount, receipt, notes } = req.body;

        if (typeof amount !== 'number' && typeof amount !== 'string') {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        let numericAmount = parseInt(amount, 10);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }

        // Convert to paise if passed as rupees (less than 100000 assume rupees)
        let amountInPaise = numericAmount;
        if (req.body.isRupees !== false && amountInPaise < 50000) {
            amountInPaise = amountInPaise * 100;
        }

        // Razorpay minimum amount is 100 paise (₹1)
        if (amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least ₹1 (100 paise)' });
        }

        // Razorpay maximum sanity check (max ₹50,000 per recharge)
        if (amountInPaise > 5000000) {
            return res.status(400).json({ error: 'Amount exceeds maximum permitted limit' });
        }

        // Sanitize receipt to alphanumeric
        const safeReceipt = String(receipt || `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 40);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: safeReceipt,
            notes: (typeof notes === 'object' && notes !== null) ? notes : { service: 'Gharmitra Partner Service Credits' }
        };

        const order = await razorpay.orders.create(options);

        res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (error) {
        console.error('[Razorpay Order Creation Error]:', error);
        if (error.statusCode === 401) {
            return res.status(401).json({ error: 'Razorpay authentication failed. Verify server environment credentials.' });
        }
        res.status(500).json({
            error: error.message || 'Failed to create Razorpay order'
        });
    }
});

/**
 * STEP 3: BACKEND - Verify Signature
 * Endpoint: POST /api/verify-payment
 * Request body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
app.post('/api/verify-payment', rateLimiter(20, 60 * 1000), (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters (razorpay_order_id, razorpay_payment_id, razorpay_signature)'
            });
        }

        // Format validation to prevent injection or malformed input
        if (typeof razorpay_order_id !== 'string' || typeof razorpay_payment_id !== 'string' || typeof razorpay_signature !== 'string') {
            return res.status(400).json({ success: false, error: 'Invalid parameter types' });
        }

        if (!keySecret) {
            return res.status(503).json({ success: false, error: 'Server payment secret is not configured' });
        }

        const body = `${razorpay_order_id}|${razorpay_payment_id}`;

        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(body)
            .digest('hex');

        // Timing-safe comparison to prevent timing side-channel attacks
        const expectedBuf = Buffer.from(expectedSignature);
        const receivedBuf = Buffer.from(razorpay_signature);

        let isSignatureValid = false;
        if (expectedBuf.length === receivedBuf.length) {
            isSignatureValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
        }

        if (!isSignatureValid) {
            console.warn('[Razorpay Verification Failed]: Signature mismatch', {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id
            });
            return res.status(400).json({
                success: false,
                message: 'Invalid signature! Payment verification failed.'
            });
        }

        console.log(`[Razorpay Payment Verified]: Payment ID ${razorpay_payment_id} for Order ${razorpay_order_id}`);

        res.json({
            success: true,
            message: 'Payment signature verified successfully',
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id
        });
    } catch (error) {
        console.error('[Razorpay Verification Error]:', error);
        res.status(500).json({
            success: false,
            error: 'Internal error while verifying payment'
        });
    }
});

app.listen(PORT, () => {
    console.log(`[Gharmitra Backend] Razorpay server running on http://localhost:${PORT}`);
});
