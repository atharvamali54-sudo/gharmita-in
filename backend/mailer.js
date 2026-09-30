const nodemailer = require('nodemailer');

// Production Admin Security Email Recipients
const ADMIN_EMAILS = [
    'atharvamali54@gmail.com',
    'prathameshr361@gmail.com'
];

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASS
            }
        });
    } else {
        // Safe development fallback: streams/buffers email without failing
        transporter = nodemailer.createTransport({
            streamTransport: true,
            newline: 'windows',
            buffer: true
        });
    }

    return transporter;
}

/**
 * Sends a 6-digit OTP simultaneously to all designated admin emails
 * @param {string} otp 6-digit OTP code
 * @param {string} ip Requesting client IP
 * @returns {Promise<{success: boolean, recipients: string[], messageId?: string}>}
 */
async function sendAdminOtpEmail(otp, ip = 'unknown') {
    const t = getTransporter();
    const recipientList = ADMIN_EMAILS.join(', ');

    const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 24px; text-align: center; color: #ffffff;">
                <div style="font-size: 32px; margin-bottom: 8px;">🛡️</div>
                <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Gharmitra Super Admin Portal</h1>
                <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Production Security Authentication OTP</p>
            </div>
            <div style="padding: 28px 24px; color: #1e293b;">
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">
                    सुपर ॲडमिन डॅशबोर्ड उघडण्यासाठी खालील <strong>६-अंकी सुरक्षा OTP</strong> वापरा:
                </p>
                <div style="background: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
                    <span style="font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 0.35em; color: #1e40af; display: inline-block;">${otp}</span>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <p style="margin: 0; font-size: 12px; color: #991b1b; font-weight: 600;">
                        ⏱️ हा OTP पुढील <strong>५ मिनिटांसाठी (5 Minutes)</strong> वैध आहे. सलग ३ चुकीच्या प्रयत्नांनंतर खाते १५ मिनिटांसाठी लॉक होईल.
                    </p>
                </div>
                <p style="margin: 16px 0 0 0; font-size: 11px; color: #64748b;">
                    IP Address: <code style="background: #e2e8f0; padding: 2px 5px; border-radius: 4px;">${ip}</code> • Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </p>
            </div>
            <div style="background: #f8fafc; padding: 14px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                Gharmitra Services Private Limited • Confidential Super Admin Notification
            </div>
        </div>
    `;

    const mailOptions = {
        from: process.env.SMTP_FROM || '"Gharmitra Super Admin" <security@gharmitra.in>',
        to: recipientList,
        subject: `🔐 Gharmitra Admin Login OTP: ${otp} (Valid for 5 mins)`,
        text: `Gharmitra Super Admin Verification OTP: ${otp}\nValid for 5 minutes.\nRequested from IP: ${ip}\nDo not share this OTP with anyone.`,
        html: htmlContent
    };

    try {
        const info = await t.sendMail(mailOptions);
        console.log(`[Admin Mailer] OTP sent simultaneously to: ${recipientList} (MessageID: ${info.messageId || 'local-stream'})`);
        return { success: true, recipients: ADMIN_EMAILS, messageId: info.messageId };
    } catch (err) {
        console.error('[Admin Mailer Error]:', err.message);
        return { success: false, recipients: ADMIN_EMAILS, error: err.message };
    }
}

module.exports = {
    ADMIN_EMAILS,
    sendAdminOtpEmail
};
