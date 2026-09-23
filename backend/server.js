require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize Razorpay SDK instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TfNJa2bgBa28jt',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'd3lSqDmAh3Nqtb697iF12vqX'
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Gharmitra Razorpay Backend',
        key_configured: Boolean(process.env.RAZORPAY_KEY_ID)
    });
});

// Expose public key for frontend clients (NEVER secret)
app.get('/api/config', (req, res) => {
    res.json({
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TfNJa2bgBa28jt'
    });
});

/**
 * STEP 1: BACKEND - Create Order
 * Endpoint: POST /api/create-order
 * Request body: { amount: Number (in INR rupees or paise), receipt: String }
 */
app.post('/api/create-order', async (req, res) => {
    try {
        let { amount, receipt, notes } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        // Convert to paise if passed as rupees (less than 100000 assume rupees)
        let amountInPaise = parseInt(amount);
        if (req.body.isRupees !== false && amountInPaise < 50000) {
            amountInPaise = amountInPaise * 100;
        }

        // Razorpay minimum amount is 100 paise (₹1)
        if (amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least 100 paise (₹1)' });
        }

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: receipt || `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            notes: notes || { service: 'Gharmitra Partner Service Credits' }
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
            return res.status(401).json({ error: 'Razorpay authentication failed. Check credentials.' });
        }
        res.status(500).json({
            error: error.message || 'Failed to create Razorpay order',
            details: error.error || null
        });
    }
});

/**
 * STEP 3: BACKEND - Verify Signature
 * Endpoint: POST /api/verify-payment
 * Request body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
app.post('/api/verify-payment', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters (razorpay_order_id, razorpay_payment_id, razorpay_signature)'
            });
        }

        const secret = process.env.RAZORPAY_KEY_SECRET || 'd3lSqDmAh3Nqtb697iF12vqX';
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body.toString())
            .digest('hex');

        const isSignatureValid = expectedSignature === razorpay_signature;

        if (!isSignatureValid) {
            console.warn('[Razorpay Verification Failed]: Signature mismatch', {
                expected: expectedSignature,
                received: razorpay_signature
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
            error: error.message || 'Internal error while verifying payment'
        });
    }
});

app.listen(PORT, () => {
    console.log(`[Gharmitra Backend] Razorpay server running on http://localhost:${PORT}`);
});
