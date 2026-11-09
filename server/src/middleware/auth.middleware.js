const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Authentication Guard Middleware
 * Validates JWT from Authorization Header (Bearer) or HTTP-Only cookie.
 */
const protect = async (req, res, next) => {
  let token;

  // Check Bearer authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Fallback to cookie if present
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Authentication token required',
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_dead_man_switch_vault_2026_secure';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).select('-passwordResetToken -passwordResetExpires');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session: User no longer exists',
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Please contact security administration.',
      });
    }

    // Attach authenticated user to request
    req.user = user;
    next();
  } catch (error) {
    logger.warn(`JWT verification failure: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Access denied: Token expired or invalid',
    });
  }
};

/**
 * Role-Based Access Control Middleware (optional helper)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient privileges',
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize,
};

