/**
 * HyperRoute - HTTP Keep-Alive Connection Pooler
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import http from 'node:http';

export interface PoolConfig {
  maxSockets: number;
  maxFreeSockets: number;
  keepAliveMsecs: number;
}
export class ConnectionPoolManager {
  private agent: http.Agent;

  constructor(config: PoolConfig = { maxSockets: 1024, maxFreeSockets: 256, keepAliveMsecs: 60000 }) {
    this.agent = new http.Agent({
      keepAlive: true,
      maxSockets: config.maxSockets,
      maxFreeSockets: config.maxFreeSockets,
      keepAliveMsecs: config.keepAliveMsecs,
    });
  }

  public getAgent(): http.Agent {
    return this.agent;
  }
}
export class PoolBackpressure {
  public static shouldThrottle(activeConnections: number, maxCapacity: number): boolean {
    return activeConnections >= maxCapacity * 0.95;
  }
}