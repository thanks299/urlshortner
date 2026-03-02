/**
 * src/controllers/adminController.js
 * Admin/system controllers for maintenance tasks
 */

import linkExpiryService from '../services/linkExpiryService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

class AdminController {
  /**
   * POST /api/admin/check-expiring-links
   * Trigger check for expiring links and send notifications
   * (Protected - only admins/system can call)
   */
  checkExpiringLinks = catchAsync(async (req, res) => {
    const { hoursBeforeExpiry = 24 } = req.body;

    if (!Number.isInteger(hoursBeforeExpiry) || hoursBeforeExpiry < 1) {
      return new AppError('hoursBeforeExpiry must be a positive integer', 400);
    }

    const result = await linkExpiryService.checkAndNotifyExpiringLinks(hoursBeforeExpiry);

    res.status(200).json({
      success: true,
      message: 'Checked for expiring links and sent notifications',
      data: result,
    });
  });

  /**
   * POST /api/admin/cleanup-expired-links
   * Deactivate links that have already expired
   */
  cleanupExpiredLinks = catchAsync(async (req, res) => {
    const result = await linkExpiryService.cleanupExpiredLinks();

    res.status(200).json({
      success: true,
      message: 'Cleaned up expired links',
      data: result,
    });
  });

  /**
   * GET /api/admin/stats
   * Get system statistics
   */
  getStats = catchAsync(async (req, res) => {
    const { Link, User } = await import('../models/Link.js').then(m => ({
      Link: m.default,
    })).then(async m => ({
      Link: m.Link,
      User: (await import('../models/User.js')).default,
    }));

    const [totalLinks, activeLinks, expiredLinks, totalUsers] = await Promise.all([
      Link.countDocuments(),
      Link.countDocuments({ isActive: true }),
      Link.countDocuments({ isActive: false }),
      User.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        links: {
          total: totalLinks,
          active: activeLinks,
          expired: expiredLinks,
        },
        users: totalUsers,
      },
    });
  });
}

export default new AdminController();
