const express = require('express');
const router = express.Router();
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const evidenceRoutes = require('./evidence.routes');
const contactRoutes = require('./contact.routes');
const gmailRoutes = require('./gmail.routes');
const checkinRoutes = require('./checkin.routes');
const emergencyRoutes = require('./emergency.routes');
const auditRoutes = require('./audit.routes');

// Mount routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/evidence', evidenceRoutes);
router.use('/contacts', contactRoutes);
router.use('/gmail', gmailRoutes);
router.use('/checkin', checkinRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/audit', auditRoutes);

module.exports = router;

