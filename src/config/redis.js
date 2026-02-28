/**
 * src/config/redis.js
 * Redis client configuration and connection (Redis v4+ API)
 */

import redis from 'redis';
import logger from './logger.js';

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 50, 2000);
      return delay;
    },
  },
});

redisClient.on('connect', () => {
  logger.info('✓ Redis connected');
});

redisClient.on('error', (err) => {
  logger.error('✗ Redis error:', err);
});

redisClient.on('ready', () => {
  logger.info('✓ Redis ready');
});

// Connect to Redis on startup
try {
  await redisClient.connect();
} catch (err) {
  logger.error('✗ Failed to connect to Redis:', err.message);
  process.exit(1);
}

export default redisClient;
