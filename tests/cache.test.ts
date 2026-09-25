import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EdgeResponseCache } from '../src/cache/response-cache.js';

describe('Edge Response Cache', () => {
  it('stores and retrieves cached payloads within TTL', () => {
    const cache = new EdgeResponseCache();
    const entry = {
      body: JSON.stringify({ ok: true }),
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      createdAt: 1000,
      ttlMs: 5000,
    };

    cache.set('/api/v1/resource', entry);

    // Hit
    assert.strictEqual(cache.get('/api/v1/resource', 2000)?.statusCode, 200);

    // Miss on expired TTL
    assert.strictEqual(cache.get('/api/v1/resource', 7000), null);
  });
});