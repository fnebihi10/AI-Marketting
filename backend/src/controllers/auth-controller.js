"use strict"; // Detyron përdorimin e rregullave strikte të JavaScript për të shmangur gabimet

// Importojmë shërbimet për autentifikim dhe dërgimin e emailit në mënyrë të pastër
const { 
  registerUser, 
  loginUser, 
  getUserById, 
  generateResetToken, 
  resetPassword: resetPasswordService 
} = require("../services/authService");

const { sendResetEmail } = require("../services/email-service");

// Funksion që kontrollon nëse emaili është në formatin e duhur
const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * Funksion për regjistrimin e përdoruesve
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
    try {
        // Merr email dhe password nga trupi i kërkesës
        const { email, password } = req.body;
        
        // Kontrollon nëse email dhe password janë të pranishme
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        
        // Kontrollon nëse emaili është i saktë si strukturë
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email' });
        }
        
        // Kontrollon a është fjalëkalimi më i gjatë se 6 karakterë
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        
        // Nëse kalojnë këto, e regjistron në DB
        const data = await registerUser(email, password);
        return res.status(201).json({ success: true, ...data });
    }
    catch (err) {
        // Nëse ka gabim e dërgon te error middleware
        next(err);
    }
};

/**
 * POST /api/auth/login
 * Ky funksion bën kontrollin për login
 */
const login = async (req, res, next) => {
    try {
        // Merr emailin dhe fjalëkalimin nga përdoruesi
        const { email, password } = req.body;
        
        // Kontrollon se a janë të plotësuara të dyja fushat
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        
        // Kontrollon shërbimet nëse janë të saktë me ato në DB
        const data = await loginUser(email, password);
        return res.status(200).json({ success: true, ...data });
    }
    catch (err) {
        next(err);
    }
};

/**
 * GET /api/auth/me (protected)
 * Merr të dhënat e përdoruesit që është aktualisht i kyçur
 */
const getMe = async (req, res, next) => {
    try {
        // `req.user.userId` vjen nga middleware për kontroll të vlerëshmërisë së tokenit
        const user = await getUserById(req.user.userId);
        return res.status(200).json({ success: true, user });
    }
    catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/forgot-password
 * Funksion që gjeneron token për reset funksion
 */
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        // Kontrollon nëse emaili i shkruar është i vlefshëm
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email' });
        }
        
        // Gjeneron një token për ndryshimin e passwordit
        const resetToken = await generateResetToken(email);
        
        // Gjen adresën e frontendit
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        const base = frontendBase.replace(/\/$/, '');
        
        // Krijon linkun për resetim të passwordit
        const resetUrl = `${base}/reset-password/${resetToken}`;
        
        // Përpjekje për të dërguar email-in
        try {
            const { previewUrl } = await sendResetEmail(email, resetUrl);
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

/**
 * PUT /api/auth/reset-password/:token
 * Kjo thirret pasi që përdoruesi e ka klikuar linkun në email dhe shkruan passwordin e ri
 */
const resetPassword = async (req, res, next) => {
    try {
        const { password } = req.body;
        
        // Kontrollon nëse passwordi i ka të pakten 6 karakterë
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        
        // Dërgojmë tokenin dhe fjalëkalimin e ri për t'u përditësuar
        const data = await resetPasswordService(req.params.token, password);
        return res.status(200).json({ success: true, message: 'Password reset successful', ...data });
    }
    catch (err) {
        next(err);
    }
};

// Eksportojmë të gjitha funksionet në mënyrë standarde të Node.js në fund të skedarit
module.exports = {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword
};