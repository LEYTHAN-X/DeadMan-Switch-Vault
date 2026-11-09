const express = require('express');
const router = express.Router();
const evidenceController = require('../controllers/evidence.controller');
const { protect } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { uploadLimiter } = require('../middleware/rateLimit.middleware');

/**
 * All evidence endpoints require authentication
 */
router.use(protect);

router.post('/upload', uploadLimiter, upload.single('file'), evidenceController.uploadFile);
router.get('/', evidenceController.listUserEvidence);
router.get('/:id', evidenceController.getEvidence);
router.get('/:id/download', evidenceController.downloadFile);
router.delete('/:id', evidenceController.removeEvidence);

module.exports = router;

