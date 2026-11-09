require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Initialize Server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start BullMQ background workers and DB scanner
    try {
      const { startCheckInWorkers } = require('./workers/checkin.worker');
      const { startScanner } = require('./workers/scanner.service');
      await startCheckInWorkers();
      startScanner();
    } catch (bgErr) {
      logger.warn('Background worker initialization deferred:', bgErr.message);
    }

    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`DMS Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logger.info(`Health check endpoint accessible at http://localhost:${PORT}/api/health`);
    });

    // Graceful Shutdown Handler
    const shutdown = (signal) => {
      logger.info(`${signal} received. Initiating graceful shutdown...`);
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });

      // Force terminate if graceful shutdown takes too long
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err.message);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Fatal initialization error:', error.message);
    process.exit(1);
  }
};

startServer();

