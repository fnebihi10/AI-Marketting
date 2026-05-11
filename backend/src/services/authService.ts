import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sign a JWT for a given user id.
 * @param {string} userId
 * @returns {string} signed JWT
 */
const signToken = (userId: any) =>
  jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any,
  });

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Register a new user.
 * Hashes the password and returns a JWT on success.
 */
export const registerUser = async (email: string, password: string) => {
  // Check for existing user
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const err = new Error('An account with this email already exists') as any;
    err.statusCode = 409;
    throw err;
  }

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({ email, password: hashedPassword });

  const token = signToken(user._id);
  return { token, user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } };
};

/**
 * Log in an existing user.
 * Returns a JWT on success.
 */
export const loginUser = async (email: string, password: string) => {
  // Fetch user including password field (excluded by default)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    const err = new Error('Invalid email or password') as any;
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password as string);
  if (!isMatch) {
    const err = new Error('Invalid email or password') as any;
    err.statusCode = 401;
    throw err;
  }

  const token = signToken(user._id);
  return { token, user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } };
};

/**
 * Fetch a user by ID (for the /me route).
 */
export const getUserById = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found') as any;
    err.statusCode = 404;
    throw err;
  }
  return { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt };
};

/**
 * Generate a password reset token.
 * Saves a hashed token to the user document and returns the plain token (to simulate emailing it).
 */
export const generateResetToken = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    const err = new Error('No user found with that email') as any;
    err.statusCode = 404;
    throw err;
  }

  // Create a raw crypto token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash it before saving to DB
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await user.save();
  return resetToken;
};

/**
 * Reset password using the token.
 * Validates token, hashes the new password, and returns a fresh JWT.
 */
export const resetPassword = async (token: string, newPassword: string) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    const err = new Error('Invalid or expired reset token') as any;
    err.statusCode = 400;
    throw err;
  }

  // Hash new password
  const salt = await bcrypt.genSalt(12);
  user.password = await bcrypt.hash(newPassword, salt);
  
  // Clear reset fields
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  const jwtToken = signToken(user._id);
  return { token: jwtToken, user: { id: user._id, email: user.email, role: user.role, credits: user.credits, createdAt: user.createdAt } };
};
