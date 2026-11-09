const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');

/**
 * Public Authentication Routes with Brute-Force Rate Limiting
 */
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password/:token', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

/**
 * Protected Authentication Routes
 */
router.get('/me', protect, authController.getMe);
router.post('/checkin', protect, authController.checkIn);
router.put('/profile', protect, authController.updateProfile);
router.put('/change-password', protect, authLimiter, authController.changePassword);

module.exports = router;

