const express = require('express');
const router = express.Router();
const { getHealthStatus } = require('../controllers/health.controller');

/**
 * @route GET /api/health
 * @desc  System & Database health status
 * @access Public
 */
router.get('/', getHealthStatus);

module.exports = router;

