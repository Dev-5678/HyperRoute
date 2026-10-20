/**
 * HyperRoute - Core Type Definitions & Config Contracts
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

export interface UpstreamServer {
  id: string;
  url: string;
  weight: number;
  activeConnections: number;
  isHealthy: boolean;
  consecutiveFailures: number;
}

export interface RouteRule {
  pathPrefix: string;
  loadBalancer: any;
  stripPrefix?: boolean;
  rateLimitKey?: string;
}
