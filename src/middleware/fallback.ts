/**
 * HyperRoute - Circuit Breaker Fallback Response Interceptor
 * 
 * Intercepts upstream proxy failures, timeouts, and 5xx errors.
 * Provides graceful degradation via cached stale payloads or synthetic fallback responses,
 * preventing cascading failures across edge service topologies.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

export interface FallbackConfig {
  tripThreshold: number;
  cooloffMs: number;
  enableStaleCacheFallback: boolean;
}

export interface FallbackResponse<T = unknown> {
  statusCode: number;
  data: T;
  isFallback: boolean;
  source: 'UPSTREAM' | 'FALLBACK_HANDLER' | 'STALE_CACHE';
  headers: Record<string, string>;
}

export class CircuitBreakerFallbackInterceptor {
  private config: FallbackConfig;
  private failureCount: Map<string, number>;
  private circuitOpenedAt: Map<string, number>;
  private staleCache: Map<string, { data: unknown; timestamp: number }>;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      tripThreshold: config.tripThreshold ?? 3,
      cooloffMs: config.cooloffMs ?? 5000,
      enableStaleCacheFallback: config.enableStaleCacheFallback ?? true,
    };
    this.failureCount = new Map();
    this.circuitOpenedAt = new Map();
    this.staleCache = new Map();
  }

  /**
   * Checks if circuit is currently open for the given route key
   */
  public isCircuitOpen(routeKey: string, now: number = Date.now()): boolean {
    const openedAt = this.circuitOpenedAt.get(routeKey);
    if (!openedAt) return false;

    if (now - openedAt >= this.config.cooloffMs) {
      // Cooldown elapsed, allow trial request
      this.circuitOpenedAt.delete(routeKey);
      this.failureCount.set(routeKey, 0);
      return false;
    }
    return true;
  }

  /**
   * Records a successful upstream response and updates the stale cache
   */
  public recordSuccess(routeKey: string, data: unknown): void {
    this.failureCount.set(routeKey, 0);
    this.circuitOpenedAt.delete(routeKey);
    this.staleCache.set(routeKey, { data, timestamp: Date.now() });
  }

  /**
   * Records an upstream error and trips circuit breaker if threshold breached
   */
  public recordFailure(routeKey: string, now: number = Date.now()): boolean {
    const count = (this.failureCount.get(routeKey) ?? 0) + 1;
    this.failureCount.set(routeKey, count);

    if (count >= this.config.tripThreshold) {
      this.circuitOpenedAt.set(routeKey, now);
      return true; // Circuit tripped
    }
    return false;
  }

  /**
   * Intercepts upstream execution with automatic circuit breaking and fallback resolution
   */
  public async executeWithFallback<T>(
    routeKey: string,
    upstreamCall: () => Promise<T>,
    fallbackHandler?: () => Promise<T> | T
  ): Promise<FallbackResponse<T>> {
    const now = Date.now();

    // If circuit is already open, skip doomed upstream call
    if (this.isCircuitOpen(routeKey, now)) {
      return this.resolveFallback(routeKey, fallbackHandler, 'Circuit breaker OPEN for route');
    }

    try {
      const data = await upstreamCall();
      this.recordSuccess(routeKey, data);
      return {
        statusCode: 200,
        data,
        isFallback: false,
        source: 'UPSTREAM',
        headers: { 'X-HyperRoute-Circuit': 'CLOSED' },
      };
    } catch {
      this.recordFailure(routeKey, now);
      return this.resolveFallback(routeKey, fallbackHandler, 'Upstream execution failed');
    }
  }

  private resolveFallback<T>(
    routeKey: string,
    fallbackHandler?: () => Promise<T> | T,
    reason?: string
  ): FallbackResponse<T> {
    // 1. Check stale cache if enabled
    if (this.config.enableStaleCacheFallback && this.staleCache.has(routeKey)) {
      const cached = this.staleCache.get(routeKey)!;
      return {
        statusCode: 200,
        data: cached.data as T,
        isFallback: true,
        source: 'STALE_CACHE',
        headers: {
          'X-HyperRoute-Fallback': 'true',
          'X-HyperRoute-Fallback-Reason': reason ?? 'stale-cache',
          'X-HyperRoute-Cached-At': new Date(cached.timestamp).toISOString(),
        },
      };
    }

    // 2. Execute custom fallback handler if provided
    if (fallbackHandler) {
      const fallbackData = typeof fallbackHandler === 'function' ? (fallbackHandler as any)() : fallbackHandler;
      return {
        statusCode: 200,
        data: fallbackData,
        isFallback: true,
        source: 'FALLBACK_HANDLER',
        headers: {
          'X-HyperRoute-Fallback': 'true',
          'X-HyperRoute-Fallback-Reason': reason ?? 'handler',
        },
      };
    }

    // 3. Default degraded service error
    return {
      statusCode: 503,
      data: { error: 'Service Unavailable', reason } as unknown as T,
      isFallback: true,
      source: 'FALLBACK_HANDLER',
      headers: {
        'X-HyperRoute-Fallback': 'true',
        'Retry-After': Math.ceil(this.config.cooloffMs / 1000).toString(),
      },
    };
  }

  public reset(): void {
    this.failureCount.clear();
    this.circuitOpenedAt.clear();
    this.staleCache.clear();
  }
}
