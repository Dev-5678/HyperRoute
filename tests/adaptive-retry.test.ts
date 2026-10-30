/**
 * HyperRoute - Adaptive Exponential Backoff & Jittered Retry Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterFactor: number;
}

class AdaptiveRetryEngine {
  private policy: RetryPolicy;

  constructor(policy: Partial<RetryPolicy> = {}) {
    this.policy = {
      maxRetries: policy.maxRetries ?? 3,
      initialDelayMs: policy.initialDelayMs ?? 100,
      maxDelayMs: policy.maxDelayMs ?? 2000,
      backoffFactor: policy.backoffFactor ?? 2,
      jitterFactor: policy.jitterFactor ?? 0.2,
    };
  }

  public calculateBackoff(attempt: number, pseudoRandomSeed = 0.5): number {
    const rawBackoff = Math.min(
      this.policy.initialDelayMs * Math.pow(this.policy.backoffFactor, attempt),
      this.policy.maxDelayMs
    );
    // Apply full-jitter or bounded jitter
    const jitterRange = rawBackoff * this.policy.jitterFactor;
    const jitter = (pseudoRandomSeed * 2 - 1) * jitterRange;
    return Math.max(0, Math.round(rawBackoff + jitter));
  }

  public async executeWithRetry<T>(
    operation: (attempt: number) => Promise<T>,
    isIdempotent = true
  ): Promise<{ result: T; attempts: number; totalBackoffMs: number }> {
    let attempt = 0;
    let totalBackoffMs = 0;

    while (attempt <= this.policy.maxRetries) {
      try {
        const result = await operation(attempt);
        return { result, attempts: attempt + 1, totalBackoffMs };
      } catch (err) {
        if (!isIdempotent || attempt >= this.policy.maxRetries) {
          throw err;
        }
        const delay = this.calculateBackoff(attempt);
        totalBackoffMs += delay;
        attempt++;
      }
    }

    throw new Error('Exhausted retry budget without result');
  }
}

describe('Adaptive Exponential Backoff & Jittered Retry', () => {
  it('correctly bounds exponential growth beneath maxDelay ceiling', () => {
    const engine = new AdaptiveRetryEngine({
      initialDelayMs: 100,
      backoffFactor: 2,
      maxDelayMs: 1000,
      jitterFactor: 0.1,
    });

    const d0 = engine.calculateBackoff(0, 0.5);
    const d1 = engine.calculateBackoff(1, 0.5);
    const d2 = engine.calculateBackoff(2, 0.5);
    const d5 = engine.calculateBackoff(5, 0.5);

    assert.strictEqual(d0, 100);
    assert.strictEqual(d1, 200);
    assert.strictEqual(d2, 400);
    assert.strictEqual(d5, 1000, 'Should clamp to maxDelay ceiling');
  });

  it('retries transient network faults and succeeds on subsequent attempt', async () => {
    const engine = new AdaptiveRetryEngine({ maxRetries: 3, initialDelayMs: 10 });
    let calls = 0;

    const res = await engine.executeWithRetry(async (attempt) => {
      calls++;
      if (attempt < 2) {
        throw new Error('ECONNRESET');
      }
      return 'upstream-200-ok';
    });

    assert.strictEqual(res.result, 'upstream-200-ok');
    assert.strictEqual(res.attempts, 3);
    assert.strictEqual(calls, 3);
  });
});
