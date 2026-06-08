"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.generateResetToken = exports.getUserById = exports.loginUser = exports.registerUser = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Sign a JWT for a given user id.
 * @param {string} userId
 * @returns {string} signed JWT
 */
const signToken = (userId) => jsonwebtoken_1.default.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '1d'),
});
// ─── Service Functions ────────────────────────────────────────────────────────
/**
 * Register a new user.
 * Hashes the password and returns a JWT on success.
 */
const registerUser = async (email, password) => {
    // Check for existing user
    const existing = await User_1.default.findOne({ email: email.toLowerCase() });
    if (existing) {
        const err = new Error('An account with this email already exists');
        err.statusCode = 409;
        throw err;
    }
    // Hash password
    const salt = await bcryptjs_1.default.genSalt(12);
    const hashedPassword = await bcryptjs_1.default.hash(password, salt);
    // Create user
    const user = await User_1.default.create({ email, password: hashedPassword });
    const token = signToken(user._id);
    return { token, user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } };
};
exports.registerUser = registerUser;
/**
 * Log in an existing user.
 * Returns a JWT on success.
 */
const loginUser = async (email, password) => {
    // Fetch user including password field (excluded by default)
    const user = await User_1.default.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }
    const isMatch = await bcryptjs_1.default.compare(password, user.password);
    if (!isMatch) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }
    const token = signToken(user._id);
    return { token, user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } };
};
exports.loginUser = loginUser;
/**
 * Fetch a user by ID (for the /me route).
 */
const getUserById = async (userId) => {
    const user = await User_1.default.findById(userId);
    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }
    return { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt };
};
exports.getUserById = getUserById;
/**
 * Generate a password reset token.
 * Saves a hashed token to the user document and returns the plain token (to simulate emailing it).
 */
const generateResetToken = async (email) => {
    const user = await User_1.default.findOne({ email: email.toLowerCase() });
    if (!user) {
        const err = new Error('No user found with that email');
        err.statusCode = 404;
        throw err;
    }
    // Create a raw crypto token
    const resetToken = crypto_1.default.randomBytes(32).toString('hex');
    // Hash it before saving to DB
    user.resetPasswordToken = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();
    return resetToken;
};
exports.generateResetToken = generateResetToken;
/**
 * Reset password using the token.
 * Validates token, hashes the new password, and returns a fresh JWT.
 */
const resetPassword = async (token, newPassword) => {
    const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
    const user = await User_1.default.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
        const err = new Error('Invalid or expired reset token');
        err.statusCode = 400;
        throw err;
    }
    // Hash new password
    const salt = await bcryptjs_1.default.genSalt(12);
    user.password = await bcryptjs_1.default.hash(newPassword, salt);
    // Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    const jwtToken = signToken(user._id);
    return { token: jwtToken, user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } };
};
exports.resetPassword = resetPassword;
