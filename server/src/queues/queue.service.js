/**
 * queue.service.js
 * BullMQ Queue manager for Digital Dead Man's Switch.
 *
 * Manages specialized background queues:
 *  - checkin-reminders: Schedules reminder notices before deadlines
 *  - deadline-monitoring: Checks for missed deadlines and transitions to OVERDUE
 *  - grace-period: Monitors the active grace period
 *  - verification: Manages multi-stage emergency confirmation checks
 *  - evidence-delivery: Dispatches authorized evidence packages via Gmail API
 *
 * Implements:
 *  - Idempotent Job IDs (prevents duplicate jobs)
 *  - Removal of stale scheduled jobs on check-in
 *  - Exponential retry and backoff
 *  - Fallback safety if Redis is temporarily offline
 */

const { Queue } = require('bullmq');
const { createRedisConnection, pingRedis } = require('../config/redis');
const logger = require('../utils/logger');

// Queue definitions
const QUEUE_NAMES = {
  REMINDERS: 'dms-checkin-reminders',
  DEADLINE: 'dms-deadline-monitoring',
  GRACE_PERIOD: 'dms-grace-period',
  VERIFICATION: 'dms-verification',
  EVIDENCE_DELIVERY: 'dms-evidence-delivery',
};

const queues = {};

/**
 * Initializes or retrieves a BullMQ queue instance.
 */
function getQueue(queueName) {
  if (!queues[queueName]) {
    try {
      const connection = createRedisConnection();
      queues[queueName] = new Queue(queueName, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24h for audit
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      });
      logger.info(`BullMQ Queue initialized: ${queueName}`);
    } catch (err) {
      logger.error(`Failed to initialize queue ${queueName}:`, err.message);
    }
  }
  return queues[queueName];
}

/**
 * Schedules a check-in reminder job.
 * Job triggers `reminderOffsetsHours` before the next check-in deadline.
 *
 * @param {string} userId
 * @param {Date} nextCheckInAt
 * @param {number} offsetHours
 */
async function scheduleReminder(userId, nextCheckInAt, offsetHours = 6) {
  try {
    const isRedisUp = await pingRedis();
    if (!isRedisUp) {
      logger.warn('Redis offline: skipping BullMQ reminder schedule (DB-backed scheduler active)');
      return null;
    }

    const queue = getQueue(QUEUE_NAMES.REMINDERS);
    const deadlineTime = new Date(nextCheckInAt).getTime();
    const reminderTime = deadlineTime - offsetHours * 60 * 60 * 1000;
    const delay = Math.max(0, reminderTime - Date.now());

    // Idempotent Job ID: ensures only 1 reminder per offset per deadline
    const jobId = `reminder:${userId}:${offsetHours}h:${deadlineTime}`;

    // Remove any previous job with same ID
    try {
      const existing = await queue.getJob(jobId);
      if (existing) await existing.remove();
    } catch (_) {}

    const job = await queue.add(
      'send-reminder',
      {
        userId: userId.toString(),
        offsetHours,
        deadlineTime,
      },
      {
        jobId,
        delay,
      }
    );

    logger.info(`Scheduled check-in reminder for user ${userId} in ${Math.round(delay / 60000)} minutes`, {
      jobId,
      offsetHours,
    });
    return job;
  } catch (err) {
    logger.error('Failed to schedule reminder job:', err.message);
    return null;
  }
}

/**
 * Schedules a deadline monitoring job.
 * Triggers exactly when `nextCheckInAt` arrives.
 *
 * @param {string} userId
 * @param {Date} nextCheckInAt
 */
async function scheduleDeadlineMonitoring(userId, nextCheckInAt) {
  try {
    const isRedisUp = await pingRedis();
    if (!isRedisUp) {
      logger.warn('Redis offline: skipping BullMQ deadline schedule');
      return null;
    }

    const queue = getQueue(QUEUE_NAMES.DEADLINE);
    const deadlineTime = new Date(nextCheckInAt).getTime();
    const delay = Math.max(0, deadlineTime - Date.now());

    // Single active deadline job per user
    const jobId = `deadline:${userId}:${deadlineTime}`;

    // Cancel old deadline jobs for this user
    try {
      const existing = await queue.getJob(jobId);
      if (existing) await existing.remove();
    } catch (_) {}

    const job = await queue.add(
      'check-deadline-overdue',
      {
        userId: userId.toString(),
        deadlineTime,
      },
      {
        jobId,
        delay,
      }
    );

    logger.info(`Scheduled deadline monitoring for user ${userId} in ${Math.round(delay / 60000)} minutes`, {
      jobId,
    });
    return job;
  } catch (err) {
    logger.error('Failed to schedule deadline monitoring job:', err.message);
    return null;
  }
}

/**
 * Cancels all pending reminder and deadline jobs for a user upon successful check-in.
 *
 * @param {string} userId
 */
async function cancelPendingJobsForUser(userId) {
  try {
    const isRedisUp = await pingRedis();
    if (!isRedisUp) return;

    const uId = userId.toString();
    const reminderQueue = getQueue(QUEUE_NAMES.REMINDERS);
    const deadlineQueue = getQueue(QUEUE_NAMES.DEADLINE);

    // Cancel pending delayed jobs in both queues
    for (const q of [reminderQueue, deadlineQueue]) {
      if (!q) continue;
      const delayed = await q.getDelayed();
      for (const j of delayed) {
        if (j.data?.userId === uId) {
          await j.remove();
          logger.info(`Cancelled scheduled job ${j.id} for user ${uId}`);
        }
      }
    }
  } catch (err) {
    logger.error('Failed to cancel pending jobs:', err.message);
  }
}

module.exports = {
  QUEUE_NAMES,
  getQueue,
  scheduleReminder,
  scheduleDeadlineMonitoring,
  cancelPendingJobsForUser,
};

