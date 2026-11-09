const rateLimit = require('express-rate-limit');

/**
 * Standard JSON response for rate limit violations.
 */
const rateLimitHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too Many Requests',
    message,
    retryAfterSeconds: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
  });
};

/**
 * Auth Limiter: Protects login, registration, and password recovery against brute-force attacks.
 * Max 15 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many authentication attempts from this IP address. Please wait 15 minutes.'),
});

/**
 * General API Limiter: Protects backend routes from request flooding / DoS.
 * Max 300 requests per 15 minutes.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('API rate limit exceeded. Please throttle your requests.'),
});

/**
 * Upload Limiter: Prevents storage exhaustion attacks on evidence vault uploads.
 * Max 30 upload operations per 30 minutes.
 */
const uploadLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Evidence upload rate limit reached. Please wait before depositing more files.'),
});

/**
 * Verification Limiter: Protects public token validation endpoints against brute-force guessing.
 * Max 20 verification checks per 15 minutes.
 */
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many verification attempts. Please wait 15 minutes.'),
});

module.exports = {
  authLimiter,
  apiLimiter,
  uploadLimiter,
  verificationLimiter,
};

