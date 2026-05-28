import nodemailer from 'nodemailer';
import { config } from '../config';

/**
 * Get the email transporter.
 * If credentials are found in config, it uses them.
 * Otherwise, it creates a test account (Ethereal).
 */
let transporterPromise = (async () => {
  const isProduction = !!(config.email.host && config.email.user);

  if (isProduction) {
    return nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port as number,
      secure: config.email.port == 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  } else {
    // Local/Test environment: Generate Ethereal test account with retry logic
    let testAccount: any;
    for (let i = 0; i < 3; i++) {
        try {
            testAccount = await nodemailer.createTestAccount();
            break;
        } catch (err) {
            if (i === 2) throw err;
            console.log(`Retrying Ethereal account creation (${i+1}/3)...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    console.log('\n--- [EMAIL SERVICE: ETHEREAL TEST ACCOUNT] ---');
    console.log(`User: ${testAccount.user}`);
    console.log(`Pass: ${testAccount.pass}`);
    console.log('-----------------------------------------------\n');

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

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send an email.
 * @param {Object} options - { to, subject, text, html }
 */
const sendEmail = async (options: EmailOptions) => {
  const transporter = await transporterPromise;

  const mailOptions = {
    from: process.env.SMTP_FROM || 'AI Marketing Tool <noreply@ai-marketing.com>',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    // If using Ethereal, log the preview URL
    if (info.messageId && !process.env.SMTP_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('\n--- [EMAIL SENT (ETHEREAL PREVIEW)] ---');
      console.log(`Preview URL: ${previewUrl}`);
      console.log('----------------------------------------\n');
      return { ...info, previewUrl };
    }

    return info;
  } catch (error) {
    console.error('\n❌ [EMAIL SERVICE ERROR]: Failed to send email');
    console.error(error);
    console.log('----------------------------------------\n');
    throw error;
  }
};

/**
 * Send a reset password email.
 */
export const sendResetEmail = async (toEmail: string, resetUrl: string) => {
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

/**
 * Send a welcome email.
 */
export const sendWelcomeEmail = async (toEmail: string) => {
  const subject = 'Welcome to AI Marketing Tool';
  const text = `Welcome! Your account has been successfully created.`;
  const html = `<h1>Welcome!</h1><p>Your account is ready.</p>`;

  return await sendEmail({ to: toEmail, subject, text, html });
};
