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