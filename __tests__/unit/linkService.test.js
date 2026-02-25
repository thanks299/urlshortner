/**
 * __tests__/unit/linkService.test.js
 * Unit tests for LinkService — repo is fully mocked.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Create mock repository
const mockRepo = {
  findByOriginalUrl: jest.fn(),
  findByCode: jest.fn(),
  existsByCode: jest.fn(),
  create: jest.fn(),
  softDelete: jest.fn(),
  recordClick: jest.fn(),
};

// Create mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};

// Mock modules
jest.unstable_mockModule('../../src/repositories/linkRepository.js', () => ({
  default: mockRepo
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: mockLogger
}));

// Import after mocking
const linkServiceModule = await import('../../src/services/linkService.js');
const AppErrorModule = await import('../../src/utils/AppError.js');

const linkService = linkServiceModule.default;
const AppError = AppErrorModule.default;
const repo = mockRepo;

// Reset mocks before each test
beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('linkService.shortenUrl', () => {

  const mockLink = {
    code: 'abc1234',
    originalUrl: 'https://example.com',
    clicks: 0,
    expiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test('creates a new short link successfully', async () => {
    repo.findByOriginalUrl.mockResolvedValue(null);
    repo.existsByCode.mockResolvedValue(false);
    repo.create.mockResolvedValue(mockLink);

    const result = await linkService.shortenUrl({ originalUrl: 'https://example.com' });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      originalUrl: 'https://example.com',
    }));
    expect(result.shortCode).toBe('abc1234');
    expect(result.originalUrl).toBe('https://example.com');
  });

  test('returns existing link for duplicate URL (dedup)', async () => {
    repo.findByOriginalUrl.mockResolvedValue(mockLink);

    const result = await linkService.shortenUrl({ originalUrl: 'https://example.com' });

    expect(repo.create).not.toHaveBeenCalled();
    expect(result.existing).toBe(true);
    expect(result.shortCode).toBe('abc1234');
  });

  test('throws 400 for missing URL', async () => {
    await expect(linkService.shortenUrl({}))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 for invalid URL (no protocol)', async () => {
    await expect(linkService.shortenUrl({ originalUrl: 'not-a-url' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 for ftp:// URL', async () => {
    await expect(linkService.shortenUrl({ originalUrl: 'ftp://example.com' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 409 when custom code is already taken', async () => {
    repo.existsByCode.mockResolvedValue(true);

    await expect(linkService.shortenUrl({
      originalUrl: 'https://example.com',
      customCode: 'taken',
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('throws 400 for invalid custom code (special chars)', async () => {
    await expect(linkService.shortenUrl({
      originalUrl: 'https://example.com',
      customCode: 'bad code!',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when expiresAt is in the past', async () => {
    await expect(linkService.shortenUrl({
      originalUrl: 'https://example.com',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('creates link with expiry date', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    repo.findByOriginalUrl.mockResolvedValue(null);
    repo.existsByCode.mockResolvedValue(false);
    repo.create.mockResolvedValue({ ...mockLink, expiresAt: future });

    const result = await linkService.shortenUrl({
      originalUrl: 'https://example.com',
      expiresAt: future,
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      expiresAt: expect.any(Date),
    }));
    expect(result.expiresAt).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('linkService.resolveCode', () => {

  test('returns originalUrl for a valid code', async () => {
    repo.findByCode.mockResolvedValue({ code: 'abc', originalUrl: 'https://target.com', expiresAt: null });
    repo.recordClick.mockResolvedValue();

    const url = await linkService.resolveCode('abc', {});
    expect(url).toBe('https://target.com');
  });

  test('throws 404 for nonexistent code', async () => {
    repo.findByCode.mockResolvedValue(null);

    await expect(linkService.resolveCode('missing', {}))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 410 for expired link', async () => {
    repo.findByCode.mockResolvedValue({
      code: 'old',
      originalUrl: 'https://gone.com',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(linkService.resolveCode('old', {}))
      .rejects.toMatchObject({ statusCode: 410 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('linkService.deleteLink', () => {

  test('soft-deletes an existing link', async () => {
    repo.softDelete.mockResolvedValue({ code: 'abc', isActive: false });

    const result = await linkService.deleteLink('abc');
    expect(result.message).toContain('abc');
    expect(repo.softDelete).toHaveBeenCalledWith('abc');
  });

  test('throws 404 for nonexistent link', async () => {
    repo.softDelete.mockResolvedValue(null);

    await expect(linkService.deleteLink('nope'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});