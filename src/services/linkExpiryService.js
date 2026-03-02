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
   * Check for links expiring within the notification window
   * and send notifications to their owners
   * @param {number} hoursBeforeExpiry - Hours before expiry to send notification (default: 24)
   * @returns {Promise<object>} - Result with counts
   */
  async checkAndNotifyExpiringLinks(hoursBeforeExpiry = 24) {
    try {
      const now = new Date();
      const expiryWindow = new Date(now.getTime() + hoursBeforeExpiry * 60 * 60 * 1000);

      // Find links that:
      // 1. Are still active
      // 2. Have an expiry date
      // 3. Expire within the notification window
      // 4. Haven't had a notification sent yet
      const expiringLinks = await Link.find({
        isActive: true,
        expiresAt: { $exists: true, $ne: null },
        $expr: {
          $and: [
            { $gte: ['$expiresAt', now] }, // Not already expired
            { $lte: ['$expiresAt', expiryWindow] }, // Within notification window
          ],
        },
        notificationSent: { $not: { $eq: true } }, // Notification not yet sent
      });

      logger.info(`[EXPIRY] Found ${expiringLinks.length} links expiring within ${hoursBeforeExpiry} hours`);

      let successCount = 0;
      let failureCount = 0;

      for (const link of expiringLinks) {
        try {
          // Get the user who created this link
          const user = await User.findById(link.createdBy);
          if (!user) {
            logger.warn(`[EXPIRY] User not found for link ${link.code}`);
            failureCount++;
            continue;
          }

          // Send notification email
          const sent = await emailService.sendLinkExpiryNotification(user, link);
          
          if (sent) {
            // Mark notification as sent
            await Link.findByIdAndUpdate(link._id, { notificationSent: true });
            successCount++;
          } else {
            failureCount++;
          }
        } catch (err) {
          logger.error(`[EXPIRY] Error processing link ${link.code}:`, err.message);
          failureCount++;
        }
      }

      const result = {
        checkedAt: now.toISOString(),
        linksFound: expiringLinks.length,
        notificationsSent: successCount,
        notificationsFailed: failureCount,
      };

      logger.info(`[EXPIRY] Notification run complete:`, result);
      return result;
    } catch (err) {
      logger.error('[EXPIRY] Error in checkAndNotifyExpiringLinks:', err.message);
      return {
        checkedAt: new Date().toISOString(),
        error: err.message,
      };
    }
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
