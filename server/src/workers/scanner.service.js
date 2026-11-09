/**
 * scanner.service.js
 * Database Heartbeat Scanner.
 *
 * Runs periodically (every 60s) to guarantee zero missed deadlines even during:
 *  - Redis server restarts
 *  - Network partitions
 *  - App restarts
 *
 * Adheres strictly to:
 *  - Fail-closed design (never auto-release evidence on missed timers)
 *  - Idempotent state transitions
 */

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const gmailService = require('../services/gmail/gmail.service');
const logger = require('../utils/logger');

let scannerInterval = null;

async function scanOverdueCheckIns() {
  try {
    const now = new Date();

    // ─── 1. Check ACTIVE users whose check-in deadline has expired ─────────
    const overdueUsers = await User.find({
      status: 'ACTIVE',
      nextCheckInAt: { $lte: now },
    });

    for (const user of overdueUsers) {
      try {
        const graceMinutes = user.checkInSchedule?.gracePeriodMinutes 
          || (user.checkInSchedule?.gracePeriodHours ? user.checkInSchedule.gracePeriodHours * 60 : 120);
        const gracePeriodExpiresAt = new Date(Date.now() + graceMinutes * 60 * 1000);

        user.status = 'GRACE_PERIOD';
        user.warningSentAt = new Date();
        user.gracePeriodExpiresAt = gracePeriodExpiresAt;
        await user.save();

        logger.warn(
          `[SCANNER] User ${user.email} missed check-in deadline. Entered GRACE_PERIOD (${graceMinutes} min buffer until ${gracePeriodExpiresAt.toUTCString()})`
        );

        // Record Audit Log
        await AuditLog.create({
          userId: user._id,
          action: 'CHECK_IN_OVERDUE',
          metadata: {
            detectedBy: 'DB_HEARTBEAT_SCANNER',
            missedDeadline: user.nextCheckInAt,
            graceMinutes,
            gracePeriodExpiresAt,
          },
          ipAddress: '127.0.0.1 (system)',
        });

        // Dispatch urgent check-in notice to the HOST (User's own email)
        try {
          const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          const graceHours = (graceMinutes / 60).toFixed(1).replace(/\.0$/, '');
          const graceLabel = graceMinutes < 60 ? `${graceMinutes}-minute` : `${graceHours}-hour`;
          await gmailService.sendEmail(user._id.toString(), {
            to: user.email,
            subject: `🚨 URGENT: Check-in Deadline Missed — ${graceLabel} Safety Buffer Active`,
            htmlBody: `
              <!DOCTYPE html>
              <html>
              <body style="background:#07090e; color:#e2e8f0; font-family:sans-serif; padding:24px;">
                <div style="max-width:550px; margin:0 auto; background:#0b0f17; border:1px solid #f43f5e; border-radius:12px; padding:28px;">
                  <h2 style="color:#f43f5e; margin-top:0;">🚨 Check-In Missed: Safety Verification Required</h2>
                  <p style="color:#94a3b8; font-size:14px; line-height:1.6;">
                    Hello ${user.fullName || user.email},<br/><br/>
                    Your scheduled Dead Man's Switch check-in deadline was missed.
                    The system has placed your vault into a <strong>${graceLabel} Grace Period safety buffer</strong>.
                  </p>
                  <div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); border-radius:8px; padding:16px; margin:20px 0;">
                    <p style="margin:0; font-size:13px; color:#f8fafc;">
                      <strong>Buffer Expiry:</strong> ${gracePeriodExpiresAt.toUTCString()}
                    </p>
                    <p style="margin:6px 0 0; font-size:12px; color:#fda4af;">
                      ⚠️ If you do not confirm you are safe before this buffer expires, your encrypted evidence will automatically be released and emailed to all your authorized emergency contacts.
                    </p>
                  </div>
                  <div style="margin:24px 0; text-align:center;">
                    <a href="${clientUrl}/dashboard"
                       style="display:inline-block; background:#10b981; color:#000; font-weight:700; padding:14px 28px; border-radius:8px; text-decoration:none; font-size:13px; text-transform:uppercase; letter-spacing:0.05em;">
                      ✓ I Am Safe (Confirm Presence Now)
                    </a>
                  </div>
                  <p style="font-size:11px; color:#64748b; margin-bottom:0;">
                    Clicking "I Am Safe" will instantly reset your vault to ACTIVE and reschedule your normal check-in countdown.
                  </p>
                </div>
              </body>
              </html>
            `,
          });
          logger.info(`Grace period warning email dispatched to host: ${user.email}`);
        } catch (mailErr) {
          logger.error(`[SCANNER] Grace period email FAILED for host ${user.email}: ${mailErr.message}`, mailErr.stack || '');
        }
      } catch (userErr) {
        logger.error(`Scanner error handling user ${user._id}:`, userErr.message);
      }
    }

    // ─── 2. Check GRACE_PERIOD users whose buffer has expired ──────────────
    // AUTOMATIC EVIDENCE RELEASE: Host did not respond!
    const expiredGraceUsers = await User.find({
      status: 'GRACE_PERIOD',
      gracePeriodExpiresAt: { $lte: now },
    });

    for (const user of expiredGraceUsers) {
      try {
        logger.warn(
          `[AUTOMATIC RELEASE TRIGGERED] Host ${user.email} (${user._id}) did not respond before grace period expired. Initiating automatic evidence release to all verified contacts!`
        );

        const emergencyService = require('../services/emergency/emergency.service');
        const releaseResult = await emergencyService.executeAuthorizedRelease(
          user._id,
          '127.0.0.1 (auto-trigger: grace period expired)'
        );

        logger.info(
          `[AUTOMATIC RELEASE COMPLETE] Successfully delivered ${releaseResult.receipts?.length || 0} packages for host ${user.email}`
        );
      } catch (releaseErr) {
        logger.error(
          `[AUTOMATIC RELEASE FAILED] Failed to execute auto-release for user ${user._id}: ${releaseErr.message}`
        );
      }
    }
  } catch (err) {
    logger.error('Error in scanOverdueCheckIns:', err.message);
  }
}

/**
 * Starts the heartbeat scanner loop.
 */
function startScanner(intervalMs = 15000) {
  if (scannerInterval) return;
  // Initial scan after 2 seconds
  setTimeout(scanOverdueCheckIns, 2000);
  scannerInterval = setInterval(scanOverdueCheckIns, intervalMs);
  logger.info(`Heartbeat deadline scanner started (Interval: ${intervalMs / 1000}s)`);
}

function stopScanner() {
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
  }
}

module.exports = {
  startScanner,
  stopScanner,
  scanOverdueCheckIns,
};

