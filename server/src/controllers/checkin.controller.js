const checkinService = require('../services/checkin/checkin.service');
const { updateScheduleSchema } = require('../validators/checkin.validator');

/**
 * GET /api/checkin/config
 * Retrieves check-in configuration, current status, and next deadline.
 */
const getConfig = async (req, res, next) => {
  try {
    const config = await checkinService.getScheduleConfig(req.user._id);
    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/checkin/config
 * Updates the user's check-in schedule, recalculates deadlines, and updates BullMQ jobs.
 */
const updateConfig = async (req, res, next) => {
  try {
    const validated = updateScheduleSchema.parse(req.body);
    const updated = await checkinService.updateScheduleConfig(req.user._id, validated, req.ip);

    return res.status(200).json({
      success: true,
      message: 'Check-in schedule updated successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/checkin/now
 * Explicit presence confirmation ("I Am Safe").
 * Resets deadlines, clears overdue status, and reschedules next cycle.
 */
const checkInNow = async (req, res, next) => {
  try {
    const result = await checkinService.performCheckIn(req.user._id, req.ip);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getConfig,
  updateConfig,
  checkInNow,
};

