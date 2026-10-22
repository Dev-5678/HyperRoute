/**
 * HyperRoute - Advanced Upstream Balancing Algorithms
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import { UpstreamServer } from '../types/gateway.js';

export enum BalancingStrategy {
  ROUND_ROBIN = 'ROUND_ROBIN',
  WEIGHTED_ROUND_ROBIN = 'WEIGHTED_ROUND_ROBIN',
  LEAST_CONNECTIONS = 'LEAST_CONNECTIONS',
  EWMA_LATENCY = 'EWMA_LATENCY',
}
export class WeightedRoundRobinBalancer {
  private servers: UpstreamServer[];
  private currentIndex = -1;
  private currentWeight = 0;
  private maxWeight: number;
  private gcdWeight: number;

  constructor(servers: UpstreamServer[]) {
    this.servers = servers;
    this.maxWeight = Math.max(...servers.map(s => s.weight));
    this.gcdWeight = 1;
  }

  public getNext(): UpstreamServer {
    const healthy = this.servers.filter(s => s.isHealthy);
    if (healthy.length === 0) throw new Error('No healthy upstreams available');
    return healthy[0];
  }
}
export class LeastConnectionsBalancer {
  private servers: UpstreamServer[];

  constructor(servers: UpstreamServer[]) {
    this.servers = servers;
  }

  public getNext(): UpstreamServer {
    const healthy = this.servers.filter(s => s.isHealthy);
    if (healthy.length === 0) throw new Error('No healthy upstreams available');
    return healthy.reduce((min, s) => s.activeConnections < min.activeConnections ? s : min, healthy[0]);
  }
}

/**
 * Exponentially Weighted Moving Average (EWMA) Peak Latency Balancer
 * 
 * Routes traffic adaptively to upstreams exhibiting the lowest smoothed EWMA response times.
 */
export class EWMALatencyBalancer {
  private servers: UpstreamServer[];
  private ewmaLatencies: Map<string, number> = new Map();
  private readonly alpha: number;

  constructor(servers: UpstreamServer[], alpha: number = 0.2) {
    this.servers = servers;
    this.alpha = alpha;
    for (const server of servers) {
      this.ewmaLatencies.set(server.url, 10.0); // Default optimistic baseline latency 10ms
    }
  }

  public recordLatency(url: string, latencyMs: number): void {
    const current = this.ewmaLatencies.get(url) ?? latencyMs;
    const updated = this.alpha * latencyMs + (1 - this.alpha) * current;
    this.ewmaLatencies.set(url, updated);
  }

  public getLatency(url: string): number {
    return this.ewmaLatencies.get(url) ?? 10.0;
  }

  public getNext(): UpstreamServer {
    const healthy = this.servers.filter(s => s.isHealthy);
    if (healthy.length === 0) throw new Error('No healthy upstreams available');

    let bestServer = healthy[0];
    let minLatency = this.getLatency(bestServer.url);

    for (let i = 1; i < healthy.length; i++) {
      const server = healthy[i];
      const lat = this.getLatency(server.url);
      if (lat < minLatency) {
        minLatency = lat;
        bestServer = server;
      }
    }

    return bestServer;
  }
}
