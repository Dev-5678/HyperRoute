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