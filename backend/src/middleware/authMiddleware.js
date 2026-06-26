"use strict"; // Detyron zbatimin e rregullave strikte në JS

// Importojmë paketën jsonwebtoken për të verifikuar tokenat në mënyrë të pastër
const jwt = require("jsonwebtoken");

/**
 * Middleware: kontrollon nëse përdoruesi ka leje për të parë diçka.
 * Sends 401 if the token is missing or invalid.
 */
const protect = (req, res, next) => {
    let token = '';
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized — no token provided',
        });
    }
    
    try {
        // Provojmë ta deshifrojmë tokenin duke përdorur fjalëkalimin tonë sekret të serverit
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Nëse është i saktë i marrim të dhënat dhe i dërgojmë te kërkesa (req.user)
        req.user = decoded; // { userId, iat, exp }
        next();
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized — token invalid or expired',
        });
    }
};

// Eksportojmë middleware-in në mënyrë standarde të Node.js
module.exports = { protect };