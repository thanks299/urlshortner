/**
 * src/gateways/sessionGateway.js
 * Session management gateway - handles session creation, validation, and cleanup
 * with multiple expiration criteria: idle timeout, absolute timeout, and manual termination
 */

import redisClient from '../config/redis.js';
import logger from '../config/logger.js';

class SessionGateway {
  // Default timeout values (in seconds)
  IDLE_TIMEOUT = Number.parseInt(process.env.SESSION_IDLE_TIMEOUT || '900'); // 15 minutes
  ABSOLUTE_TIMEOUT = Number.parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT || '3600'); // 1 hour max session
  REFRESH_WINDOW = Number.parseInt(process.env.SESSION_REFRESH_WINDOW || '300'); // 5 minutes before absolute expiry

  /**
   * Create a new session for user with multiple expiration criteria
   * @param {string} userId - User ID
   * @param {object} metadata - Additional session metadata
   * @returns {Promise<string>} - Session ID
   */
  async createSession(userId, metadata = {}) {
    try {
      const sessionId = `session:${userId}:${Date.now()}:${Math.random().toString(36).substring(2, 11)}`;
      
      const now = new Date().toISOString();
      const sessionData = {
        userId,
        createdAt: now, // Used for absolute timeout
        lastActivity: now, // Used for idle timeout
        ...metadata,
      };

      // Store session in Redis with idle timeout (TTL)
      // This TTL will be refreshed on each activity
      await redisClient.setEx(
        sessionId,
        this.IDLE_TIMEOUT, // TTL in seconds
        JSON.stringify(sessionData)
      );

      logger.info(
        `[SESSION] Created session ${sessionId.substring(0, 30)}... for user ${userId} | ` +
        `Idle Timeout: ${this.IDLE_TIMEOUT}s, Absolute Timeout: ${this.ABSOLUTE_TIMEOUT}s`
      );
      return sessionId;
    } catch (err) {
      logger.error('[SESSION] Error creating session:', err);
      throw err;
    }
  }

  /**
   * Validate session against all expiration criteria
   * @param {string} sessionId - Session ID
   * @returns {Promise<object|null>} - Session data or null if expired
   */
  async validateSession(sessionId) {
    try {
      const sessionData = await redisClient.get(sessionId);
      
      if (!sessionData) {
        logger.info(`[SESSION] Session not found or expired: ${sessionId.substring(0, 30)}...`);
        return null;
      }

      const session = JSON.parse(sessionData);
      const now = new Date();
      const createdAt = new Date(session.createdAt);
      const sessionAge = (now - createdAt) / 1000; // in seconds

      // Check Absolute Timeout: Maximum total session duration
      if (sessionAge > this.ABSOLUTE_TIMEOUT) {
        logger.info(
          `[SESSION] Session expired (ABSOLUTE TIMEOUT): ${sessionId.substring(0, 30)}... ` +
          `Age: ${Math.floor(sessionAge)}s > ${this.ABSOLUTE_TIMEOUT}s`
        );
        await this.destroySession(sessionId);
        return null;
      }

      // Check Idle Timeout: No activity for IDLE_TIMEOUT seconds
      const lastActivity = new Date(session.lastActivity);
      const inactiveTime = (now - lastActivity) / 1000; // in seconds
      if (inactiveTime > this.IDLE_TIMEOUT) {
        logger.info(
          `[SESSION] Session expired (IDLE TIMEOUT): ${sessionId.substring(0, 30)}... ` +
          `Inactive for: ${Math.floor(inactiveTime)}s > ${this.IDLE_TIMEOUT}s`
        );
        await this.destroySession(sessionId);
        return null;
      }

      // Session is valid
      return session;
    } catch (err) {
      logger.error('[SESSION] Error validating session:', err);
      return null;
    }
  }

  /**
   * Refresh session (extend idle timeout and update last activity)
   * Enforces absolute timeout limit with refresh window
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} - Success status
   */
  async refreshSession(sessionId) {
    try {
      const sessionData = await redisClient.get(sessionId);
      
      if (!sessionData) {
        return false;
      }

      const session = JSON.parse(sessionData);
      const now = new Date();
      const createdAt = new Date(session.createdAt);
      const sessionAge = (now - createdAt) / 1000; // in seconds

      // Check if session is nearing absolute timeout
      const timeUntilAbsoluteExpiry = this.ABSOLUTE_TIMEOUT - sessionAge;
      if (timeUntilAbsoluteExpiry < this.REFRESH_WINDOW) {
        logger.warn(
          `[SESSION] Session approaching ABSOLUTE TIMEOUT: ${sessionId.substring(0, 30)}... ` +
          `Time remaining: ${Math.floor(timeUntilAbsoluteExpiry)}s`
        );
        // Could force logout here instead of refreshing
        // For now, we allow one more refresh before expiration
      }

      // Update last activity timestamp
      session.lastActivity = now.toISOString();

      // Refresh the idle timeout TTL
      const ttl = Math.min(this.IDLE_TIMEOUT, Math.ceil(timeUntilAbsoluteExpiry));
      await redisClient.setEx(sessionId, ttl, JSON.stringify(session));

      logger.debug(`[SESSION] Refreshed session ${sessionId.substring(0, 30)}... | TTL: ${ttl}s`);
      return true;
    } catch (err) {
      logger.error('[SESSION] Error refreshing session:', err);
      return false;
    }
  }

  /**
   * Explicitly destroy session (User Logout)
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} - Success status
   */
  async destroySession(sessionId) {
    try {
      const result = await redisClient.del(sessionId);
      if (result > 0) {
        logger.info(`[SESSION] Destroyed session ${sessionId.substring(0, 30)}...`);
      }
      return result > 0;
    } catch (err) {
      logger.error('[SESSION] Error destroying session:', err);
      return false;
    }
  }

  /**
   * Get remaining time to live (TTL) for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<number>} - TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async getSessionTTL(sessionId) {
    try {
      const ttl = await redisClient.ttl(sessionId);
      return ttl;
    } catch (err) {
      logger.error('[SESSION] Error getting session TTL:', err);
      return -1;
    }
  }

  /**
   * Get all sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<string[]>} - Array of session IDs
   */
  async getUserSessions(userId) {
    try {
      const pattern = `session:${userId}:*`;
      const keys = await redisClient.keys(pattern);
      return keys;
    } catch (err) {
      logger.error('[SESSION] Error getting user sessions:', err);
      return [];
    }
  }

  /**
   * Invalidate all sessions for a user (Logout from all devices)
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of sessions destroyed
   */
  async invalidateUserSessions(userId) {
    try {
      const sessions = await this.getUserSessions(userId);
      
      if (sessions.length === 0) {
        return 0;
      }

      await redisClient.del(...sessions);
      logger.info(`[SESSION] Invalidated ${sessions.length} sessions for user ${userId}`);
      return sessions.length;
    } catch (err) {
      logger.error('[SESSION] Error invalidating user sessions:', err);
      return 0;
    }
  }

  /**
   * Get session details for debugging/admin purposes
   * @param {string} sessionId - Session ID
   * @returns {Promise<object|null>} - Session data with metadata
   */
  async getSessionDetails(sessionId) {
    try {
      const sessionData = await redisClient.get(sessionId);
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      const ttl = await this.getSessionTTL(sessionId);
      const now = new Date();
      const createdAt = new Date(session.createdAt);
      const lastActivity = new Date(session.lastActivity);
      
      return {
        ...session,
        ttl, // Time to live in seconds
        age: Math.floor((now - createdAt) / 1000), // Session age in seconds
        inactivity: Math.floor((now - lastActivity) / 1000), // Inactivity time in seconds
      };
    } catch (err) {
      logger.error('[SESSION] Error getting session details:', err);
      return null;
    }
  }

  /**
   * Manually terminate a session (Admin/Manual Intervention)
   * @param {string} sessionId - Session ID to terminate
   * @param {string} reason - Reason for termination
   * @returns {Promise<boolean>} - Success status
   */
  async terminateSession(sessionId, reason = 'Manual termination by admin') {
    try {
      const session = await this.getSessionDetails(sessionId);
      if (session) {
        logger.warn(`[SESSION] MANUAL TERMINATION: ${sessionId.substring(0, 30)}... | Reason: ${reason}`);
      }
      return await this.destroySession(sessionId);
    } catch (err) {
      logger.error('[SESSION] Error terminating session:', err);
      return false;
    }
  }

  /**
   * Clear expired sessions for a user (Cleanup utility)
   * Note: Redis automatically handles TTL expiration, but this can be used for cleanup
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of invalid sessions cleaned up
   */
  async cleanupExpiredSessions(userId) {
    try {
      const sessions = await this.getUserSessions(userId);
      let cleanedCount = 0;

      for (const sessionId of sessions) {
        const session = await this.validateSession(sessionId);
        if (!session) {
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`[SESSION] Cleaned up ${cleanedCount} expired sessions for user ${userId}`);
      }
      return cleanedCount;
    } catch (err) {
      logger.error('[SESSION] Error cleaning up sessions:', err);
      return 0;
    }
  }
}

export default new SessionGateway();
