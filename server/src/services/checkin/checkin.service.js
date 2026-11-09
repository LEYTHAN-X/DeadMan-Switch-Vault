/**
 * checkin.service.js
 * Business logic for user check-in schedules, deadline calculations, and presence confirmations.
 */

const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const queueService = require('../../queues/queue.service');
const logger = require('../../utils/logger');

/**
 * Calculates the next check-in deadline based on schedule config.
 *
 * @param {object} schedule - { intervalType, customIntervalDays, customIntervalHours }
 * @param {Date} [fromDate=new Date()]
 * @returns {Date}
 */
function calculateNextDeadline(schedule, fromDate = new Date()) {
  const next = new Date(fromDate);
  const type = schedule?.intervalType || 'daily';

  // Support direct minute intervals (e.g. 1 min, 5 min, 30 min, 60 min)
  if (schedule?.customIntervalMinutes) {
    next.setTime(next.getTime() + schedule.customIntervalMinutes * 60 * 1000);
    return next;
  }

  switch (type) {
    case 'minutes': {
      const mins = schedule.customIntervalMinutes || 1;
      next.setTime(next.getTime() + mins * 60 * 1000);
      break;
    }

    case 'daily':
      next.setDate(next.getDate() + 1);
      break;

    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;

    case 'custom':
    case 'hours': {
      if (schedule.customIntervalMinutes) {
        next.setTime(next.getTime() + schedule.customIntervalMinutes * 60 * 1000);
      } else {
        const hours = schedule.customIntervalHours
          ? schedule.customIntervalHours
          : (schedule.customIntervalDays || 1) * 24;
        next.setTime(next.getTime() + hours * 3600 * 1000);
      }
      break;
    }

    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Retrieves the check-in configuration and live status for a user.
 *
 * @param {string} userId
 */
async function getScheduleConfig(userId) {
  const user = await User.findById(userId).select(
    'fullName email status checkInSchedule lastCheckIn nextCheckInAt warningSentAt gracePeriodExpiresAt checkInCount'
  );

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    status: user.status,
    schedule: user.checkInSchedule,
    lastCheckIn: user.lastCheckIn,
    nextCheckInAt: user.nextCheckInAt,
    warningSentAt: user.warningSentAt,
    gracePeriodExpiresAt: user.gracePeriodExpiresAt,
    checkInCount: user.checkInCount || 0,
    isOverdue: user.nextCheckInAt ? new Date() > user.nextCheckInAt : false,
  };
}

/**
 * Updates a user's check-in schedule configuration.
 * Recalculates next deadline and updates background jobs.
 *
 * @param {string} userId
 * @param {object} configData
 * @param {string} ipAddress
 */
async function updateScheduleConfig(userId, configData, ipAddress = 'unknown') {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // Update schedule fields
  if (configData.intervalType) user.checkInSchedule.intervalType = configData.intervalType;
  if (configData.customIntervalMinutes !== undefined) {
    user.checkInSchedule.customIntervalMinutes = configData.customIntervalMinutes;
    user.checkInSchedule.customIntervalHours = Math.round((configData.customIntervalMinutes / 60) * 100) / 100;
  }
  if (configData.customIntervalDays !== undefined) user.checkInSchedule.customIntervalDays = configData.customIntervalDays;
  if (configData.customIntervalHours !== undefined) {
    user.checkInSchedule.customIntervalHours = configData.customIntervalHours;
    if (!configData.customIntervalMinutes) {
      user.checkInSchedule.customIntervalMinutes = Math.round(configData.customIntervalHours * 60);
    }
  }
  if (configData.gracePeriodMinutes !== undefined) {
    user.checkInSchedule.gracePeriodMinutes = configData.gracePeriodMinutes;
    user.checkInSchedule.gracePeriodHours = Math.round((configData.gracePeriodMinutes / 60) * 100) / 100;
  }
  if (configData.gracePeriodHours !== undefined) {
    user.checkInSchedule.gracePeriodHours = configData.gracePeriodHours;
    if (!configData.gracePeriodMinutes) {
      user.checkInSchedule.gracePeriodMinutes = Math.round(configData.gracePeriodHours * 60);
    }
  }
  if (configData.reminderOffsetsHours !== undefined) user.checkInSchedule.reminderOffsetsHours = configData.reminderOffsetsHours;

  // Recalculate deadline from last check-in (or from now if overdue)
  const baseTime = user.status === 'ACTIVE' && user.lastCheckIn ? user.lastCheckIn : new Date();
  user.nextCheckInAt = calculateNextDeadline(user.checkInSchedule, baseTime);

  // If user was overdue and updated schedule, allow recovery to ACTIVE if deadline is now in future
  if (user.status === 'CHECK_IN_OVERDUE' && user.nextCheckInAt > new Date()) {
    user.status = 'ACTIVE';
    user.warningSentAt = null;
    user.gracePeriodExpiresAt = null;
  }

  await user.save();

  // Refresh BullMQ background jobs
  await queueService.cancelPendingJobsForUser(user._id);

  if (user.status === 'ACTIVE') {
    // Schedule reminders
    const offsets = user.checkInSchedule.reminderOffsetsHours || [6, 2];
    for (const offset of offsets) {
      await queueService.scheduleReminder(user._id, user.nextCheckInAt, offset);
    }
    // Schedule deadline monitoring
    await queueService.scheduleDeadlineMonitoring(user._id, user.nextCheckInAt);
  }

  // Audit log
  await AuditLog.create({
    userId: user._id,
    action: 'CHECK_IN_PERFORMED',
    metadata: {
      type: 'SCHEDULE_CONFIG_UPDATED',
      schedule: user.checkInSchedule,
      nextCheckInAt: user.nextCheckInAt,
    },
    ipAddress,
  });

  logger.info(`Updated check-in schedule for user ${userId}`, {
    intervalType: user.checkInSchedule.intervalType,
    nextCheckInAt: user.nextCheckInAt,
  });

  return getScheduleConfig(userId);
}

/**
 * Performs an immediate manual check-in ("I Am Safe").
 * Resets deadlines, clears warnings, and schedules next job cycle.
 *
 * @param {string} userId
 * @param {string} ipAddress
 */
async function performCheckIn(userId, ipAddress = 'unknown') {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = user.status;
  const now = new Date();

  // Reset presence
  user.lastCheckIn = now;
  user.nextCheckInAt = calculateNextDeadline(user.checkInSchedule, now);
  user.status = 'ACTIVE'; // Auto-recovery from overdue or warning
  user.warningSentAt = null;
  user.gracePeriodExpiresAt = null;
  user.checkInCount = (user.checkInCount || 0) + 1;

  await user.save();

  // Cancel prior scheduled jobs
  await queueService.cancelPendingJobsForUser(user._id);

  // Reschedule fresh BullMQ jobs
  const offsets = user.checkInSchedule?.reminderOffsetsHours || [6, 2];
  for (const offset of offsets) {
    await queueService.scheduleReminder(user._id, user.nextCheckInAt, offset);
  }
  await queueService.scheduleDeadlineMonitoring(user._id, user.nextCheckInAt);

  // Audit
  await AuditLog.create({
    userId: user._id,
    action: 'CHECK_IN_PERFORMED',
    metadata: {
      previousStatus,
      newDeadline: user.nextCheckInAt,
      checkInCount: user.checkInCount,
    },
    ipAddress,
  });

  logger.info(`User ${userId} checked in successfully. Next deadline: ${user.nextCheckInAt.toISOString()}`);

  return {
    success: true,
    message: 'Presence verified. Next check-in deadline has been rescheduled.',
    lastCheckIn: user.lastCheckIn,
    nextCheckInAt: user.nextCheckInAt,
    status: user.status,
    checkInCount: user.checkInCount,
  };
}

module.exports = {
  calculateNextDeadline,
  getScheduleConfig,
  updateScheduleConfig,
  performCheckIn,
};

