"use strict";

// Importojmë paketën nodemailer për dërgimin e email-eve
const nodemailer = require("nodemailer");
const { config } = require("../config");

// Krijon lidhjen me serverin SMTP që dërgon email-et
const transporterPromise = (async () => {
    // Kontrollojmë nëse kemi vendosur të dhëna reale për serverin e email-it
    const isProduction = !!(config.email.host && config.email.user);
    
    if (isProduction) {
        // Konfigurimi për serverin SMTP me të dhëna reale
        return nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: config.email.port == 465,
            auth: {
                user: config.email.user,
                pass: config.email.pass,
            },
        });
    } else {
        // Ambient lokal/testimi: Gjenerojmë një llogari testimi Ethereal me logjikë riprovimi
        let testAccount;
        for (let i = 0; i < 3; i++) {
            try {
                testAccount = await nodemailer.createTestAccount();
                break; // Nëse krijohet me sukses, ndalon ciklin
            }
            catch (err) {
                if (i === 2) throw err; // Nëse dështon edhe herën e tretë, nxjerr gabimin
                console.log(`Retrying Ethereal account creation (${i + 1}/3)...`);
                await new Promise(r => setTimeout(r, 2000)); // Presim 2 sekonda para riprovimit
            }
        }
        
        // Afishojmë kredencialet e testit në terminal që të mund të klikojmë linkun e kontrollit
        console.log('\n--- [EMAIL SERVICE: ETHEREAL TEST ACCOUNT] ---');
        console.log(`User: ${testAccount.user}`);
        console.log(`Pass: ${testAccount.pass}`);
        console.log('-----------------------------------------------\n');
        
        // Kthejmë transportuesin e email-it të testimit
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }
})();

/**
 * Funksion i brendshëm për dërgimin e një email-i.
 * @param {Object} options - { to, subject, text, html }
 */
const sendEmail = async (options) => {
    const transporter = await transporterPromise;
    
    // Përgatitja e strukturës së email-it
    const mailOptions = {
        from: process.env.SMTP_FROM || 'AI Marketing Tool <noreply@ai-marketing.com>',
        to: options.to,       // Kujt i shkon
        subject: options.subject, // Subjekti
        text: options.text,   // Versioni vetëm tekst
        html: options.html,   // Dizajni HTML
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        
        // Nëse jemi në ambient testimi, gjenerojmë një link ku mund të shohim se si duket emaili i dërguar
        if (info.messageId && !process.env.SMTP_HOST) {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('\n--- [EMAIL SENT (ETHEREAL PREVIEW)] ---');
            console.log(`Preview URL: ${previewUrl}`);
            console.log('----------------------------------------\n');
            return { ...info, previewUrl };
        }
        return info;
    }
    catch (error) {
        console.error('\n❌ [EMAIL SERVICE ERROR]: Failed to send email');
        console.error(error);
        console.log('----------------------------------------\n');
        throw error;
    }
};

// Dërgimi i email-it për rivendosjen e fjalëkalimit
const sendResetEmail = async (toEmail, resetUrl) => {
    const subject = 'Reset Your Password - AI Marketing Studio';
    const text = `You requested a password reset. Please use the following link to reset your password: ${resetUrl}\n\nThis link is valid for 1 hour.`;
    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #E5E7EB; background-color: #0B0F19; padding: 40px 20px; text-align: center;">
      <div style="max-width: 500px; margin: 0 auto; background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px 30px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <h2 style="color: #FFFFFF; font-size: 24px; font-weight: 600; margin-top: 0; margin-bottom: 16px; letter-spacing: -0.5px;">Reset your password</h2>
        <p style="color: #9CA3AF; font-size: 15px; margin-bottom: 32px;">We received a request to reset the password for your AI Marketing Studio account. Click the button below to choose a new one.</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.39);">Reset Password</a>
        <p style="color: #6B7280; font-size: 13px; margin-top: 32px; margin-bottom: 0;">This link is valid for 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
      <div style="margin-top: 24px; color: #4B5563; font-size: 12px;">
        &copy; ${new Date().getFullYear()} AI Marketing Studio. All rights reserved.
      </div>
    </div>
  `;
    return await sendEmail({ to: toEmail, subject, text, html });
};

// Eksportojmë funksionet në mënyrë standarde të Node.js
module.exports = {
    sendResetEmail
};