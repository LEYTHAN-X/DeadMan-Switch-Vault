const emergencyService = require('../services/emergency/emergency.service');
const { z } = require('zod');

const verifyCodeSchema = z.object({
  code: z.string().min(4, 'Verification code must be at least 4 digits').max(10),
});

const cancelEmergencySchema = z.object({
  reason: z.string().max(300).optional(),
});

const approveReleaseSchema = z.object({
  isApproved: z.boolean(),
});

/**
 * GET /api/emergency/status
 * Returns current emergency state, history, and active buffers.
 */
const getStatus = async (req, res, next) => {
  try {
    const status = await emergencyService.getLiveStatus(req.user._id);
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/emergency/cancel
 * Operator confirms safety and cancels emergency workflow, recovering account to ACTIVE.
 */
const cancelEmergency = async (req, res, next) => {
  try {
    const validated = cancelEmergencySchema.parse(req.body || {});
    const result = await emergencyService.cancelEmergency(
      req.user._id,
      validated.reason || 'Operator cancelled emergency and confirmed presence',
      req.ip
    );
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/emergency/verify
 * Validates 6-digit confirmation code during ADDITIONAL_VERIFICATION stage.
 */
const verifyCode = async (req, res, next) => {
  try {
    const validated = verifyCodeSchema.parse(req.body);
    const result = await emergencyService.confirmVerificationCode(req.user._id, validated.code, req.ip);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/emergency/approve
 * Pre-authorizes / manually approves evidence release gate.
 */
const approveRelease = async (req, res, next) => {
  try {
    const validated = approveReleaseSchema.parse(req.body);
    const result = await emergencyService.approveRelease(req.user._id, validated.isApproved, req.ip);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/emergency/execute-release
 * Executes the final authorized disclosure (fail-closed checks strictly enforced).
 */
const executeRelease = async (req, res, next) => {
  try {
    const result = await emergencyService.executeAuthorizedRelease(req.user._id, req.ip);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/emergency/simulate-escalation
 * Helper to step through the state machine pipeline for testing & verification.
 */
const simulateEscalation = async (req, res, next) => {
  try {
    const live = await emergencyService.getLiveStatus(req.user._id);
    const stage = live.currentStage;
    let result = null;

    if (stage === 'ACTIVE') {
      result = await emergencyService.transitionStage(
        req.user._id,
        'CHECK_IN_OVERDUE',
        'Simulated: Check-in deadline expired. Host notice sent.',
        'USER'
      );
    } else if (stage === 'CHECK_IN_OVERDUE') {
      result = await emergencyService.transitionStage(
        req.user._id,
        'GRACE_PERIOD',
        'Simulated: 1-2h safety buffer active. Host given final check-in window.',
        'USER'
      );
    } else if (stage === 'GRACE_PERIOD') {
      // Auto-trigger release: host did not respond!
      result = await emergencyService.executeAuthorizedRelease(
        req.user._id,
        req.ip || '127.0.0.1 (simulation)'
      );
    }

    return res.status(200).json({
      success: true,
      message: `Escalated from ${stage} to next stage.`,
      result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStatus,
  cancelEmergency,
  verifyCode,
  approveRelease,
  executeRelease,
  simulateEscalation,
};

