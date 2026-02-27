/**
 * src/controllers/linkController.js
 * HTTP layer — parses req, delegates to service, formats res.
 * No business logic here; just HTTP concerns.
 */

import linkService from '../services/linkService.js';
import catchAsync from '../utils/catchAsync.js';

class LinkController {

  /**
   * POST /api/links
   * Shorten a URL.
   */
  shorten = catchAsync(async (req, res) => {
    const { originalUrl, customCode, expiresAt } = req.body;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const userId = req.user._id; // From auth middleware
    const result = await linkService.shortenUrl({ originalUrl, customCode, expiresAt, baseUrl, userId });
    const status = result.existing ? 200 : 201;
    res.status(status).json({ success: true, data: result });
  });

  /**
   * GET /api/links
   * List all links with pagination.
   */
  list = catchAsync(async (req, res) => {
    const { page = 1, limit = 50, sortBy = 'clicks', order = 'desc' } = req.query;
    const userId = req.user._id; // From auth middleware
    const result = await linkService.listLinks({
      page:   Number.parseInt(page,  10),
      limit:  Number.parseInt(limit, 10),
      sortBy,
      order,
      userId,
    });
    res.status(200).json({ success: true, data: result });
  });

  /**
   * GET /api/links/:code/analytics
   * Click analytics for a specific link.
   */
  analytics = catchAsync(async (req, res) => {
    const userId = req.user._id; // From auth middleware
    const result = await linkService.getAnalytics(req.params.code, userId);
    res.status(200).json({ success: true, data: result });
  });

  /**
   * DELETE /api/links/:code
   * Soft-delete a link.
   */
  remove = catchAsync(async (req, res) => {
    const userId = req.user._id; // From auth middleware
    const result = await linkService.deleteLink(req.params.code, userId);
    res.status(200).json({ success: true, data: result });
  });

  /**
   * GET /api/health
   * Health check endpoint.
   */
  health = catchAsync(async (_req, res) => {
    const { mongoose } = await import('../config/database.js');
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        uptime: process.uptime(),
        mongoState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      },
    });
  });
}

export default new LinkController();
