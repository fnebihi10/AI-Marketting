"use strict"; // Detyron zbatimin e rregullave strikte në JavaScript për të shmangur gabimet

// Importimi i paketave në mënyrë standarde të Node.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models/User"); // Modeli i DB MongoDB për përdoruesit

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Nënshkruan një JWT për një ID të caktuar përdoruesi.
 * Tokeni bazohet në sekretin në .env dhe skadon pas kohës së caktuar.
 */
const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '1d'),
});

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Regjistron një përdorues të ri.
 * Enkripton fjalëkalimin dhe kthen një JWT pas suksesit.
 */
const registerUser = async (email, password) => {
    // Kontrollon nëse ekziston përdoruesi me këtë email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        const err = new Error('An account with this email already exists');
        err.statusCode = 409;
        throw err;
    }
    
    // Enkripton fjalëkalimin (Hash)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Krijon përdoruesin në DB
    const user = await User.create({ email, password: hashedPassword });
    const token = signToken(user._id);
    
    return { 
        token, 
        user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } 
    };
};

/**
 * Kyç një përdorues ekzistues (Login).
 * Kthen një JWT pas verifikimit të suksesshëm.
 */
const loginUser = async (email, password) => {
    // Merr përdoruesit duke përfshirë fushën e password-it (e cila është select: false si default)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }
    
    // Krahason fjalëkalimin e shkruar me atë të enkriptuar në DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }
    
    const token = signToken(user._id);
    return { 
        token, 
        user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } 
    };
};

/**
 * Merr të dhënat e një përdoruesi sipas ID-së (për rrugën /me).
 */
const getUserById = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }
    return { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt };
};

/**
 * Gjeneron një token për resetimin e fjalëkalimit.
 * Ruon tokenin e enkriptuar në DB dhe kthen tokenin e thjeshtë (për t'ia dërguar me email).
 */
const generateResetToken = async (email) => {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        const err = new Error('No user found with that email');
        err.statusCode = 404;
        throw err;
    }
    
    // Krijon një token të thjeshtë kudo (raw crypto token)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // E enkripton atë me SHA256 para se ta ruajë në DB për siguri
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // Vlefshëm për 1 orë
    await user.save();
    
    return resetToken;
};

/**
 * Reseton fjalëkalimin duke përdorur tokenin e dërguar.
 * Validon tokenin, enkripton fjalëkalimin e ri dhe kthen një JWT të ri.
 */
const resetPassword = async (token, newPassword) => {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
    });
    
    if (!user) {
        const err = new Error('Invalid or expired reset token');
        err.statusCode = 400;
        throw err;
    }
    
    // Enkripton fjalëkalimin e ri
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Pastron fushat e resetimit pasi procesi përfundoi me sukses
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    const jwtToken = signToken(user._id);
    return { 
        token: jwtToken, 
        user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } 
    };
};

// Eksportojmë të gjitha funksionet e shërbimit në fund të skedarit
module.exports = {
    registerUser,
    loginUser,
    getUserById,
    generateResetToken,
    resetPassword
};