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
  const subject = 'Reset Your Password';
  const text = `You requested a password reset. Please use the following link to reset your password: ${resetUrl}`;
  const html = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
      <h2>Password Reset Request</h2>
      <p>Click the button below to reset your password. This link is valid for 1 hour.</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
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
