/**
 * __tests__/integration/api.test.js
 * Integration tests for REST API endpoints.
 * NOTE: These require a running MongoDB instance (or use mongodb-memory-server).
 *       Run with: npm test
 *
 * For CI without MongoDB, install:
 *   npm install --save-dev @shelf/jest-mongodb
 * and add "preset": "@shelf/jest-mongodb" to jest config.
 */

import { jest, describe, test, expect, beforeAll } from '@jest/globals';
import supertest from 'supertest';
import AppError from '../../src/utils/AppError.js';
import catchAsync from '../../src/utils/catchAsync.js';

/**
 * These tests are written to be runnable structure-wise.
 * They show the full integration test pattern for the API.
 * Swap `describe.skip` → `describe` once MongoDB is available.
 */

describe.skip('POST /api/links', () => {
  let request;

  beforeAll(async () => {
    const { default: app } = await import('../../src/app.js');
    request = supertest(app);
  });

  test('201 — creates a short link', async () => {
    const res = await request
      .post('/api/links')
      .send({ originalUrl: 'https://www.example.com' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shortCode).toBeTruthy();
    expect(res.body.data.shortUrl).toMatch(/http:\/\/localhost/);
  });

  test('400 — rejects invalid URL', async () => {
    const res = await request
      .post('/api/links')
      .send({ originalUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  test('400 — rejects missing originalUrl', async () => {
    const res = await request.post('/api/links').send({});
    expect(res.status).toBe(400);
  });

  test('409 — rejects duplicate custom code', async () => {
    await request.post('/api/links').send({ originalUrl: 'https://a.com', customCode: 'dupetest' });
    const res = await request.post('/api/links').send({ originalUrl: 'https://b.com', customCode: 'dupetest' });
    expect(res.status).toBe(409);
  });

  test('400 — rejects past expiry date', async () => {
    const res = await request.post('/api/links').send({
      originalUrl: 'https://example.com',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(res.status).toBe(400);
  });

  test('200 — returns existing link for dedup', async () => {
    await request.post('/api/links').send({ originalUrl: 'https://dedup.com' });
    const res = await request.post('/api/links').send({ originalUrl: 'https://dedup.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.existing).toBe(true);
  });
});

describe.skip('GET /api/links', () => {
  test('200 — returns list of links', async () => {
    const { default: app } = await import('../../src/app.js');
    const res = await supertest(app).get('/api/links');
    expect(res.status).toBe(200);
    expect(res.body.data.links).toBeInstanceOf(Array);
    expect(typeof res.body.data.total).toBe('number');
  });
});

describe.skip('GET /:code', () => {
  test('302 — redirects to original URL', async () => {
    const { default: app } = await import('../../src/app.js');
    const req = supertest(app);
    const create = await req.post('/api/links').send({ originalUrl: 'https://redirect.test' });
    const { shortCode } = create.body.data;

    const res = await req.get(`/${shortCode}`).redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://redirect.test');
  });

  test('200 with 404 HTML — for unknown code', async () => {
    const { default: app } = await import('../../src/app.js');
    const res = await supertest(app).get('/nonexistentcode99');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Not Found');
  });
});

describe.skip('DELETE /api/links/:code', () => {
  test('200 — deletes a link', async () => {
    const { default: app } = await import('../../src/app.js');
    const req = supertest(app);
    const create = await req.post('/api/links').send({ originalUrl: 'https://todelete.com', customCode: 'deltarget' });
    const { shortCode } = create.body.data;

    const res = await req.delete(`/api/links/${shortCode}`);
    expect(res.status).toBe(200);
  });

  test('404 — nonexistent code', async () => {
    const { default: app } = await import('../../src/app.js');
    const res = await supertest(app).delete('/api/links/doesnotexist99');
    expect(res.status).toBe(404);
  });
});

describe.skip('GET /api/health', () => {
  test('200 — returns health status', async () => {
    const { default: app } = await import('../../src/app.js');
    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});

// ── Placeholder so Jest doesn't fail with "no tests found" ────────────────────
describe('API structure tests (mocked)', () => {
  test('AppError carries correct statusCode', () => {
    const e = new AppError('test', 404);
    expect(e.statusCode).toBe(404);
    expect(e.isOperational).toBe(true);
    expect(e.message).toBe('test');
  });

  test('catchAsync forwards errors to next()', async () => {
    const next = jest.fn();
    const err = new Error('boom');
    const handler = catchAsync(async () => { throw err; });
    await handler({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});