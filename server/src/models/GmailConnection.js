const mongoose = require('mongoose');

/**
 * GmailConnection Model
 * Stores encrypted OAuth2 tokens for a user's connected Gmail account.
 * Tokens are encrypted using AES-256-GCM via the encryption service.
 * One connection per user (enforced by unique index on userId).
 */
const gmailConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // The Gmail address that was authorized (e.g., user@gmail.com)
    gmailAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    // AES-256-GCM encrypted access token (JSON: { ciphertext, iv, authTag })
    encryptedAccessToken: {
      type: String,
      required: true,
      select: false, // Never returned in normal queries
    },
    // AES-256-GCM encrypted refresh token (JSON: { ciphertext, iv, authTag })
    encryptedRefreshToken: {
      type: String,
      required: true,
      select: false, // Never returned in normal queries
    },
    // When the access token expires (UTC)
    tokenExpiryAt: {
      type: Date,
      required: true,
    },
    // OAuth scopes that were granted
    scopes: {
      type: [String],
      default: [],
    },
    // Connection health status
    status: {
      type: String,
      enum: ['connected', 'token_expired', 'revoked', 'error'],
      default: 'connected',
    },
    // Last time tokens were successfully refreshed
    lastRefreshedAt: {
      type: Date,
      default: Date.now,
    },
    // Last time the connection was used to send an email
    lastUsedAt: {
      type: Date,
      default: null,
    },
    // Count of emails sent through this connection
    emailsSentCount: {
      type: Number,
      default: 0,
    },
    // Last connection error message (for diagnostics, never includes tokens)
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'gmail_connections',
  }
);

// Index for quick lookup
gmailConnectionSchema.index({ status: 1 });

/**
 * Virtual: Whether the access token appears expired
 */
gmailConnectionSchema.virtual('isAccessTokenExpired').get(function () {
  return this.tokenExpiryAt ? new Date() > this.tokenExpiryAt : true;
});

/**
 * Instance method: Get safe connection info (no tokens)
 */
gmailConnectionSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    userId: this.userId,
    gmailAddress: this.gmailAddress,
    status: this.status,
    scopes: this.scopes,
    lastRefreshedAt: this.lastRefreshedAt,
    lastUsedAt: this.lastUsedAt,
    emailsSentCount: this.emailsSentCount,
    isAccessTokenExpired: this.isAccessTokenExpired,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('GmailConnection', gmailConnectionSchema);

