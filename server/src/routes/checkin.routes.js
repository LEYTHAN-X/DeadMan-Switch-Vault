const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkin.controller');
const { protect } = require('../middleware/auth.middleware');

// All check-in management routes require JWT authentication
router.use(protect);

router.get('/config', checkinController.getConfig);
router.put('/config', checkinController.updateConfig);
router.post('/now', checkinController.checkInNow);

module.exports = router;

