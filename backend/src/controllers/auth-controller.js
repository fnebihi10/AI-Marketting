"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.getMe = exports.login = exports.register = void 0;
const authService_1 = require("../services/authService");
const email_service_1 = require("../services/email-service");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Basic email format validation */
const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);
// ─── Controllers ──────────────────────────────────────────────────────────────
/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
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
        const data = await (0, authService_1.registerUser)(email, password);
        return res.status(201).json({ success: true, ...data });
    }
    catch (err) {
        next(err);
    }
};
exports.register = register;
/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const data = await (0, authService_1.loginUser)(email, password);
        return res.status(200).json({ success: true, ...data });
    }
    catch (err) {
        next(err);
    }
};
exports.login = login;
/**
 * GET /api/auth/me  (protected)
 */
const getMe = async (req, res, next) => {
    try {
        const user = await (0, authService_1.getUserById)(req.user.userId);
        return res.status(200).json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
};
exports.getMe = getMe;
/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email' });
        }
        const resetToken = await (0, authService_1.generateResetToken)(email);
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        const base = frontendBase.replace(/\/$/, '');
        const resetUrl = `${base}/reset-password/${resetToken}`;
        // Attempt to send email; if it fails, still return resetUrl for local testing
        try {
            const { previewUrl } = await (0, email_service_1.sendResetEmail)(email, resetUrl);
            return res.status(200).json({ success: true, message: 'Reset email sent', resetUrl, previewUrl });
        }
        catch (sendErr) {
            return res.status(200).json({ success: true, message: 'Token generated (email send failed)', resetUrl, error: sendErr.message });
        }
    }
    catch (err) {
        next(err);
    }
};
exports.forgotPassword = forgotPassword;
/**
 * PUT /api/auth/reset-password/:token
 */
const resetPassword = async (req, res, next) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        const data = await (0, authService_1.resetPassword)(req.params.token, password);
        return res.status(200).json({ success: true, message: 'Password reset successful', ...data });
    }
    catch (err) {
        next(err);
    }
};
exports.resetPassword = resetPassword;
