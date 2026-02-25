/**
 * src/services/linkService.js
 * Business Logic Layer — orchestrates repositories, enforces rules.
 * Controllers call this; never touches DB directly.
 */

import crypto from 'node:crypto';
import validator from 'validator';
import repo from '../repositories/linkRepository.js';
import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';

const CODE_LENGTH = Number.parseInt(process.env.CODE_LENGTH, 10) || 7;
const BASE_URL    = process.env.BASE_URL || 'http://localhost:3000';

class LinkService {

  // ── Helpers ────────────────────────────────────────────────────────────────

  _generateCode(length = CODE_LENGTH) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, b => chars[b % chars.length]).join('');
  }

  _buildShortUrl(code) {
    return `${BASE_URL}/${code}`;
  }

  _formatLink(doc) {
    return {
      shortCode:   doc.code,
      shortUrl:    this._buildShortUrl(doc.code),
      originalUrl: doc.originalUrl,
      clicks:      doc.clicks,
      expiresAt:   doc.expiresAt || null,
      isExpired:   doc.expiresAt ? new Date() > new Date(doc.expiresAt) : false,
      createdAt:   doc.createdAt,
      updatedAt:   doc.updatedAt,
    };
  }

  // ── Use Cases ──────────────────────────────────────────────────────────────

  async shortenUrl({ originalUrl, customCode, expiresAt }) {
    const trimmed = (originalUrl || '').trim();
    if (!trimmed) throw new AppError('originalUrl is required.', 400);
    if (!validator.isURL(trimmed, { protocols: ['http', 'https'], require_protocol: true })) {
      throw new AppError('Invalid URL. Must start with http:// or https://.', 400);
    }

    let expiryDate = null;
    if (expiresAt) {
      expiryDate = new Date(expiresAt);
      if (Number.isNaN(expiryDate.getTime())) throw new AppError('Invalid expiresAt date.', 400);
      if (expiryDate <= new Date())    throw new AppError('expiresAt must be in the future.', 400);
    }

    if (!customCode && !expiresAt) {
      const existing = await repo.findByOriginalUrl(trimmed);
      if (existing) {
        logger.debug(`Dedup hit for ${trimmed} → ${existing.code}`);
        return { ...this._formatLink(existing), existing: true };
      }
    }

    let code;
    if (customCode) {
      code = customCode.trim();
      if (!/^[a-zA-Z0-9_-]{2,30}$/.test(code)) {
        throw new AppError('Custom code: 2–30 alphanumeric chars (- _ allowed).', 400);
      }
      const taken = await repo.existsByCode(code);
      if (taken) throw new AppError(`Code "${code}" is already taken.`, 409);
    } else {
      code = this._generateCode();
      while (await repo.existsByCode(code)) code = this._generateCode();
    }

    const link = await repo.create({ code, originalUrl: trimmed, expiresAt: expiryDate });
    logger.info(`Created link: ${code} → ${trimmed}`);
    return this._formatLink(link);
  }

  async resolveCode(code, clickMeta = {}) {
    const link = await repo.findByCode(code);

    if (!link) throw new AppError('Short link not found.', 404);

    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new AppError('This link has expired.', 410);
    }

    repo.recordClick(code, clickMeta).catch(err =>
      logger.error(`Failed to record click for ${code}: ${err.message}`)
    );

    return link.originalUrl;
  }

  async listLinks(query = {}) {
    const result = await repo.findAll(query);
    return {
      ...result,
      links: result.links.map(l => this._formatLink(l)),
    };
  }

  async getAnalytics(code) {
    const link = await repo.findWithAnalytics(code);
    if (!link) throw new AppError(`Link "${code}" not found.`, 404);

    const events = [...(link.clickEvents || [])].reverse();

    return {
      ...this._formatLink(link),
      totalClicks: link.clicks,
      clickEvents: events.map(e => ({
        timestamp: e.timestamp,
        ip:        e.ip,
        userAgent: e.userAgent,
        referer:   e.referer || null,
      })),
    };
  }

  async deleteLink(code) {
    const deleted = await repo.softDelete(code);
    if (!deleted) throw new AppError(`Link "${code}" not found.`, 404);
    logger.info(`Deleted link: ${code}`);
    return { message: `Link "${code}" deleted successfully.` };
  }
}

export default new LinkService();
