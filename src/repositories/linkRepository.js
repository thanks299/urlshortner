/**
 * src/repositories/linkRepository.js
 * Data Access Layer — all MongoDB queries live here.
 * Services call this; they never touch Mongoose directly.
 * Makes the service layer easy to unit-test with mocks.
 */

import Link from '../models/Link.js';

class LinkRepository {
  /**
   * Find a link by its short code (active only).
   */
  async findByCode(code) {
    return Link.findByCode(code);
  }

  /**
   * Find by original URL (for deduplication) - scoped to user.
   */
  async findByOriginalUrl(originalUrl, userId) {
    return Link.findOne({ originalUrl, isActive: true, expiresAt: null, createdBy: userId });
  }

  /**
   * Check if a code is already taken.
   */
  async existsByCode(code) {
    return !!(await Link.findOne({ code }));
  }

  /**
   * Persist a new link document.
   */
  async create({ code, originalUrl, expiresAt, createdBy }) {
    const link = new Link({ code, originalUrl, expiresAt, createdBy });
    return link.save();
  }

  /**
   * Increment click count and append a click event atomically.
   * Uses $push + $inc for a single atomic write.
   */
  async recordClick(code, { ip, userAgent, referer } = {}) {
    return Link.findOneAndUpdate(
      { code, isActive: true },
      {
        $inc:  { clicks: 1 },
        $push: {
          clickEvents: {
            $each: [{ timestamp: new Date(), ip, userAgent, referer }],
            $slice: -1000,  // keep last 1000 events per link
          },
        },
      },
      { new: true }
    );
  }

  /**
   * Get all active links for a specific user, sorted by click count desc.
   * Excludes the full clickEvents array for performance.
   */
  async findAll({ page = 1, limit = 50, sortBy = 'clicks', order = 'desc', userId } = {}) {
    const skip       = (page - 1) * limit;
    const sortOrder  = order === 'asc' ? 1 : -1;
    const sortField  = ['clicks', 'createdAt', 'code'].includes(sortBy) ? sortBy : 'clicks';

    const query = { isActive: true };
    if (userId) query.createdBy = userId;

    const [links, total] = await Promise.all([
      Link.find(query)
        .select('-clickEvents')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Link.countDocuments(query),
    ]);

    return { links, total, page, limit };
  }

  /**
   * Get a link with its full click event log - scoped to user.
   */
  async findWithAnalytics(code, userId) {
    return Link.findOne({ code, createdBy: userId }).lean();
  }

  /**
   * Soft-delete: mark isActive = false - scoped to user.
   */
  async softDelete(code, userId) {
    return Link.findOneAndUpdate(
      { code, createdBy: userId },
      { isActive: false },
      { new: true }
    );
  }

  /**
   * Hard-delete (for tests / admin).
   */
  async hardDelete(code) {
    return Link.deleteOne({ code });
  }

  /**
   * Count total documents.
   */
  async count() {
    return Link.countDocuments({ isActive: true });
  }
}

export default new LinkRepository();
