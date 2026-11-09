const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/gmail.controller');
const { protect } = require('../middleware/auth.middleware');

/**
 * Gmail Integration Routes
 *
 * Protected routes require a valid JWT (Bearer token or cookie).
 * The OAuth2 callback is a public route — it is called by Google's servers.
 */

// ─── Public Routes ────────────────────────────────────────────────────────────

/**
 * GET /api/gmail/oauth2callback
 * Google OAuth2 callback — called by Google after user grants/denies permission.
 * Must be a public route (no JWT auth) since it is a browser redirect from Google.
 */
router.get('/oauth2callback', gmailController.handleOAuthCallback);

// ─── Protected Routes (JWT required) ─────────────────────────────────────────

/**
 * GET /api/gmail/status
 * Returns Gmail connection status and metadata for the authenticated user.
 */
router.get('/status', protect, gmailController.getStatus);

/**
 * POST /api/gmail/connect
 * Initiates the Gmail OAuth2 flow.
 * Stores state→userId mapping and returns the Google consent screen URL.
 */
router.post('/connect', protect, gmailController.initiateConnect);

/**
 * POST /api/gmail/send-test
 * Sends a test email via the user's connected Gmail account.
 * Body: { recipientEmail, subject?, message? }
 */
router.post('/send-test', protect, gmailController.sendTestEmail);

/**
 * DELETE /api/gmail/disconnect
 * Revokes OAuth tokens and removes the Gmail connection.
 */
router.delete('/disconnect', protect, gmailController.disconnect);

module.exports = router;

