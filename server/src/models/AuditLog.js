const mongoose = require('mongoose');

/**
 * AuditLog Model
 *
 * Immutable audit trail of all security-relevant actions in the system.
 *
 * Security rules:
 *  - Never store passwords, OAuth tokens, or encryption keys here.
 *  - Always store userId, action, timestamp, and IP address.
 *  - Records are append-only (never updated or deleted in production).
 *
 * Indexed by userId, action, and createdAt for efficient queries.
 */

const AUDIT_ACTIONS = [
  // Authentication
  'USER_REGISTERED',
  'USER_LOGIN',
  'USER_LOGIN_FAILED',
  'USER_LOGOUT',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'ACCOUNT_LOCKED',
  // Check-ins
  'CHECK_IN_PERFORMED',
  'CHECK_IN_OVERDUE',
  // Evidence
  'EVIDENCE_UPLOADED',
  'EVIDENCE_DOWNLOADED',
  'EVIDENCE_DELETED',
  'EVIDENCE_ACCESS_DENIED',
  // Contacts
  'CONTACT_ADDED',
  'CONTACT_UPDATED',
  'CONTACT_DELETED',
  'CONTACT_VERIFIED',
  'CONTACT_VERIFICATION_RESENT',
  'CONTACT_EVIDENCE_ASSIGNED',
  // Gmail
  'GMAIL_CONNECTED',
  'GMAIL_DISCONNECTED',
  'GMAIL_TEST_EMAIL_SENT',
  'GMAIL_EMAIL_SENT',
  'GMAIL_EMAIL_FAILED',
  'GMAIL_TOKEN_REFRESHED',
  // Emergency workflow
  'EMERGENCY_WORKFLOW_STARTED',
  'EMERGENCY_WORKFLOW_CANCELLED',
  'EMERGENCY_STAGE_TRANSITIONED',
  'EMERGENCY_EVIDENCE_RELEASED',
  'EMERGENCY_RECOVERY',
  // System
  'SYSTEM_ERROR',
];

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
      index: true,
    },
    // IP address of the request (IPv4 or IPv6)
    ipAddress: {
      type: String,
      default: 'unknown',
    },
    // User agent string (browser/client identifier)
    userAgent: {
      type: String,
      default: 'unknown',
    },
    // Flexible metadata object for action-specific details.
    // NEVER include passwords, tokens, or encryption keys here.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Whether this action was successful
    success: {
      type: Boolean,
      default: true,
    },
    // Error message if the action failed (never include sensitive data)
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    // Prevent accidental updates to audit records
    strict: true,
    collection: 'audit_logs',
  }
);

// Compound indexes for efficient dashboard queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, action: 1 });

// Auto-expire audit logs after 2 years (optional — comment out to keep forever)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;

