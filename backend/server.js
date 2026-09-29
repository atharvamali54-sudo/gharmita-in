const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.RAZORPAY_KEY_ID) {
    require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const auth = require('./auth');
const walletManager = require('./wallet');

const app = express();
const PORT = process.env.PORT || 5000;
const RTDB_URL = process.env.FIREBASE_DATABASE_URL || 'https://gharkam-6c879-default-rtdb.firebaseio.com';

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

// Initialize Razorpay SDK instance
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
    console.warn('[SECURITY WARNING] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in backend/.env!');
}

const razorpay = (keyId && keySecret) ? new Razorpay({
    key_id: keyId,
    key_secret: keySecret
}) : null;

// Helper: sync wallet balance to Firebase RTDB asynchronously
async function syncWalletToFirebase(mobile, balance) {
    try {
        const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
        // Sync to workers/accounts/workers/<mobile>/balance
        await fetch(`${RTDB_URL}/workers/accounts/workers/${cleanMobile}/balance.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(balance)
        });
        // Sync to workers/local_worker_<mobile>/wallet
        await fetch(`${RTDB_URL}/workers/local_worker_${cleanMobile}/wallet.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(balance)
        });
    } catch (e) {
        console.warn('[Firebase Sync Warning]:', e.message);
    }
}

// -------------------------------------------------------------
// Core System Endpoints
// -------------------------------------------------------------

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Gharmitra Production API & Payment Backend',
        key_configured: Boolean(keyId && keySecret),
        auth_configured: Boolean(process.env.AUTH_TOKEN_SECRET)
    });
});

// Expose public key for frontend clients (NEVER secret)
app.get('/api/config', (req, res) => {
    res.json({
        key_id: keyId || ''
    });
});

// -------------------------------------------------------------
// Authentication Endpoints (Server-Issued Cryptographic Identity)
// -------------------------------------------------------------

// User login endpoint
app.post('/api/auth/login', rateLimiter(15, 60 * 1000), async (req, res) => {
    try {
        const { mobile, password, role } = req.body;
        if (!mobile || !password) {
            return res.status(400).json({ error: 'Mobile and password are required' });
        }

        const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
            return res.status(400).json({ error: 'Mobile must be a valid 10-digit number' });
        }

        const safeRole = (role === 'worker') ? 'workers' : 'customers';
        const accountUrl = `${RTDB_URL}/workers/accounts/${safeRole}/${cleanMobile}.json`;

        const resp = await fetch(accountUrl);
        const userData = await resp.json();

        if (!userData || !userData.password) {
            return res.status(401).json({ error: 'Account not found. Please sign up first.' });
        }

        const { valid, needsUpgrade } = await auth.verifyPassword(password, userData.password, cleanMobile);
        if (!valid) {
            return res.status(401).json({ error: 'Incorrect password. Please try again.' });
        }

        // Automatic seamless scrypt upgrade for legacy plaintext or Phase 1 passwords
        if (needsUpgrade) {
            auth.hashPassword(password).then(scryptHash => {
                fetch(accountUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: scryptHash, upgradedAt: Date.now() })
                }).catch(e => console.warn('[Password Upgrade Warning]:', e.message));
            }).catch(e => console.warn('[Password Hashing Warning]:', e.message));
        }

        const tokenRole = (safeRole === 'workers') ? 'worker' : 'customer';
        const token = auth.generateToken({
            uid: `${tokenRole}_${cleanMobile}`,
            mobile: cleanMobile,
            role: tokenRole,
            name: userData.fullName || userData.name || 'User'
        }, 7 * 24 * 3600); // 7-day token

        res.json({
            success: true,
            token,
            user: {
                mobile: cleanMobile,
                name: userData.fullName || userData.name || 'User',
                role: tokenRole
            }
        });
    } catch (e) {
        console.error('[Auth Login Error]:', e);
        res.status(500).json({ error: 'Authentication service error' });
    }
});

