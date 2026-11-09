const IORedis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;
let isConnected = false;

/**
 * Creates connection options for Redis based on environment configuration.
 * Supports REDIS_URL or host/port/password.
 */
function getRedisOptions() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    enableOfflineQueue: false, // Don't hang commands when offline
    connectTimeout: 2000,
    retryStrategy(times) {
      // Reconnect with exponential backoff up to 10 seconds
      const delay = Math.min(times * 500, 10000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.slice(0, targetError.length) === targetError) {
        return true;
      }
      return false;
    },
  };
}

/**
 * Get or initialize the singleton Redis client.
 */
function getRedisClient() {
  if (!redisClient) {
    const opts = getRedisOptions();
    redisClient = typeof opts === 'string' ? new IORedis(opts, { maxRetriesPerRequest: null }) : new IORedis(opts);

    redisClient.on('connect', () => {
      logger.info('Redis connection established.');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready for BullMQ queue operations.');
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Friendly message if local Redis is down
      if (err.code === 'ECONNREFUSED') {
        logger.warn('Redis is offline or unreachable at ' + (process.env.REDIS_HOST || '127.0.0.1') + ':' + (process.env.REDIS_PORT || '6379') + '. BullMQ background queues will retry when Redis is available.');
      } else {
        logger.error('Redis connection error:', err.message);
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });
  }

  return redisClient;
}

/**
 * Creates a duplicate connection for BullMQ Workers or Queues.
 * BullMQ requires separate client instances for blocking operations.
 */
function createRedisConnection() {
  const opts = getRedisOptions();
  const client = typeof opts === 'string' ? new IORedis(opts, { maxRetriesPerRequest: null }) : new IORedis(opts);

  client.on('error', (err) => {
    if (err.code !== 'ECONNREFUSED') {
      logger.error('BullMQ Redis connection error:', err.message);
    }
  });

  return client;
}

/**
 * Check if Redis is currently connected and responsive.
 */
async function pingRedis() {
  if (!redisClient || !isConnected || redisClient.status !== 'ready') {
    return false;
  }
  try {
    const res = await redisClient.ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}

function getRedisStatus() {
  return {
    isConnected,
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  };
}

module.exports = {
  getRedisClient,
  createRedisConnection,
  getRedisOptions,
  pingRedis,
  getRedisStatus,
};
