const { getDBStatus } = require('../config/db');

/**
 * Health check controller
 * @route GET /api/health
 */
const getHealthStatus = (req, res) => {
  const dbStatus = getDBStatus();
  const uptimeSeconds = Math.floor(process.uptime());

  const healthData = {
    status: dbStatus.isConnected ? 'healthy' : 'degraded',
    service: 'Digital Dead Man Switch API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      database: dbStatus,
    },
  };

  const statusCode = dbStatus.isConnected ? 200 : 503;
  res.status(statusCode).json(healthData);
};

module.exports = {
  getHealthStatus,
};

