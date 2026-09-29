const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(__dirname, 'data', 'wallet_store.json');

class WalletManager {
    constructor() {
        this.store = {
            wallets: {},
            transactions: [],
            processedRefIds: {}
        };
        this.locks = new Map(); // workerMobile -> Promise chain
        this.init();
    }

    init() {
        try {
            const dir = path.dirname(STORE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (fs.existsSync(STORE_PATH)) {
                const raw = fs.readFileSync(STORE_PATH, 'utf8');
                const parsed = JSON.parse(raw);
                this.store.wallets = parsed.wallets || {};
                this.store.transactions = parsed.transactions || [];
                this.store.processedRefIds = parsed.processedRefIds || {};
            } else {
                this.persist();
            }
        } catch (e) {
            console.error('[WalletManager] Failed to load store, initializing clean:', e.message);
            this.persist();
        }
    }

    persist() {
        const tmpPath = `${STORE_PATH}.tmp.${Date.now()}`;
        try {
            fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), 'utf8');
            fs.renameSync(tmpPath, STORE_PATH);
        } catch (e) {
            console.error('[WalletManager] Atomic write failed:', e);
            try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
            throw new Error('Database persistence failure');
        }
    }

    // Per-worker concurrency mutex lock
    async acquireLock(workerMobile, task) {
        const cleanMobile = String(workerMobile).replace(/\D/g, '').slice(-10);
        let currentLock = this.locks.get(cleanMobile) || Promise.resolve();

        let release;
        const newLock = new Promise(resolve => { release = resolve; });
        this.locks.set(cleanMobile, currentLock.then(() => newLock));

        try {
            await currentLock;
            return await task(cleanMobile);
        } finally {
            release();
            if (this.locks.get(cleanMobile) === newLock) {
                this.locks.delete(cleanMobile);
            }
        }
    }

    getBalance(workerMobile) {
        const cleanMobile = String(workerMobile).replace(/\D/g, '').slice(-10);
        const wallet = this.store.wallets[cleanMobile];
        return wallet ? wallet.balance : 50; // Default initial credits: 50
    }

    getTransactions(workerMobile, limit = 50) {
        const cleanMobile = String(workerMobile).replace(/\D/g, '').slice(-10);
        return this.store.transactions
            .filter(t => t.workerMobile === cleanMobile)
            .slice(-limit)
            .reverse();
    }

    computeTxHash(prevHash, txData) {
        return crypto
            .createHash('sha256')
            .update(prevHash + JSON.stringify(txData))
            .digest('hex');
    }

    async recharge(workerMobile, amount, paymentId, orderId, signature) {
        return this.acquireLock(workerMobile, async (mobile) => {
            const numericAmount = parseInt(amount, 10);
            if (isNaN(numericAmount) || numericAmount < 10) {
                const err = new Error('Minimum recharge amount is ₹10');
                err.status = 400;
                throw err;
            }
            if (numericAmount > 50000) {
                const err = new Error('Recharge amount exceeds maximum limit of ₹50,000');
                err.status = 400;
                throw err;
            }

            // Replay defense
            if (this.store.processedRefIds[paymentId]) {
                const err = new Error('This payment transaction has already been credited.');
                err.status = 409;
                throw err;
            }

            const currentBalance = this.getBalance(mobile);
            const newBalance = currentBalance + numericAmount;

            const prevTx = this.store.transactions[this.store.transactions.length - 1];
            const prevHash = prevTx ? prevTx.hash : '0000000000000000000000000000000000000000000000000000000000000000';

            const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const txData = {
                id: txId,
                workerMobile: mobile,
                type: 'RECHARGE',
                amount: numericAmount,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                refId: paymentId,
                orderId: orderId || null,
                timestamp: Date.now()
            };
            txData.hash = this.computeTxHash(prevHash, txData);

            // Commit atomic update
            this.store.wallets[mobile] = {
                balance: newBalance,
                currency: 'INR',
                updatedAt: Date.now()
            };
            this.store.transactions.push(txData);
            this.store.processedRefIds[paymentId] = {
                timestamp: Date.now(),
                txId: txId,
                amount: numericAmount
            };

            this.persist();

            return {
                success: true,
                txId: txId,
                amount: numericAmount,
                balance: newBalance
            };
        });
    }

    async deductFee(workerMobile, amount, orderId) {
        return this.acquireLock(workerMobile, async (mobile) => {
            const numericAmount = parseInt(amount, 10);
            if (isNaN(numericAmount) || numericAmount <= 0) {
                const err = new Error('Fee amount must be a positive number');
                err.status = 400;
                throw err;
            }

            // Idempotency: verify this order has not already had fee deducted
            const orderRefKey = `order_fee_${orderId}`;
            if (orderId && this.store.processedRefIds[orderRefKey]) {
                return {
                    success: true,
                    deducted: false,
                    message: 'Fee already deducted for this order',
                    balance: this.getBalance(mobile)
                };
            }

            const currentBalance = this.getBalance(mobile);
            if (currentBalance < numericAmount) {
                const err = new Error(`Insufficient wallet credits. Required: ₹${numericAmount}, Current Balance: ₹${currentBalance}`);
                err.status = 400;
                throw err;
            }

            const newBalance = currentBalance - numericAmount;

            const prevTx = this.store.transactions[this.store.transactions.length - 1];
            const prevHash = prevTx ? prevTx.hash : '0000000000000000000000000000000000000000000000000000000000000000';

            const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const txData = {
                id: txId,
                workerMobile: mobile,
                type: 'JOB_FEE_DEDUCTION',
                amount: -numericAmount,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                refId: orderRefKey,
                orderId: orderId || null,
                timestamp: Date.now()
            };
            txData.hash = this.computeTxHash(prevHash, txData);

            this.store.wallets[mobile] = {
                balance: newBalance,
                currency: 'INR',
                updatedAt: Date.now()
            };
            this.store.transactions.push(txData);
            if (orderId) {
                this.store.processedRefIds[orderRefKey] = {
                    timestamp: Date.now(),
                    txId: txId,
                    amount: numericAmount
                };
            }

            this.persist();

            return {
                success: true,
                deducted: true,
                txId: txId,
                amount: numericAmount,
                balance: newBalance
            };
        });
    }

    async adminCredit(workerMobile, amount, reason, adminId) {
        return this.acquireLock(workerMobile, async (mobile) => {
            const numericAmount = parseInt(amount, 10);
            if (isNaN(numericAmount) || numericAmount === 0) {
                const err = new Error('Amount must be a non-zero integer');
                err.status = 400;
                throw err;
            }

            const currentBalance = this.getBalance(mobile);
            const newBalance = currentBalance + numericAmount;
            if (newBalance < 0) {
                const err = new Error('Credit adjustment cannot result in negative balance');
                err.status = 400;
                throw err;
            }

            const prevTx = this.store.transactions[this.store.transactions.length - 1];
            const prevHash = prevTx ? prevTx.hash : '0000000000000000000000000000000000000000000000000000000000000000';

            const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const txData = {
                id: txId,
                workerMobile: mobile,
                type: 'ADMIN_ADJUSTMENT',
                amount: numericAmount,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                refId: `admin_${adminId || 'owner'}_${Date.now()}`,
                orderId: null,
                reason: reason || 'Admin manual credit adjustment',
                timestamp: Date.now()
            };
            txData.hash = this.computeTxHash(prevHash, txData);

            this.store.wallets[mobile] = {
                balance: newBalance,
                currency: 'INR',
                updatedAt: Date.now()
            };
            this.store.transactions.push(txData);

            this.persist();

            return {
                success: true,
                txId: txId,
                amount: numericAmount,
                balance: newBalance
            };
        });
    }
}

const instance = new WalletManager();
module.exports = instance;
