const mongoose = require('mongoose');

/**
 * OAuthPendingState Model
 *
 * Temporarily stores the OAuth2 state parameter → userId mapping
 * during the Gmail OAuth2 flow. The callback endpoint uses this
 * to look up which user is completing authorization.
 *
 * Records expire in 10 minutes (enforced by MongoDB TTL index).
 * One record per user (upserted on each initiation).
 */
const oauthPendingStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // HMAC state token generated during OAuth initiation
    state: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // TTL — MongoDB auto-deletes expired records
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: expire at the specified date
    },
  },
  {
    timestamps: true,
    collection: 'oauth_pending_states',
  }
);

module.exports = mongoose.model('OAuthPendingState', oauthPendingStateSchema);

