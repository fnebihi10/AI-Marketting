import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getUserById, generateResetToken, resetPassword as resetPasswordService } from '../services/authService';
import { sendResetEmail } from '../services/email-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Basic email format validation */
const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const data = await registerUser(email, password);
    return res.status(201).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const data = await loginUser(email, password);
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me  (protected)
 */
export const getMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await getUserById(req.user.userId);
    return res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email' });
    }

    const resetToken = await generateResetToken(email);

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const base = frontendBase.replace(/\/$/, '');
    const resetUrl = `${base}/reset-password/${resetToken}`;

    // Attempt to send email; if it fails, still return resetUrl for local testing
    try {
      const { previewUrl } = await sendResetEmail(email, resetUrl) as any;
      return res.status(200).json({ success: true, message: 'Reset email sent', resetUrl, previewUrl });
    } catch (sendErr: any) {
      return res.status(200).json({ success: true, message: 'Token generated (email send failed)', resetUrl, error: sendErr.message });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/reset-password/:token
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const data = await resetPasswordService(req.params.token as string, password);
    return res.status(200).json({ success: true, message: 'Password reset successful', ...data });
  } catch (err) {
    next(err);
  }
};
