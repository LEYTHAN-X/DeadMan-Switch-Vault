const mongoose = require('mongoose');
const dns = require('dns');
const logger = require('../utils/logger');

let isConnected = false;

/**
 * Connect to MongoDB instance with resilient connection parameters.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/deadman_switch';

  // For MongoDB Atlas mongodb+srv URIs on networks where ISP DNS fails SRV lookups:
  if (mongoUri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (e) {
      // Fallback to default if setServers isn't supported
    }
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    logger.info(`MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB runtime connection error:', err.message);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB connection lost. Attempting to reconnect...');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully.');
      isConnected = true;
    });

    return conn;
  } catch (error) {
    isConnected = false;
    logger.error(`Initial MongoDB connection failed: ${error.message}`);
    // In dev mode, we log and keep server alive so health-check can report DB down
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

/**
 * Returns current MongoDB connection status.
 */
const getDBStatus = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const stateCode = mongoose.connection.readyState;
  return {
    state: states[stateCode] || 'unknown',
    isConnected: stateCode === 1,
  };
};

module.exports = {
  connectDB,
  getDBStatus,
};

