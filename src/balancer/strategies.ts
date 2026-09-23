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