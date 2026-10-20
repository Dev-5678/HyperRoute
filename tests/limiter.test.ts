/**
 * HyperRoute - Limiter & Load Balancer Verification Suite
 * 
 * Tests:
 * 1. Sliding window counter mathematical bounds
 * 2. 429 threshold enforcement
 * 3. Token bucket burst consumption and refill
 * 4. Round-robin load balancer upstream distribution
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SlidingWindowCounterLimiter } from '../src/limiter/sliding-window.js';
import { TokenBucketLimiter } from '../src/limiter/token-bucket.js';
import { LoadBalancer } from '../src/balancer/load-balancer.js';

describe('Sliding Window Counter Rate Limiter', () => {
  it('allows requests within threshold and blocks excess bursts', () => {
    const limiter = new SlidingWindowCounterLimiter(5, 60000); // 5 req/min
    const ip = '192.168.1.100';
    const baseTime = 1000000;

    for (let i = 0; i < 5; i++) {
      const res = limiter.evaluate(ip, baseTime + i * 100);
      assert.strictEqual(res.allowed, true);
    }

    // 6th request must be rejected with 429
    const blockedRes = limiter.evaluate(ip, baseTime + 600);
    assert.strictEqual(blockedRes.allowed, false);
    assert.strictEqual(blockedRes.remaining, 0);
  });

  it('correctly isolates different client IP keys', () => {
    const limiter = new SlidingWindowCounterLimiter(2, 60000);
    const ipA = '10.0.0.1';
    const ipB = '10.0.0.2';

    assert.strictEqual(limiter.evaluate(ipA).allowed, true);
    assert.strictEqual(limiter.evaluate(ipA).allowed, true);
    assert.strictEqual(limiter.evaluate(ipA).allowed, false);

    // ipB should remain unaffected
    assert.strictEqual(limiter.evaluate(ipB).allowed, true);
  });
});

describe('Token Bucket Limiter', () => {
  it('allows bursts up to capacity and refills over time', () => {
    const bucket = new TokenBucketLimiter(10, 5); // Capacity 10, Refill 5 tokens/sec
    const key = 'user_apiKey';
    const t0 = 1000000;

    // Consume all 10 tokens
    assert.strictEqual(bucket.consume(key, 10, t0), true);

    // 11th token rejected
    assert.strictEqual(bucket.consume(key, 1, t0), false);

    // After 1 second, 5 tokens refilled
    const t1 = t0 + 1000;
    assert.strictEqual(bucket.consume(key, 5, t1), true);
    assert.strictEqual(bucket.consume(key, 1, t1), false);
  });
});

describe('Load Balancer', () => {
  it('distributes requests evenly across healthy upstreams via round robin', () => {
    const lb = new LoadBalancer([
      { id: 'srv-1', url: 'http://srv1:8080' },
      { id: 'srv-2', url: 'http://srv2:8080' },
      { id: 'srv-3', url: 'http://srv3:8080' },
    ]);

    assert.strictEqual(lb.getNextUpstream().id, 'srv-1');
    assert.strictEqual(lb.getNextUpstream().id, 'srv-2');
    assert.strictEqual(lb.getNextUpstream().id, 'srv-3');
    assert.strictEqual(lb.getNextUpstream().id, 'srv-1');
  });

  it('trips circuit breaker and isolates failing upstreams', () => {
    const lb = new LoadBalancer([
      { id: 'srv-1', url: 'http://srv1:8080' },
      { id: 'srv-2', url: 'http://srv2:8080' },
    ]);

    lb.reportFailure('srv-1');
    lb.reportFailure('srv-1');
    lb.reportFailure('srv-1'); // 3 consecutive failures -> trips circuit breaker

    // srv-1 is now unhealthy, only srv-2 should receive traffic
    assert.strictEqual(lb.getNextUpstream().id, 'srv-2');
    assert.strictEqual(lb.getNextUpstream().id, 'srv-2');
  });
});
