/**
 * HyperRoute - Circuit Breaker Fallback Interceptor Unit Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CircuitBreakerFallbackInterceptor } from '../src/middleware/fallback';

describe('Circuit Breaker Fallback Response Interceptor', () => {
  it('returns upstream response directly when upstream succeeds', async () => {
    const interceptor = new CircuitBreakerFallbackInterceptor();

    const response = await interceptor.executeWithFallback(
      '/api/v1/users',
      async () => ({ user: 'dev_jangid', role: 'admin' })
    );

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.isFallback, false);
    assert.strictEqual(response.source, 'UPSTREAM');
    assert.strictEqual((response.data as any).user, 'dev_jangid');
  });

  it('serves cached stale payload when upstream encounters failure', async () => {
    const interceptor = new CircuitBreakerFallbackInterceptor();

    // 1. Initial success seeds stale cache
    await interceptor.executeWithFallback(
      '/api/v1/metrics',
      async () => ({ throughput: 50000 })
    );

    // 2. Upstream crashes
    const fallbackResponse = await interceptor.executeWithFallback(
      '/api/v1/metrics',
      async () => {
        throw new Error('502 Bad Gateway');
      }
    );

    assert.strictEqual(fallbackResponse.statusCode, 200);
    assert.strictEqual(fallbackResponse.isFallback, true);
    assert.strictEqual(fallbackResponse.source, 'STALE_CACHE');
    assert.strictEqual((fallbackResponse.data as any).throughput, 50000);
    assert.strictEqual(fallbackResponse.headers['X-HyperRoute-Fallback'], 'true');
  });

  it('trips circuit breaker after threshold failures and bypasses upstream calls', async () => {
    const interceptor = new CircuitBreakerFallbackInterceptor({
      tripThreshold: 2,
      cooloffMs: 5000,
      enableStaleCacheFallback: false,
    });

    let upstreamCalls = 0;
    const failingCall = async () => {
      upstreamCalls++;
      throw new Error('500 Internal Error');
    };

    // First failure
    await interceptor.executeWithFallback('/api/v1/orders', failingCall, () => ({ degraded: true }));
    assert.strictEqual(upstreamCalls, 1);

    // Second failure trips circuit breaker
    await interceptor.executeWithFallback('/api/v1/orders', failingCall, () => ({ degraded: true }));
    assert.strictEqual(upstreamCalls, 2);
    assert.strictEqual(interceptor.isCircuitOpen('/api/v1/orders'), true);

    // Third call: circuit is OPEN, upstreamCall is NOT invoked
    const fastFallback = await interceptor.executeWithFallback(
      '/api/v1/orders',
      failingCall,
      () => ({ degraded: true })
    );

    assert.strictEqual(upstreamCalls, 2); // Unchanged!
    assert.strictEqual(fastFallback.isFallback, true);
  });
});
