const AuditLog = require('../models/AuditLog');

// Action categories mapping
const CATEGORY_MAP = {
  AUTH: [
    'USER_REGISTERED',
    'USER_LOGIN',
    'USER_LOGIN_FAILED',
    'USER_LOGOUT',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED',
    'ACCOUNT_LOCKED',
  ],
  EVIDENCE: [
    'EVIDENCE_UPLOADED',
    'EVIDENCE_DOWNLOADED',
    'EVIDENCE_DELETED',
    'EVIDENCE_ACCESS_DENIED',
  ],
  CONTACTS: [
    'CONTACT_ADDED',
    'CONTACT_UPDATED',
    'CONTACT_DELETED',
    'CONTACT_VERIFIED',
    'CONTACT_VERIFICATION_RESENT',
    'CONTACT_EVIDENCE_ASSIGNED',
  ],
  GMAIL: [
    'GMAIL_CONNECTED',
    'GMAIL_DISCONNECTED',
    'GMAIL_TEST_EMAIL_SENT',
    'GMAIL_EMAIL_SENT',
    'GMAIL_EMAIL_FAILED',
    'GMAIL_TOKEN_REFRESHED',
  ],
  EMERGENCY: [
    'CHECK_IN_PERFORMED',
    'CHECK_IN_OVERDUE',
    'EMERGENCY_WORKFLOW_STARTED',
    'EMERGENCY_WORKFLOW_CANCELLED',
    'EMERGENCY_STAGE_TRANSITIONED',
    'EMERGENCY_EVIDENCE_RELEASED',
    'EMERGENCY_RECOVERY',
  ],
};

/**
 * GET /api/audit
 * Returns paginated audit logs for the authenticated operator with filtering.
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { userId };

    // Filter by Category
    if (req.query.category && CATEGORY_MAP[req.query.category.toUpperCase()]) {
      query.action = { $in: CATEGORY_MAP[req.query.category.toUpperCase()] };
    }

    // Filter by Action exact match
    if (req.query.action) {
      query.action = req.query.action;
    }

    // Keyword search
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query.$or = [
        { action: regex },
        { ipAddress: regex },
        { 'metadata.type': regex },
        { 'metadata.fileName': regex },
        { 'metadata.to': regex },
        { 'metadata.contactName': regex },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    // Sanitize any metadata to ensure secrets are strictly shielded
    const sanitizedLogs = logs.map((log) => ({
      _id: log._id,
      action: log.action,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata || {},
      success: log.success !== false,
      createdAt: log.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: sanitizedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/audit/stats
 * Telemetry summary of security events.
 */
const getAuditStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [totalEvents, loginsCount, evidenceOpsCount, emergencyTransitionsCount] =
      await Promise.all([
        AuditLog.countDocuments({ userId }),
        AuditLog.countDocuments({ userId, action: { $in: ['USER_LOGIN', 'USER_LOGIN_FAILED'] } }),
        AuditLog.countDocuments({
          userId,
          action: { $in: ['EVIDENCE_UPLOADED', 'EVIDENCE_DOWNLOADED', 'EVIDENCE_DELETED'] },
        }),
        AuditLog.countDocuments({
          userId,
          action: { $in: ['EMERGENCY_STAGE_TRANSITIONED', 'EMERGENCY_WORKFLOW_CANCELLED'] },
        }),
      ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalEvents,
        loginsCount,
        evidenceOpsCount,
        emergencyTransitionsCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/audit/export
 * Exports the complete user audit trail as downloadable JSON or CSV.
 */
const exportAuditLogs = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const logs = await AuditLog.find({ userId }).sort({ createdAt: -1 }).lean();

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="dms_audit_log_${new Date().toISOString().slice(0, 10)}.csv"`
      );

      const headers = ['Timestamp', 'Action', 'IP Address', 'Success', 'Metadata Summary'];
      const rows = logs.map((l) => [
        `"${new Date(l.createdAt).toISOString()}"`,
        `"${l.action}"`,
        `"${l.ipAddress || 'unknown'}"`,
        l.success !== false ? 'true' : 'false',
        `"${JSON.stringify(l.metadata || {}).replace(/"/g, '""')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return res.send(csvContent);
    }

    // Default: JSON export
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dms_audit_log_${new Date().toISOString().slice(0, 10)}.json"`
    );
    return res.json({
      vault: "Digital Dead Man's Switch",
      exportedAt: new Date().toISOString(),
      user: req.user.email,
      totalRecords: logs.length,
      logs: logs.map((l) => ({
        timestamp: l.createdAt,
        action: l.action,
        ipAddress: l.ipAddress,
        metadata: l.metadata,
      })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs,
  getAuditStats,
  exportAuditLogs,
};
