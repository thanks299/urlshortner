/**
 * __tests__/unit/linkExpiryService.test.js
 * Unit tests for LinkExpiryService — Mongoose models and emailService are fully mocked.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockLinkFind = jest.fn();
const mockLinkFindByIdAndUpdate = jest.fn();
const mockLinkUpdateMany = jest.fn();
const mockUserFindById = jest.fn();
const mockSendLinkExpiryNotification = jest.fn();
const mockSendLinkExpiredNotification = jest.fn();

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../../src/models/Link.js', () => ({
  default: {
    find: mockLinkFind,
    findByIdAndUpdate: mockLinkFindByIdAndUpdate,
    updateMany: mockLinkUpdateMany,
  },
}));

jest.unstable_mockModule('../../src/models/User.js', () => ({
  default: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  default: {
    sendLinkExpiryNotification: mockSendLinkExpiryNotification,
    sendLinkExpiredNotification: mockSendLinkExpiredNotification,
  },
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: mockLogger,
}));

// Import after mocking
const { default: linkExpiryService } = await import('../../src/services/linkExpiryService.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fakeUser = { _id: 'user1', email: 'test@example.com' };

/** Create a fake link whose notifyBefore window has already arrived */
function makePreExpiryLink(overrides = {}) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
  return {
    _id: 'link1',
    code: 'abc123',
    originalUrl: 'https://example.com',
    clicks: 5,
    isActive: true,
    expiresAt,
    notifyBefore: 15, // notify 15 min before → window already open
    notificationSent: false,
    createdBy: 'user1',
    ...overrides,
  };
}

/** Create a fake link that expired > 2 minutes ago */
function makeExpiredLink(overrides = {}) {
  return {
    _id: 'link2',
    code: 'xyz789',
    originalUrl: 'https://example.com/old',
    clicks: 20,
    isActive: false,
    expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    expiryNotificationSent: false,
    createdBy: 'user1',
    ...overrides,
  };
}

// ─── Reset ───────────────────────────────────────────────────────────────────

beforeEach(() => jest.resetAllMocks());

// ─── checkAndNotifyExpiringLinks (orchestrator) ──────────────────────────────

describe('linkExpiryService.checkAndNotifyExpiringLinks', () => {
  test('returns combined pre-expiry and post-expiry results', async () => {
    mockLinkFind.mockResolvedValue([]);

    const result = await linkExpiryService.checkAndNotifyExpiringLinks();

    expect(result).toHaveProperty('checkedAt');
    expect(result.preExpiry).toEqual({ sent: 0, failed: 0 });
    expect(result.postExpiry).toEqual({ sent: 0, failed: 0 });
  });
});

// ─── Pre-expiry notifications ────────────────────────────────────────────────

describe('linkExpiryService._sendPreExpiryNotifications', () => {
  test('sends notification when link is within notify window', async () => {
    const link = makePreExpiryLink();
    mockLinkFind.mockResolvedValueOnce([link]); // pre-expiry candidates
    mockUserFindById.mockResolvedValue(fakeUser);
    mockSendLinkExpiryNotification.mockResolvedValue(true);
    mockLinkFindByIdAndUpdate.mockResolvedValue({});

    const result = await linkExpiryService._sendPreExpiryNotifications();

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mockSendLinkExpiryNotification).toHaveBeenCalledWith(fakeUser, link);
    expect(mockLinkFindByIdAndUpdate).toHaveBeenCalledWith('link1', {
      notificationSent: true,
      notificationSentAt: expect.any(Date),
    });
  });

  test('skips links whose notify window has not yet arrived', async () => {
    // notifyBefore = 5 min, but link expires in 10 min → notify at T-5, not yet
    const link = makePreExpiryLink({ notifyBefore: 5 });
    mockLinkFind.mockResolvedValueOnce([link]);

    const result = await linkExpiryService._sendPreExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockSendLinkExpiryNotification).not.toHaveBeenCalled();
  });

  test('skips links that have already expired', async () => {
    const link = makePreExpiryLink({
      expiresAt: new Date(Date.now() - 60_000), // already expired
      notifyBefore: 15,
    });
    mockLinkFind.mockResolvedValueOnce([link]);

    const result = await linkExpiryService._sendPreExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockSendLinkExpiryNotification).not.toHaveBeenCalled();
  });

  test('counts failure when user is not found', async () => {
    const link = makePreExpiryLink();
    mockLinkFind.mockResolvedValueOnce([link]);
    mockUserFindById.mockResolvedValue(null);

    const result = await linkExpiryService._sendPreExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockSendLinkExpiryNotification).not.toHaveBeenCalled();
  });

  test('counts failure when email sending fails', async () => {
    const link = makePreExpiryLink();
    mockLinkFind.mockResolvedValueOnce([link]);
    mockUserFindById.mockResolvedValue(fakeUser);
    mockSendLinkExpiryNotification.mockResolvedValue(false);

    const result = await linkExpiryService._sendPreExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockLinkFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('counts failure and logs when an error is thrown for a link', async () => {
    const link = makePreExpiryLink();
    mockLinkFind.mockResolvedValueOnce([link]);
    mockUserFindById.mockRejectedValue(new Error('DB down'));

    const result = await linkExpiryService._sendPreExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Pre-expiry error'),
      'DB down',
    );
  });

  test('handles multiple links — mixed success and failure', async () => {
    const link1 = makePreExpiryLink({ _id: 'l1', code: 'aaa', createdBy: 'u1' });
    const link2 = makePreExpiryLink({ _id: 'l2', code: 'bbb', createdBy: 'u2' });
    const link3 = makePreExpiryLink({ _id: 'l3', code: 'ccc', createdBy: 'u3' });

    mockLinkFind.mockResolvedValueOnce([link1, link2, link3]);
    mockUserFindById
      .mockResolvedValueOnce(fakeUser)   // u1 → found
      .mockResolvedValueOnce(null)        // u2 → not found
      .mockResolvedValueOnce(fakeUser);   // u3 → found

    mockSendLinkExpiryNotification
      .mockResolvedValueOnce(true)   // l1 → success
      .mockResolvedValueOnce(false); // l3 → email failed

    mockLinkFindByIdAndUpdate.mockResolvedValue({});

    const result = await linkExpiryService._sendPreExpiryNotifications();

    expect(result).toEqual({ sent: 1, failed: 2 });
  });

  test('returns zeros when Link.find throws', async () => {
    mockLinkFind.mockRejectedValueOnce(new Error('query failed'));

    const result = await linkExpiryService._sendPreExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Pre-expiry check failed'),
      'query failed',
    );
  });
});

