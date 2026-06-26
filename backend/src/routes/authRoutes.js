"use strict";

const express = require("express");
const { register, login, forgotPassword, resetPassword, getMe } = require("../controllers/auth-controller");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Protected routes
router.get('/me', protect, getMe);

// Eksportojmë router-in në mënyrë standarde të Node.js
module.exports = router;