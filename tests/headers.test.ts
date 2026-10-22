import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RequestIdGenerator } from '../src/utils/request-id.js';
import { TracingHeadersMiddleware } from '../src/middleware/headers.js';

describe('Request Correlation & Tracing Headers', () => {
  it('generates compliant, high-entropy request IDs with valid timestamps', () => {
    const now = 1700000000000;
    const id = RequestIdGenerator.generate(now);

    assert.strictEqual(RequestIdGenerator.isValid(id), true);
    assert.strictEqual(RequestIdGenerator.extractTimestamp(id), now);

    const invalid = 'hr-invalid-id-xyz';
    assert.strictEqual(RequestIdGenerator.isValid(invalid), false);
    assert.strictEqual(RequestIdGenerator.extractTimestamp(invalid), null);
  });

  it('injects new X-Request-Id when header is absent in incoming request', () => {
    const middleware = new TracingHeadersMiddleware();
    const headers: Record<string, string> = {};
    const responseHeaders: Record<string, string> = {};

    const req: any = { headers };
    const res: any = {
      setHeader: (k: string, v: string) => { responseHeaders[k] = v; },
      end: () => {},
      headersSent: false,
    };

    let nextCalled = false;
    middleware.handle(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.ok(req.headers['x-request-id']);
    assert.strictEqual(RequestIdGenerator.isValid(req.headers['x-request-id']), true);
    assert.strictEqual(responseHeaders['X-Request-Id'], req.headers['x-request-id']);
    assert.strictEqual(responseHeaders['X-Gateway'], 'HyperRoute/1.1.0');
    assert.ok(responseHeaders['X-Correlation-Timestamp']);
  });

  it('preserves client-provided X-Request-Id for distributed tracing continuity', () => {
    const middleware = new TracingHeadersMiddleware();
    const existingTraceId = 'client-trace-uuid-12345';
    const req: any = { headers: { 'x-request-id': existingTraceId } };
    const responseHeaders: Record<string, string> = {};

    const res: any = {
      setHeader: (k: string, v: string) => { responseHeaders[k] = v; },
      end: () => {},
      headersSent: false,
    };

    middleware.handle(req, res, () => {});

    assert.strictEqual(req.headers['x-request-id'], existingTraceId);
    assert.strictEqual(responseHeaders['X-Request-Id'], existingTraceId);
  });
});
