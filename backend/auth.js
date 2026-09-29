const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.AUTH_TOKEN_SECRET;
if (!SECRET) {
    console.warn('[SECURITY WARNING] AUTH_TOKEN_SECRET is not configured in backend/.env!');
}

// In-Memory & Persisted Token Revocation Set
const revocationFile = path.join(__dirname, 'data', 'revoked_tokens.json');
let revokedTokens = new Set();

try {
    if (fs.existsSync(revocationFile)) {
        const data = JSON.parse(fs.readFileSync(revocationFile, 'utf8'));
        if (Array.isArray(data)) {
            revokedTokens = new Set(data);
        }
    }
} catch (e) {
    console.warn('[Auth] Could not load revoked tokens file:', e.message);
}

function persistRevocations() {
    try {
        const dir = path.dirname(revocationFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(revocationFile, JSON.stringify([...revokedTokens]), 'utf8');
    } catch (e) {
        console.warn('[Auth] Failed to persist revocations:', e.message);
    }
}

// -------------------------------------------------------------
// 1. Password Hashing (scrypt - Memory Hard, OWASP Recommended)
// -------------------------------------------------------------
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16);
        crypto.scrypt(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, derivedKey) => {
            if (err) return reject(err);
            const saltHex = salt.toString('hex');
            const keyHex = derivedKey.toString('hex');
            resolve(`scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${saltHex}$${keyHex}`);
        });
    });
}

function verifyPassword(enteredPassword, storedPassword, mobile = '') {
    return new Promise((resolve) => {
        if (!storedPassword || typeof storedPassword !== 'string') {
            return resolve({ valid: false, needsUpgrade: false });
        }

        // 1. scrypt format: scrypt$N$r$p$salt$hash
        if (storedPassword.startsWith('scrypt$')) {
            const parts = storedPassword.split('$');
            if (parts.length !== 6) return resolve({ valid: false, needsUpgrade: false });
            const N = parseInt(parts[1], 10);
            const r = parseInt(parts[2], 10);
            const p = parseInt(parts[3], 10);
            const salt = Buffer.from(parts[4], 'hex');
            const expectedKey = Buffer.from(parts[5], 'hex');

            crypto.scrypt(enteredPassword, salt, expectedKey.length, { N, r, p }, (err, derivedKey) => {
                if (err) return resolve({ valid: false, needsUpgrade: false });
                const isValid = crypto.timingSafeEqual(expectedKey, derivedKey);
                resolve({ valid: isValid, needsUpgrade: false });
            });
            return;
        }

        // 2. Phase 1 salted SHA-256 format: sha256$salt$hash
        if (storedPassword.startsWith('sha256$')) {
            const parts = storedPassword.split('$');
            if (parts.length === 3) {
                const salt = parts[1];
                const expectedHash = parts[2];
                const computed = crypto.createHash('sha256').update(salt + '_' + enteredPassword + '_' + mobile).digest('hex');
                const isValid = (computed === expectedHash);
                return resolve({ valid: isValid, needsUpgrade: true });
            }
        }

        // 3. Legacy plaintext compatibility
        const isPlainMatch = (enteredPassword === storedPassword);
        resolve({ valid: isPlainMatch, needsUpgrade: isPlainMatch });
    });
}

// -------------------------------------------------------------
// 2. Cryptographic JWT / HMAC Token Generation & Verification
// -------------------------------------------------------------
function base64UrlEncode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
}

function generateToken(payload, expiresInSeconds = 7 * 24 * 3600) {
    const activeSecret = SECRET || 'insecure_temporary_fallback_secret_must_configure_env';
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };

    const body = {
        ...payload,
        iss: 'gharmitra-backend',
        aud: 'gharmitra-clients',
        iat: now,
        exp: now + expiresInSeconds,
        jti: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(body));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
        .createHmac('sha256', activeSecret)
        .update(unsignedToken)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${unsignedToken}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const activeSecret = SECRET || 'insecure_temporary_fallback_secret_must_configure_env';

    // Verify header algorithm explicitly (prevent alg:none attacks)
    try {
        const header = JSON.parse(base64UrlDecode(encodedHeader));
        if (header.alg !== 'HS256') return null;
    } catch (e) {
        return null;
    }

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
        .createHmac('sha256', activeSecret)
        .update(unsignedToken)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const expectedBuf = Buffer.from(expectedSignature);
    const receivedBuf = Buffer.from(signature);

    if (expectedBuf.length !== receivedBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) return null;

    try {
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        const now = Math.floor(Date.now() / 1000);

        // Check expiration with 30s clock skew tolerance
        if (payload.exp && payload.exp + 30 < now) {
            return null;
        }

        // Check revocation
        if (payload.jti && revokedTokens.has(payload.jti)) {
            return null;
        }

        return payload;
    } catch (e) {
        return null;
    }
}

function revokeToken(jti) {
    if (!jti) return;
    revokedTokens.add(jti);
    persistRevocations();
}

// -------------------------------------------------------------
// 3. Express Authorization Middleware
// -------------------------------------------------------------
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization token required' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({ error: 'Invalid token format. Format must be: Bearer <token>' });
    }

    const user = verifyToken(parts[1]);
    if (!user) {
        return res.status(401).json({ error: 'Invalid or expired authorization token' });
    }

    req.user = user;
    next();
}

function requireWorker(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user.role !== 'worker' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Worker role required' });
        }
        next();
    });
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
        }
        next();
    });
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    revokeToken,
    requireAuth,
    requireWorker,
    requireAdmin
};
