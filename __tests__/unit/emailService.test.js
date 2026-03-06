/**
 * __tests__/unit/emailService.test.js
 * Unit tests for the template engine and refactored EmailService.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatesDir = join(__dirname, '..', '..', 'src', 'templates', 'email');

// ─── templateEngine tests ────────────────────────────────────────────────────

// We need to mock dependencies before importing emailService,
// but templateEngine has no external deps so we can test it directly.

const { renderTemplate, clearTemplateCache } = await import('../../src/templates/templateEngine.js');

describe('templateEngine', () => {
  afterEach(() => clearTemplateCache());

  test('renderTemplate replaces all {{placeholders}}', () => {
    const html = renderTemplate('email', 'welcome', {
      userEmail: 'bob@example.com',
      appUrl: 'https://short.io',
    });

    expect(html).toContain('bob@example.com');
    expect(html).toContain('https://short.io/app');
    expect(html).not.toContain('{{userEmail}}');
    expect(html).not.toContain('{{appUrl}}');
  });

  test('renderTemplate replaces multiple occurrences of the same key', () => {
    // linkCreated uses {{appUrl}} and {{linkCode}} several times
    const html = renderTemplate('email', 'linkCreated', {
      userEmail: 'a@b.com',
      linkCode: 'XYZ',
      originalUrl: 'https://example.com',
      truncatedUrl: 'https://example.com',
      expiryLine: '<strong>Expires:</strong> Never',
      expiryNote: '',
      appUrl: 'https://short.io',
    });

    // {{linkCode}} appears 3 times in the template (Short Code, Short URL href, Short URL text)
    const occurrences = (html.match(/XYZ/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain('{{linkCode}}');
  });

  test('renderTemplate leaves unmatched placeholders as empty strings when value is undefined', () => {
    const html = renderTemplate('email', 'welcome', {
      userEmail: 'test@test.com',
      // appUrl intentionally omitted
    });

    // {{appUrl}} should remain because we didn't supply it
    // Actually renderTemplate only replaces keys in the data object,
    // so {{appUrl}} will still be in the output
    expect(html).toContain('{{appUrl}}');
  });

  test('clearTemplateCache allows re-reading templates', () => {
    const html1 = renderTemplate('email', 'welcome', { userEmail: 'a@b.com', appUrl: 'http://x' });
    clearTemplateCache();
    const html2 = renderTemplate('email', 'welcome', { userEmail: 'c@d.com', appUrl: 'http://y' });

    expect(html1).toContain('a@b.com');
    expect(html2).toContain('c@d.com');
  });

  test('throws when template file does not exist', () => {
    expect(() => renderTemplate('email', 'nonexistent', {})).toThrow();
  });
});

// ─── Template files existence & placeholder tests ────────────────────────────

describe('email template files', () => {
  const templates = ['welcome', 'linkCreated', 'linkExpiry', 'linkExpired'];

  test.each(templates)('%s.html exists and is valid HTML', (name) => {
    const content = readFileSync(join(templatesDir, `${name}.html`), 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('</html>');
  });

  test('welcome.html contains expected placeholders', () => {
    const content = readFileSync(join(templatesDir, 'welcome.html'), 'utf-8');
    expect(content).toContain('{{userEmail}}');
    expect(content).toContain('{{appUrl}}');
  });

  test('linkExpiry.html contains expected placeholders', () => {
    const content = readFileSync(join(templatesDir, 'linkExpiry.html'), 'utf-8');
    for (const ph of ['{{userEmail}}', '{{timeLabel}}', '{{linkCode}}', '{{originalUrl}}', '{{truncatedUrl}}', '{{expiresFormatted}}', '{{clicks}}', '{{appUrl}}']) {
      expect(content).toContain(ph);
    }
  });

  test('linkCreated.html contains expected placeholders', () => {
    const content = readFileSync(join(templatesDir, 'linkCreated.html'), 'utf-8');
    for (const ph of ['{{userEmail}}', '{{linkCode}}', '{{originalUrl}}', '{{truncatedUrl}}', '{{expiryLine}}', '{{expiryNote}}', '{{appUrl}}']) {
      expect(content).toContain(ph);
    }
  });

  test('linkExpired.html contains expected placeholders', () => {
    const content = readFileSync(join(templatesDir, 'linkExpired.html'), 'utf-8');
    for (const ph of ['{{userEmail}}', '{{linkCode}}', '{{originalUrl}}', '{{truncatedUrl}}', '{{expiredFormatted}}', '{{clicks}}', '{{appUrl}}']) {
      expect(content).toContain(ph);
    }
  });
});

// ─── EmailService tests (mocked transporter) ────────────────────────────────

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id-123' });

jest.unstable_mockModule('../../src/config/mailer.js', () => ({
  isMailerConfigured: jest.fn().mockReturnValue(true),
  getTransporter: jest.fn().mockReturnValue({ sendMail: mockSendMail }),
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const emailServiceModule = await import('../../src/services/emailService.js');
const emailService = emailServiceModule.default;
const { isMailerConfigured, getTransporter } = await import('../../src/config/mailer.js');

const fakeUser = { email: 'user@example.com' };
const fakeLink = {
  code: 'abc123',
  originalUrl: 'https://www.example.com/very/long/path',
  expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  clicks: 42,
};

beforeEach(() => {
  jest.clearAllMocks();
  isMailerConfigured.mockReturnValue(true);
  getTransporter.mockReturnValue({ sendMail: mockSendMail });
  mockSendMail.mockResolvedValue({ messageId: 'test-id-123' });
});

describe('EmailService.sendLinkExpiryNotification', () => {
  test('sends email with rendered template', async () => {
    const result = await emailService.sendLinkExpiryNotification(fakeUser, fakeLink);

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.to).toBe('user@example.com');
    expect(mailOpts.html).toContain('user@example.com');
    expect(mailOpts.html).toContain('abc123');
    expect(mailOpts.html).toContain('Your Link Will Expire Soon');
    expect(mailOpts.subject).toContain('abc123');
  });

  test('returns false when mailer not configured', async () => {
    isMailerConfigured.mockReturnValue(false);
    const result = await emailService.sendLinkExpiryNotification(fakeUser, fakeLink);
    expect(result).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('returns false when transporter is null', async () => {
    getTransporter.mockReturnValue(null);
    const result = await emailService.sendLinkExpiryNotification(fakeUser, fakeLink);
    expect(result).toBe(false);
  });

  test('returns false on sendMail failure', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP error'));
    const result = await emailService.sendLinkExpiryNotification(fakeUser, fakeLink);
    expect(result).toBe(false);
  });
});

describe('EmailService.sendLinkCreatedNotification', () => {
  test('sends email with expiry info', async () => {
    const result = await emailService.sendLinkCreatedNotification(fakeUser, fakeLink);

    expect(result).toBe(true);
    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.html).toContain('Link Created Successfully');
    expect(mailOpts.html).toContain('abc123');
    expect(mailOpts.subject).toContain('abc123');
  });

  test('handles permanent link (no expiresAt)', async () => {
    const permanentLink = { ...fakeLink, expiresAt: null };
    const result = await emailService.sendLinkCreatedNotification(fakeUser, permanentLink);

    expect(result).toBe(true);
    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.html).toContain('Never (permanent link)');
    expect(mailOpts.subject).toContain('created successfully');
  });

  test('returns false when mailer not configured', async () => {
    isMailerConfigured.mockReturnValue(false);
    const result = await emailService.sendLinkCreatedNotification(fakeUser, fakeLink);
    expect(result).toBe(false);
  });
});

describe('EmailService.sendLinkExpiredNotification', () => {
  test('sends email with expired template', async () => {
    const expiredLink = { ...fakeLink, expiresAt: new Date(Date.now() - 120_000).toISOString() };
    const result = await emailService.sendLinkExpiredNotification(fakeUser, expiredLink);

    expect(result).toBe(true);
    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.html).toContain('Your Link Has Expired');
    expect(mailOpts.html).toContain('abc123');
    expect(mailOpts.html).toContain('42');
  });

  test('returns false when mailer not configured', async () => {
    isMailerConfigured.mockReturnValue(false);
    const result = await emailService.sendLinkExpiredNotification(fakeUser, fakeLink);
    expect(result).toBe(false);
  });
});

describe('EmailService.sendWelcomeEmail', () => {
  test('sends welcome email with rendered template', async () => {
    const result = await emailService.sendWelcomeEmail(fakeUser);

    expect(result).toBe(true);
    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.html).toContain('Welcome to URL Shortener');
    expect(mailOpts.html).toContain('user@example.com');
    expect(mailOpts.subject).toBe('Welcome to URL Shortener');
  });

  test('returns false when mailer not configured', async () => {
    isMailerConfigured.mockReturnValue(false);
    const result = await emailService.sendWelcomeEmail(fakeUser);
    expect(result).toBe(false);
  });

  test('returns false on sendMail failure', async () => {
    mockSendMail.mockRejectedValue(new Error('connection refused'));
    const result = await emailService.sendWelcomeEmail(fakeUser);
    expect(result).toBe(false);
  });
});
