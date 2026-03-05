/**
 * src/services/linkExpiryService.js
 * Service to check for expiring links and send notifications
 */

import Link from '../models/Link.js';
import User from '../models/User.js';
import emailService from './emailService.js';
import logger from '../config/logger.js';

class LinkExpiryService {
  /**
   * Run all notification checks:
   *   Email 2 — pre-expiry (based on each link's notifyBefore setting)
   *   Email 3 — post-expiry (2 minutes after the link expires)
   * @returns {Promise<object>}
   */
  async checkAndNotifyExpiringLinks() {
    const preResult = await this._sendPreExpiryNotifications();
    const postResult = await this._sendPostExpiryNotifications();

    return {
      checkedAt: new Date().toISOString(),
      preExpiry: preResult,
      postExpiry: postResult,
    };
  }

  /**
   * Email 2 — Send pre-expiry notifications based on each link's notifyBefore.
   */
  async _sendPreExpiryNotifications() {
    let successCount = 0;
    let failureCount = 0;

    try {
      const now = new Date();

      const candidates = await Link.find({
        isActive: true,
        expiresAt: { $exists: true, $ne: null },
        notifyBefore: { $exists: true, $ne: null, $gt: 0 },
        notificationSent: { $ne: true },
      });

      const linksToNotify = candidates.filter(link => {
        const expiresAt = new Date(link.expiresAt);
        if (expiresAt <= now) return false;
        const notifyAt = new Date(expiresAt.getTime() - link.notifyBefore * 60 * 1000);
        return now >= notifyAt;
      });

      logger.info(`[EXPIRY] Pre-expiry: ${linksToNotify.length} links ready (${candidates.length} candidates)`);

      for (const link of linksToNotify) {
        try {
          const user = await User.findById(link.createdBy);
          if (!user) { failureCount++; continue; }

          const sent = await emailService.sendLinkExpiryNotification(user, link);
          if (sent) {
            await Link.findByIdAndUpdate(link._id, {
              notificationSent: true,
              notificationSentAt: new Date(),
            });
            successCount++;
          } else {
            failureCount++;
          }
        } catch (err) {
          logger.error(`[EXPIRY] Pre-expiry error for ${link.code}:`, err.message);
          failureCount++;
        }
      }
    } catch (err) {
      logger.error('[EXPIRY] Pre-expiry check failed:', err.message);
    }

    return { sent: successCount, failed: failureCount };
  }

  /**
   * Email 3 — Send post-expiry notifications 2 minutes after a link expires.
   */
  async _sendPostExpiryNotifications() {
    let successCount = 0;
    let failureCount = 0;

    try {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

      // Links that have expired (expiresAt <= 2 minutes ago) and haven't been notified yet
      const expiredLinks = await Link.find({
        expiresAt: { $exists: true, $ne: null, $lte: twoMinutesAgo },
        expiryNotificationSent: { $ne: true },
      });

      logger.info(`[EXPIRY] Post-expiry: ${expiredLinks.length} expired links to notify`);

      for (const link of expiredLinks) {
        try {
          const user = await User.findById(link.createdBy);
          if (!user) { failureCount++; continue; }

          const sent = await emailService.sendLinkExpiredNotification(user, link);
          if (sent) {
            await Link.findByIdAndUpdate(link._id, { expiryNotificationSent: true });
            successCount++;
          } else {
            failureCount++;
          }
        } catch (err) {
          logger.error(`[EXPIRY] Post-expiry error for ${link.code}:`, err.message);
          failureCount++;
        }
      }
    } catch (err) {
      logger.error('[EXPIRY] Post-expiry check failed:', err.message);
    }

    return { sent: successCount, failed: failureCount };
  }

  /**
   * Clean up expired links (optional - can be run periodically)
   * Deletes or soft-deletes expired links
   * @returns {Promise<object>} - Result with counts
   */
  async cleanupExpiredLinks() {
    try {
      const now = new Date();
      const result = await Link.updateMany(
        {
          isActive: true,
          expiresAt: { $exists: true, $lte: now },
        },
        {
          isActive: false,
          expiredAt: now,
        }
      );

      logger.info(`[EXPIRY] Cleaned up ${result.modifiedCount} expired links`);
      return {
        cleanedAt: now.toISOString(),
        linksDeactivated: result.modifiedCount,
      };
    } catch (err) {
      logger.error('[EXPIRY] Error in cleanupExpiredLinks:', err.message);
      return {
        error: err.message,
      };
    }
  }
}

export default new LinkExpiryService();
