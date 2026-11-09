const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/', auditController.getAuditLogs);
router.get('/stats', auditController.getAuditStats);
router.get('/export', auditController.exportAuditLogs);

module.exports = router;