// User register endpoint
app.post('/api/auth/register', rateLimiter(10, 60 * 1000), async (req, res) => {
    try {
        const { fullName, mobile, email, password, role, service } = req.body;
        if (!mobile || !password || !fullName) {
            return res.status(400).json({ error: 'Full name, mobile and password are required' });
        }

        const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
            return res.status(400).json({ error: 'Mobile must be a valid 10-digit number' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const safeRole = (role === 'worker') ? 'workers' : 'customers';
        const accountUrl = `${RTDB_URL}/workers/accounts/${safeRole}/${cleanMobile}.json`;

        // Check if account already exists
        const checkResp = await fetch(accountUrl);
        const existing = await checkResp.json();
        if (existing && existing.password) {
            return res.status(409).json({ error: 'This mobile number is already registered. Please sign in.' });
        }

        const scryptHash = await auth.hashPassword(password);
        const tokenRole = (safeRole === 'workers') ? 'worker' : 'customer';

        const newAccount = {
            fullName: fullName.trim(),
            name: fullName.trim(),
            mobile: cleanMobile,
            email: email ? String(email).trim().toLowerCase() : '',
            password: scryptHash,
            role: tokenRole,
            service: service || 'Cleaning',
            workType: service || 'Cleaning',
            balance: 50,
            createdAt: Date.now()
        };

        await fetch(accountUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAccount)
        });

        // Initialize worker node if worker
        if (tokenRole === 'worker') {
            await fetch(`${RTDB_URL}/workers/local_worker_${cleanMobile}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: fullName.trim(),
                    service: service || 'Cleaning',
                    wallet: 50
                })
            });
        }

        const token = auth.generateToken({
            uid: `${tokenRole}_${cleanMobile}`,
            mobile: cleanMobile,
            role: tokenRole,
            name: fullName.trim()
        }, 7 * 24 * 3600);

        res.json({
            success: true,
            token,
            user: {
                mobile: cleanMobile,
                name: fullName.trim(),
                role: tokenRole
            }
        });
    } catch (e) {
        console.error('[Auth Register Error]:', e);
        res.status(500).json({ error: 'Registration service error' });
    }
});

// Get current authenticated user profile
app.get('/api/auth/me', auth.requireAuth, (req, res) => {
    res.json({ success: true, user: req.user });
});

// Logout and revoke token
app.post('/api/auth/logout', auth.requireAuth, (req, res) => {
    auth.revokeToken(req.user.jti);
    res.json({ success: true, message: 'Logged out successfully' });
});

// -------------------------------------------------------------
// Wallet Endpoints (Server-Authoritative, Zero Client Control)
// -------------------------------------------------------------

// Get verified balance
app.get('/api/wallet/balance', auth.requireAuth, (req, res) => {
    const balance = walletManager.getBalance(req.user.mobile);
    res.json({
        success: true,
        balance: balance,
        currency: 'INR'
    });
});

// Recharge wallet credits (verifies Razorpay signature server-side)
app.post('/api/wallet/recharge', auth.requireAuth, rateLimiter(15, 60 * 1000), async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required payment verification parameters'
            });
        }

        if (!keySecret) {
            return res.status(503).json({ success: false, error: 'Server payment secret not configured' });
        }

        // 1. Timing-safe cryptographic HMAC signature check
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(body)
            .digest('hex');

        const expectedBuf = Buffer.from(expectedSignature);
        const receivedBuf = Buffer.from(razorpay_signature);

        let isSignatureValid = false;
        if (expectedBuf.length === receivedBuf.length) {
            isSignatureValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
        }

        if (!isSignatureValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        // 2. Atomic recharge with replay prevention
        const result = await walletManager.recharge(
            req.user.mobile,
            amount,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature
        );

        // Async sync to Firebase
        syncWalletToFirebase(req.user.mobile, result.balance);

        res.json({
            success: true,
            balance: result.balance,
            txId: result.txId,
            message: `₹${result.amount} credits successfully added!`
        });
    } catch (e) {
        console.error('[Wallet Recharge Error]:', e);
        const status = e.status || 500;
        res.status(status).json({ success: false, error: e.message || 'Failed to recharge wallet' });
    }
});

// Deduct service fee upon job acceptance (idempotent, negative-balance protected)
app.post('/api/wallet/deduct-fee', auth.requireAuth, async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        const feeAmount = parseInt(amount, 10) || 20;

        const result = await walletManager.deductFee(req.user.mobile, feeAmount, orderId);

        if (result.deducted) {
            syncWalletToFirebase(req.user.mobile, result.balance);
        }

        res.json({
            success: true,
            balance: result.balance,
            deducted: result.deducted,
            message: result.message || `₹${result.amount} platform fee deducted`
        });
    } catch (e) {
        console.error('[Wallet Deduct Fee Error]:', e);
        const status = e.status || 500;
        res.status(status).json({ success: false, error: e.message || 'Failed to deduct fee' });
    }
});

// Get chronological immutable transaction statement
app.get('/api/wallet/transactions', auth.requireAuth, (req, res) => {
    const transactions = walletManager.getTransactions(req.user.mobile);
    res.json({ success: true, transactions });
});

// Super Admin manual credit adjustment (Audit logged)
app.post('/api/admin/recharge-worker', auth.requireAdmin, async (req, res) => {
    try {
        const { workerMobile, amount, reason } = req.body;
        if (!workerMobile || !amount) {
            return res.status(400).json({ error: 'Worker mobile and amount are required' });
        }

        const result = await walletManager.adminCredit(
            workerMobile,
            amount,
            reason || 'Admin manual recharge',
            req.user.mobile
        );

        syncWalletToFirebase(workerMobile, result.balance);

        res.json({
            success: true,
            balance: result.balance,
            txId: result.txId,
            message: `Successfully credited ₹${result.amount} to worker ${workerMobile}`
        });
    } catch (e) {
        console.error('[Admin Recharge Error]:', e);
        const status = e.status || 500;
        res.status(status).json({ success: false, error: e.message || 'Failed to adjust credit' });
    }
});

// -------------------------------------------------------------
// Razorpay Standard Checkout Endpoints
// -------------------------------------------------------------

// Create Razorpay Order
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

        // Convert to paise if passed as rupees
        let amountInPaise = numericAmount;
        if (req.body.isRupees !== false && amountInPaise < 50000) {
            amountInPaise = amountInPaise * 100;
        }

        if (amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least ₹1 (100 paise)' });
        }

        if (amountInPaise > 5000000) {
            return res.status(400).json({ error: 'Amount exceeds maximum permitted limit' });
        }

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

// Verify Payment Signature
app.post('/api/verify-payment', rateLimiter(20, 60 * 1000), (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters (razorpay_order_id, razorpay_payment_id, razorpay_signature)'
            });
        }

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

        const expectedBuf = Buffer.from(expectedSignature);
        const receivedBuf = Buffer.from(razorpay_signature);

        let isSignatureValid = false;
        if (expectedBuf.length === receivedBuf.length) {
            isSignatureValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
        }

        if (!isSignatureValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid signature! Payment verification failed.'
            });
        }

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
    console.log(`[Gharmitra Backend] Production server running on http://localhost:${PORT}`);
});
