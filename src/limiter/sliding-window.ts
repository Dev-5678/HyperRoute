/**
 * HyperRoute - Sliding-Window Rate Limiting Algorithms
 * 
 * Implements high-throughput sliding-window counter with sub-millisecond precision,
 * eliminating the 2x burst vulnerability inherent in fixed-window algorithms.
 * 
 * Mathematical Formulation:
 * Estimated Count = PrevWindowCount * ((WindowSize - Offset) / WindowSize) + CurrWindowCount
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  currentRate: number;
}

export class SlidingWindowCounterLimiter {
  private windowSizeMs: number;
  private maxRequests: number;
  private memoryStore: Map<string, { currentWindow: number; currentCount: number; prevCount: number }>;

  constructor(maxRequests: number, windowSizeMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeMs;
    this.memoryStore = new Map();
  }

  /**
   * Evaluates request against sliding window counter
   */
  public evaluate(key: string, now = Date.now()): RateLimitResult {
    const currentWindowIndex = Math.floor(now / this.windowSizeMs);
    const windowOffset = now % this.windowSizeMs;

    let record = this.memoryStore.get(key);
    if (!record) {
      record = { currentWindow: currentWindowIndex, currentCount: 0, prevCount: 0 };
      this.memoryStore.set(key, record);
    }

    if (record.currentWindow !== currentWindowIndex) {
      if (record.currentWindow === currentWindowIndex - 1) {
        // Shift window
        record.prevCount = record.currentCount;
      } else {
        // Stale window gap
        record.prevCount = 0;
      }
      record.currentWindow = currentWindowIndex;
      record.currentCount = 0;
    }

    // Weighted estimate
    const weight = (this.windowSizeMs - windowOffset) / this.windowSizeMs;
    const estimatedCount = record.prevCount * weight + record.currentCount;

    const allowed = estimatedCount < this.maxRequests;
    if (allowed) {
      record.currentCount++;
    }

    const resetMs = this.windowSizeMs - windowOffset;
    const remaining = Math.max(0, Math.floor(this.maxRequests - estimatedCount - (allowed ? 1 : 0)));

    return {
      allowed,
      limit: this.maxRequests,
      remaining,
      resetMs,
      currentRate: Number(estimatedCount.toFixed(2)),
    };
  }

  /**
   * Redis Lua Script for atomic multi-instance cluster execution
   */
  public static getRedisLuaScript(): string {
    return `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowSizeMs = tonumber(ARGV[2])
      local maxRequests = tonumber(ARGV[3])
      
      local clearBefore = now - windowSizeMs
      redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
      local currentCount = redis.call('ZCARD', key)
      
      if currentCount < maxRequests then
        redis.call('ZADD', key, now, now .. '-' .. math.random(100000))
        redis.call('PEXPIRE', key, windowSizeMs)
        return {1, maxRequests - currentCount - 1}
      else
        return {0, 0}
      end
    `;
  }
}
