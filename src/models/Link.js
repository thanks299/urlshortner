/**
 * src/models/Link.js
 * Mongoose schema for shortened links.
 *
 * Sprint 1 — Core fields: code, url, clicks, expiry
 * Sprint 2 — Analytics embedded via ClickEvent sub-schema
 */

import mongoose from 'mongoose';

// ── Sub-schema: one click event ──────────────────────────────────────────────
const ClickEventSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    ip:        { type: String, default: 'unknown' },
    userAgent: { type: String, default: 'unknown' },
    referer:   { type: String, default: null },
  },
  { _id: false }
);

// ── Main schema ──────────────────────────────────────────────────────────────
const LinkSchema = new mongoose.Schema(
  {
    code: {
      type:     String,
      required: [true, 'Short code is required'],
      unique:   true,
      trim:     true,
      match:    [/^[a-zA-Z0-9_-]{2,30}$/, 'Code must be 2–30 alphanumeric chars'],
      index:    true,
    },
    originalUrl: {
      type:     String,
      required: [true, 'Original URL is required'],
      trim:     true,
    },
    clicks: {
      type:    Number,
      default: 0,
      min:     0,
    },
    expiresAt: {
      type:    Date,
      default: null,
    },
    clickEvents: {
      type:    [ClickEventSchema],
      default: [],
    },
    isActive: {
      type:    Boolean,
      default: true,
      index:   true,
    },
    createdBy: {
      // Placeholder for future auth (Sprint 3)
      type:    String,
      default: null,
    },
  },
  {
    timestamps: true,  // adds createdAt, updatedAt
    versionKey: false,
  }
);

// ── Virtuals ─────────────────────────────────────────────────────────────────

LinkSchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

LinkSchema.virtual('shortUrl').get(function () {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  return `${base}/${this.code}`;
});

// ── Instance methods ─────────────────────────────────────────────────────────

LinkSchema.methods.recordClick = function ({ ip, userAgent, referer } = {}) {
  this.clicks += 1;
  this.clickEvents.push({ ip, userAgent, referer, timestamp: new Date() });
  return this.save();
};

// ── Static methods ───────────────────────────────────────────────────────────

LinkSchema.statics.findByCode = function (code) {
  return this.findOne({ code, isActive: true });
};

// ── Indexes ──────────────────────────────────────────────────────────────────
LinkSchema.index({ originalUrl: 1 });
LinkSchema.index({ createdAt: -1 });
LinkSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $ne: null } } }
);

const Link = mongoose.model('Link', LinkSchema);

export default Link;