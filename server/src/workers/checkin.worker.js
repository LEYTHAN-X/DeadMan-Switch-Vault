/**
 * checkin.worker.js
 * BullMQ Worker processors for check-in reminders and deadline monitoring.
 *
 * Implements:
 *  - Strict idempotency & state re-verification before taking action
 *  - Fail-closed behavior (no premature emergency release)
 *  - Audit logging of all background operations
 *  - Graceful connection handling
 */

const { Worker } = require('bullmq');
const { createRedisConnection, pingRedis } = require('../config/redis');
const { QUEUE_NAMES, getQueue } = require('../queues/queue.service');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const gmailService = require('../services/gmail/gmail.service');
const logger = require('../utils/logger');

let reminderWorker = null;
let deadlineWorker = null;

/**
 * Initializes BullMQ workers for check-in monitoring.
 */
async function startCheckInWorkers() {
  const isRedisUp = await pingRedis();
  if (!isRedisUp) {
    logger.warn('Redis is offline: BullMQ workers paused. Database scanner will monitor deadlines.');
    return;
  }

  // ─── 1. Reminder Worker ───────────────────────────────────────────────────
  if (!reminderWorker) {
    reminderWorker = new Worker(
      QUEUE_NAMES.REMINDERS,
      async (job) => {
        const { userId, offsetHours, deadlineTime } = job.data;
        logger.info(`Processing check-in reminder job for user ${userId} (Offset: ${offsetHours}h)`);

        // IDEMPOTENCY CHECK: Re-query user state from MongoDB
        const user = await User.findById(userId);
        if (!user || user.status !== 'ACTIVE') {
          logger.info(`Reminder aborted: user ${userId} is not active (Status: ${user?.status})`);
          return { aborted: true, reason: 'user_not_active' };
        }

        // If the user already checked in and deadline moved into the future
        const currentDeadline = new Date(user.nextCheckInAt).getTime();
        if (currentDeadline > deadlineTime) {
          logger.info(`Reminder aborted: user ${userId} already checked in`);
          return { aborted: true, reason: 'already_checked_in' };
        }

        // Dispatch reminder email via Gmail if account connected
        try {
          const hoursLeft = Math.max(1, Math.round((currentDeadline - Date.now()) / (1000 * 60 * 60)));
          const subject = `⚠️ Dead Man's Switch: Check-in Required in ~${hoursLeft} Hours`;
          const htmlBody = `
            <!DOCTYPE html>
            <html>
            <body style="background:#07090e; color:#e2e8f0; font-family:sans-serif; padding:24px;">
              <div style="max-width:550px; margin:0 auto; background:#0b0f17; border:1px solid #1e293b; border-radius:12px; padding:28px;">
                <h2 style="color:#06b6d4; margin-top:0;">🔐 Check-In Required</h2>
                <p style="color:#94a3b8; font-size:14px; line-height:1.6;">
                  This is an automated safety reminder from your Dead Man's Switch vault.
                  Your next check-in deadline is due in approximately <strong>${hoursLeft} hours</strong> (${new Date(user.nextCheckInAt).toUTCString()}).
                </p>
                <div style="margin:24px 0;">
                  <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard" 
                     style="display:inline-block; background:#06b6d4; color:#000; font-weight:700; padding:12px 24px; border-radius:8px; text-decoration:none; font-size:13px; text-transform:uppercase;">
                    I Am Safe (Check In Now)
                  </a>
                </div>
                <p style="font-size:12px; color:#64748b; margin-bottom:0;">
                  If you are safe, please log in and confirm your presence to reset the countdown. 
                  A missed check-in will trigger your configured emergency grace period.
                </p>
              </div>
            </body>
            </html>
          `;

          await gmailService.sendEmail(userId, {
            to: user.email,
            subject,
            htmlBody,
          });

          await AuditLog.create({
            userId,
            action: 'CHECK_IN_PERFORMED',
            metadata: { type: 'REMINDER_DISPATCHED', offsetHours, deadlineTime },
            ipAddress: '127.0.0.1 (system)',
          });

          logger.info(`Check-in reminder dispatched to ${user.email}`);
        } catch (emailErr) {
          logger.warn(`Reminder email dispatch failed for user ${userId}: ${emailErr.message}`);
        }

        return { success: true };
      },
      {
        connection: createRedisConnection(),
        concurrency: 5,
      }
    );

    reminderWorker.on('failed', (job, err) => {
      logger.error(`Reminder job ${job?.id} failed:`, err.message);
    });
  }

  // ─── 2. Deadline Monitoring Worker ────────────────────────────────────────
  if (!deadlineWorker) {
    deadlineWorker = new Worker(
      QUEUE_NAMES.DEADLINE,
      async (job) => {
        const { userId, deadlineTime } = job.data;
        logger.info(`Processing deadline overdue job for user ${userId}`);

        // IDEMPOTENCY CHECK: Recheck user state from MongoDB
        const user = await User.findById(userId);
        if (!user || user.status !== 'ACTIVE') {
          return { aborted: true, reason: 'not_active' };
        }

        // Did user check in recently?
        if (new Date(user.nextCheckInAt).getTime() > deadlineTime) {
          logger.info(`Deadline check aborted: user ${userId} checked in before execution`);
          return { aborted: true, reason: 'checked_in_in_time' };
        }

        // Transition state from ACTIVE -> GRACE_PERIOD
        const graceHours = user.checkInSchedule?.gracePeriodHours || 2;
        const gracePeriodExpiresAt = new Date(Date.now() + graceHours * 3600 * 1000);

        user.status = 'GRACE_PERIOD';
        user.warningSentAt = new Date();
        user.gracePeriodExpiresAt = gracePeriodExpiresAt;
        await user.save();

        logger.warn(
          `User ${userId} missed check-in deadline! State transitioned to GRACE_PERIOD (${graceHours}h buffer)`
        );

        // Audit Log
        await AuditLog.create({
          userId,
          action: 'CHECK_IN_OVERDUE',
          metadata: {
            missedDeadline: user.nextCheckInAt,
            gracePeriodHours: graceHours,
            gracePeriodExpiresAt,
          },
          ipAddress: '127.0.0.1 (system)',
        });

        // Send urgent warning email to user's registered address (the HOST)
        try {
          const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          const subject = `🚨 URGENT: Check-in Deadline Missed — ${graceHours}h Safety Buffer Active`;
          const htmlBody = `
            <!DOCTYPE html>
            <html>
            <body style="background:#07090e; color:#e2e8f0; font-family:sans-serif; padding:24px;">
              <div style="max-width:550px; margin:0 auto; background:#0b0f17; border:1px solid #f43f5e; border-radius:12px; padding:28px;">
                <h2 style="color:#f43f5e; margin-top:0;">🚨 Check-in Overdue</h2>
                <p style="color:#94a3b8; font-size:14px; line-height:1.6;">
                  Hello ${user.fullName},<br/><br/>
                  Your Dead Man's Switch deadline expired at <strong>${new Date(user.nextCheckInAt).toUTCString()}</strong>.
                </p>
                <div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); border-radius:8px; padding:16px; margin:18px 0;">
                  <strong style="color:#f43f5e; font-size:13px;">GRACE PERIOD SAFETY BUFFER:</strong>
                  <p style="color:#cbd5e1; font-size:12px; margin:4px 0 0;">
                    You have <strong>${graceHours} hours</strong> (until ${gracePeriodExpiresAt.toUTCString()}) to verify your presence.
                    If you do not confirm safety before this expires, your encrypted evidence will automatically be dispatched to all authorized emergency contacts.
                  </p>
                </div>
                <div style="margin:24px 0; text-align:center;">
                  <a href="${clientUrl}/dashboard" 
                     style="display:inline-block; background:#10b981; color:#000; font-weight:700; padding:14px 28px; border-radius:8px; text-decoration:none; font-size:13px; text-transform:uppercase;">
                    ✓ I Am Safe (Confirm Presence Now)
                  </a>
                </div>
              </div>
            </body>
            </html>
          `;

          await gmailService.sendEmail(userId, {
            to: user.email,
            subject,
            htmlBody,
          });
        } catch (mailErr) {
          logger.warn(`Urgent overdue email failed for ${userId}: ${mailErr.message}`);
        }

        return { transitioned: true, state: 'GRACE_PERIOD' };
      },
      {
        connection: createRedisConnection(),
        concurrency: 5,
      }
    );

    deadlineWorker.on('failed', (job, err) => {
      logger.error(`Deadline monitoring job ${job?.id} failed:`, err.message);
    });
  }

  logger.info('BullMQ Check-In workers active.');
}

module.exports = {
  startCheckInWorkers,
};

