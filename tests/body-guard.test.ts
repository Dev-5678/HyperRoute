/**
 * HyperRoute - Request Body Guard Unit Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RequestBodyGuard } from '../src/security/body-guard';

describe('Request Body Size Guard & Content-Type Whitelist', () => {
  it('permits compliant JSON requests within payload size limits', () => {
    const guard = new RequestBodyGuard({ maxBytes: 1024 });
    const payload = JSON.stringify({ action: 'sync', count: 10 });

    const result = guard.inspect(
      payload.length.toString(),
      'application/json; charset=utf-8',
      payload
    );

    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.detectedMimeType, 'application/json');
  });

  it('rejects oversized Content-Length header with 413 Payload Too Large', () => {
    const guard = new RequestBodyGuard({ maxBytes: 500 });
    const result = guard.inspect('500000', 'application/json');

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.statusCode, 413);
    assert.ok(result.error?.includes('Payload Too Large'));
  });

  it('rejects unwhitelisted MIME types with 415 Unsupported Media Type', () => {
    const guard = new RequestBodyGuard({
      allowedContentTypes: ['application/json'],
    });

    const result = guard.inspect('25', 'application/x-executable', 'binary-data-payload');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.statusCode, 415);
    assert.ok(result.error?.includes('Unsupported Media Type'));
  });

  it('handles empty body gracefully according to policy', () => {
    const guard = new RequestBodyGuard({ allowEmptyBody: true });
    const result = guard.inspect(undefined, undefined, null);

    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.statusCode, 200);
  });
});
