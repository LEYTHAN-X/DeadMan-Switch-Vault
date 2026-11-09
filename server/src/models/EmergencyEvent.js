const mongoose = require('mongoose');

/**
 * EmergencyEvent Model
 * Tracks the complete lifecycle of an emergency event workflow.
 *
 * State Machine Stages:
 *  1. ACTIVE
 *  2. CHECK_IN_OVERDUE
 *  3. WARNING
 *  4. GRACE_PERIOD
 *  5. ADDITIONAL_VERIFICATION
 *  6. MANUAL_OR_PREAUTHORIZED_RELEASE_APPROVAL
 *  7. AUTHORIZED_RELEASE
 *
 * Can transition to CANCELLED or SUSPENDED at any point prior to final release.
 * Adheres strictly to fail-closed security.
 */

const EMERGENCY_STAGES = [
  'ACTIVE',
  'CHECK_IN_OVERDUE',
  'WARNING',
  'GRACE_PERIOD',
  'ADDITIONAL_VERIFICATION',
  'MANUAL_OR_PREAUTHORIZED_RELEASE_APPROVAL',
  'AUTHORIZED_RELEASE',
  'CANCELLED',
  'SUSPENDED',
];

const stageTransitionSchema = new mongoose.Schema(
  {
    fromStage: {
      type: String,
      enum: EMERGENCY_STAGES,
      required: true,
    },
    toStage: {
      type: String,
      enum: EMERGENCY_STAGES,
      required: true,
    },
    transitionedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      default: 'Automated state machine progression',
    },
    triggeredBy: {
      type: String,
      enum: ['SYSTEM', 'USER', 'ADMIN', 'TIMEOUT'],
      default: 'SYSTEM',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const releasedEvidenceReceiptSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyContact',
      required: true,
    },
    recipientEmail: {
      type: String,
      required: true,
    },
    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: true,
    },
    fileName: String,
    sha256Hash: String,
    messageId: String, // Google Gmail API Message ID
    deliveredAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['DELIVERED', 'FAILED', 'PENDING'],
      default: 'PENDING',
    },
    errorMessage: String,
  },
  { _id: false }
);

const emergencyEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentStage: {
      type: String,
      enum: EMERGENCY_STAGES,
      default: 'ACTIVE',
      index: true,
    },
    // Complete audit of every stage transition in this event
    stageHistory: [stageTransitionSchema],

    // Additional Verification Stage: Random security token sent to secondary contacts
    verificationCode: {
      type: String,
      select: false, // Hidden by default
    },
    verificationExpiresAt: Date,
    isVerificationConfirmed: {
      type: Boolean,
      default: false,
    },

    // Approval Gate
    isPreauthorizedApproved: {
      type: Boolean,
      default: false,
    },
    approvalConfirmedAt: Date,

    // Release Details
    releaseInitiatedAt: Date,
    releaseCompletedAt: Date,
    releasedReceipts: [releasedEvidenceReceiptSchema],

    // Cancellation Details
    cancelledAt: Date,
    cancellationReason: String,
    cancelledByIp: String,

    // Fail-Closed Flag: If true, all release pipelines are immediately halted
    failClosedHalted: {
      type: Boolean,
      default: false,
    },
    haltReason: String,
  },
  {
    timestamps: true,
    collection: 'emergency_events',
  }
);

// Indexes
emergencyEventSchema.index({ userId: 1, currentStage: 1 });

module.exports = mongoose.model('EmergencyEvent', emergencyEventSchema);
module.exports.EMERGENCY_STAGES = EMERGENCY_STAGES;
