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
import User from '../models/User.js';
import emailService from './emailService.js';

const CODE_LENGTH = Number.parseInt(process.env.CODE_LENGTH, 10) || 7;
const TZ = 'Africa/Lagos'; // GMT+1 year-round

/** Convert a Date to a GMT+1 ISO-like string, e.g. "2026-03-03T12:17:27+01:00" */
function toGMT1(date) {
  if (!date) return null;
  const d = new Date(date);
  // Format parts in GMT+1
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const p = {};
  for (const { type, value } of parts) p[type] = value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+01:00`;
}

class LinkService {

  // ── Helpers ────────────────────────────────────────────────────────────────

  _generateCode(length = CODE_LENGTH) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, b => chars[b % chars.length]).join('');
  }

  _buildShortUrl(code, baseUrl) {
    return `${baseUrl}/${code}`;
  }

  _formatLink(doc, baseUrl) {
    return {
      shortCode:   doc.code,
      shortUrl:    this._buildShortUrl(doc.code, baseUrl),
      originalUrl: doc.originalUrl,
      clicks:      doc.clicks,
      expiresAt:   toGMT1(doc.expiresAt),
      isExpired:   doc.expiresAt ? new Date() > new Date(doc.expiresAt) : false,
      notifyBefore: doc.notifyBefore ?? null,
      createdAt:   toGMT1(doc.createdAt),
      updatedAt:   toGMT1(doc.updatedAt),
    };
  }

  _validateUrl(originalUrl) {
    const trimmed = (originalUrl || '').trim();
    if (!trimmed) throw new AppError('originalUrl is required.', 400);
    if (!validator.isURL(trimmed, { protocols: ['http', 'https'], require_protocol: true })) {
      throw new AppError('Invalid URL. Must start with http:// or https://.', 400);
    }
    return trimmed;
  }

  _validateExpiryDate(expiresAt) {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt);
    if (Number.isNaN(expiryDate.getTime())) throw new AppError('Invalid expiresAt date.', 400);
    if (expiryDate <= new Date()) throw new AppError('expiresAt must be in the future.', 400);
    return expiryDate;
  }

  async _resolveCode(customCode) {
    if (customCode) {
      const code = customCode.trim();
      if (!/^[a-zA-Z0-9_-]{2,30}$/.test(code)) {
        throw new AppError('Custom code: 2–30 alphanumeric chars (- _ allowed).', 400);
      }
      const taken = await repo.existsByCode(code);
      if (taken) throw new AppError(`Code "${code}" is already taken.`, 409);
      return code;
    }
    let code = this._generateCode();
    while (await repo.existsByCode(code)) code = this._generateCode();
    return code;
  }

  // ── Use Cases ──────────────────────────────────────────────────────────────

  async shortenUrl({ originalUrl, customCode, expiresAt, notifyBefore, baseUrl, userId }) {
    const trimmed = this._validateUrl(originalUrl);
    const expiryDate = this._validateExpiryDate(expiresAt);
    const notifyBeforeMinutes = (notifyBefore !== undefined && notifyBefore !== null && expiryDate)
      ? Number(notifyBefore)
      : null;

    if (!customCode && !expiresAt) {
      const existing = await repo.findByOriginalUrl(trimmed, userId);
      if (existing) {
        logger.debug(`Dedup hit for ${trimmed} → ${existing.code}`);
        return { ...this._formatLink(existing, baseUrl), existing: true };
      }
    }

    const code = await this._resolveCode(customCode);
    const link = await repo.create({
      code,
      originalUrl: trimmed,
      expiresAt: expiryDate,
      notifyBefore: notifyBeforeMinutes,
      createdBy: userId,
    });
    logger.info(`Created link: ${code} → ${trimmed}`);

    // Email 1: Always send creation confirmation for links with expiry
    if (expiryDate) {
      this._sendCreationNotification(link, userId).catch(err =>
        logger.error(`[EMAIL] Creation notification failed for ${code}: ${err.message}`)
      );
    }

    return this._formatLink(link, baseUrl);
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
    const { baseUrl = process.env.BASE_URL || 'http://localhost:3000', ...rest } = query;
    const result = await repo.findAll(rest);
    return {
      ...result,
      links: result.links.map(l => this._formatLink(l, baseUrl)),
    };
  }

  async getAnalytics(code, userId, baseUrl = process.env.BASE_URL || 'http://localhost:3000') {
    const link = await repo.findWithAnalytics(code, userId);
    if (!link) throw new AppError(`Link "${code}" not found.`, 404);

    const events = [...(link.clickEvents || [])].reverse();

    return {
      ...this._formatLink(link, baseUrl),
      totalClicks: link.clicks,
      clickEvents: events.map(e => ({
        timestamp: toGMT1(e.timestamp),
        ip:        e.ip,
        userAgent: e.userAgent,
        referer:   e.referer || null,
      })),
    };
  }

  async deleteLink(code, userId) {
    const deleted = await repo.softDelete(code, userId);
    if (!deleted) throw new AppError(`Link "${code}" not found.`, 404);
    logger.info(`Deleted link: ${code}`);
    return { message: `Link "${code}" deleted successfully.` };
  }

  /**
   * Send creation confirmation email for a newly created link.
   * Runs in the background (fire-and-forget via .catch in caller).
   */
  async _sendCreationNotification(link, userId) {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`[EMAIL] User ${userId} not found, skipping creation notification`);
      return;
    }
    const sent = await emailService.sendLinkCreatedNotification(user, link);
    if (sent) {
      const Link = (await import('../models/Link.js')).default;
      await Link.findByIdAndUpdate(link._id, { creationNotificationSent: true });
      logger.info(`[EMAIL] Creation notification sent for ${link.code} to ${user.email}`);
    }
  }
}

export default new LinkService();
