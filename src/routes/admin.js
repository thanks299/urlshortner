/**
 * src/routes/admin.js
 * Admin routes for system maintenance and tasks
 */

import { Router } from 'express';
import adminController from '../controllers/adminController.js';

const router = Router();

/**
 * Admin routes - should be protected with admin middleware
 * For now, they require authentication (protect middleware is applied at app level)
 */

// Check for expiring links and send notifications
router.post('/check-expiring-links', adminController.checkExpiringLinks);

// Clean up expired links
router.post('/cleanup-expired-links', adminController.cleanupExpiredLinks);

// System statistics
router.get('/stats', adminController.getStats);

export default router;
