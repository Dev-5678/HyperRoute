/**
 * HyperRoute - Token Bucket Rate Limiter
 * 
 * Supports smooth burst management with continuous token replenishment:
 * Tokens(t) = min(Capacity, Tokens(t_last) + RefillRate * (t - t_last))
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

export class TokenBucketLimiter {
  private capacity: number;
  private refillRatePerSec: number;
  private buckets: Map<string, { tokens: number; lastRefill: number }>;

  constructor(capacity: number, refillRatePerSec: number) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.buckets = new Map();
  }

  public consume(key: string, tokensRequested = 1, now = Date.now()): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      // Continuous token accumulation
      const deltaSec = (now - bucket.lastRefill) / 1000;
      const refilledTokens = deltaSec * this.refillRatePerSec;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + refilledTokens);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= tokensRequested) {
      bucket.tokens -= tokensRequested;
      return true;
    }

    return false;
  }

  public getAvailableTokens(key: string, now = Date.now()): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.capacity;
    const deltaSec = (now - bucket.lastRefill) / 1000;
    return Math.min(this.capacity, bucket.tokens + deltaSec * this.refillRatePerSec);
  }
}