// ─── Post-expiry notifications ───────────────────────────────────────────────

describe('linkExpiryService._sendPostExpiryNotifications', () => {
  test('sends notification for expired link', async () => {
    const link = makeExpiredLink();
    mockLinkFind.mockResolvedValueOnce([link]);
    mockUserFindById.mockResolvedValue(fakeUser);
    mockSendLinkExpiredNotification.mockResolvedValue(true);
    mockLinkFindByIdAndUpdate.mockResolvedValue({});

    const result = await linkExpiryService._sendPostExpiryNotifications();

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mockSendLinkExpiredNotification).toHaveBeenCalledWith(fakeUser, link);
    expect(mockLinkFindByIdAndUpdate).toHaveBeenCalledWith('link2', {
      expiryNotificationSent: true,
    });
  });

  test('counts failure when user not found', async () => {
    const link = makeExpiredLink();
    mockLinkFind.mockResolvedValueOnce([link]);
    mockUserFindById.mockResolvedValue(null);

    const result = await linkExpiryService._sendPostExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 1 });
  });

  test('counts failure when email sending returns false', async () => {
    const link = makeExpiredLink();
    mockLinkFind.mockResolvedValueOnce([link]);
    mockUserFindById.mockResolvedValue(fakeUser);
    mockSendLinkExpiredNotification.mockResolvedValue(false);

    const result = await linkExpiryService._sendPostExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockLinkFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('counts failure when per-link processing throws', async () => {
    const link = makeExpiredLink();
    mockLinkFind.mockResolvedValueOnce([link]);
    mockUserFindById.mockRejectedValue(new Error('timeout'));

    const result = await linkExpiryService._sendPostExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Post-expiry error'),
      'timeout',
    );
  });

  test('returns zeros when Link.find throws', async () => {
    mockLinkFind.mockRejectedValueOnce(new Error('connection lost'));

    const result = await linkExpiryService._sendPostExpiryNotifications();

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Post-expiry check failed'),
      'connection lost',
    );
  });

  test('handles multiple expired links', async () => {
    const link1 = makeExpiredLink({ _id: 'e1', code: 'exp1', createdBy: 'u1' });
    const link2 = makeExpiredLink({ _id: 'e2', code: 'exp2', createdBy: 'u2' });

    mockLinkFind.mockResolvedValueOnce([link1, link2]);
    mockUserFindById.mockResolvedValue(fakeUser);
    mockSendLinkExpiredNotification.mockResolvedValue(true);
    mockLinkFindByIdAndUpdate.mockResolvedValue({});

    const result = await linkExpiryService._sendPostExpiryNotifications();

    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(mockSendLinkExpiredNotification).toHaveBeenCalledTimes(2);
  });
});

// ─── cleanupExpiredLinks ─────────────────────────────────────────────────────

describe('linkExpiryService.cleanupExpiredLinks', () => {
  test('deactivates expired links and returns count', async () => {
    mockLinkUpdateMany.mockResolvedValue({ modifiedCount: 3 });

    const result = await linkExpiryService.cleanupExpiredLinks();

    expect(result).toHaveProperty('cleanedAt');
    expect(result.linksDeactivated).toBe(3);
    expect(mockLinkUpdateMany).toHaveBeenCalledWith(
      {
        isActive: true,
        expiresAt: { $exists: true, $lte: expect.any(Date) },
      },
      {
        isActive: false,
        expiredAt: expect.any(Date),
      },
    );
  });

  test('returns 0 when no links are expired', async () => {
    mockLinkUpdateMany.mockResolvedValue({ modifiedCount: 0 });

    const result = await linkExpiryService.cleanupExpiredLinks();

    expect(result.linksDeactivated).toBe(0);
  });

  test('returns error object when updateMany throws', async () => {
    mockLinkUpdateMany.mockRejectedValue(new Error('write error'));

    const result = await linkExpiryService.cleanupExpiredLinks();

    expect(result).toEqual({ error: 'write error' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('cleanupExpiredLinks'),
      'write error',
    );
  });
});
