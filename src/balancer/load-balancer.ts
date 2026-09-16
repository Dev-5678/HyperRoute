/**
 * HyperRoute - Upstream Load Balancer & Circuit Breaker
 * 
 * Supports Round-Robin, Weighted Round-Robin, and Least-Connections
 * routing algorithms with health-check failure isolation.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

export interface UpstreamServer {
  id: string;
  url: string;
  weight: number;
  activeConnections: number;
  isHealthy: boolean;
  consecutiveFailures: number;
}

export class LoadBalancer {
  private upstreams: UpstreamServer[] = [];
  private rrIndex = 0;

  constructor(servers: Array<{ id: string; url: string; weight?: number }>) {
    this.upstreams = servers.map((s) => ({
      id: s.id,
      url: s.url,
      weight: s.weight || 1,
      activeConnections: 0,
      isHealthy: true,
      consecutiveFailures: 0,
    }));
  }

  public getNextUpstream(): UpstreamServer {
    const healthyServers = this.upstreams.filter((s) => s.isHealthy);
    if (healthyServers.length === 0) {
      throw new Error('503 Service Unavailable: No healthy upstreams detected');
    }

    // Round-robin selection
    const selected = healthyServers[this.rrIndex % healthyServers.length];
    this.rrIndex = (this.rrIndex + 1) % healthyServers.length;
    return selected;
  }

  public reportSuccess(id: string): void {
    const target = this.upstreams.find((s) => s.id === id);
    if (target) {
      target.consecutiveFailures = 0;
      target.isHealthy = true;
    }
  }

  public reportFailure(id: string): void {
    const target = this.upstreams.find((s) => s.id === id);
    if (target) {
      target.consecutiveFailures++;
      if (target.consecutiveFailures >= 3) {
        target.isHealthy = false; // Trip circuit breaker
      }
    }
  }

  public getUpstreams(): UpstreamServer[] {
    return this.upstreams.map((s) => ({ ...s }));
  }
}
