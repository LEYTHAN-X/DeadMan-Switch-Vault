const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergency.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/status', emergencyController.getStatus);
router.post('/cancel', emergencyController.cancelEmergency);
router.post('/verify', emergencyController.verifyCode);
router.post('/approve', emergencyController.approveRelease);
router.post('/execute-release', emergencyController.executeRelease);
router.post('/simulate-escalation', emergencyController.simulateEscalation);

module.exports = router;

