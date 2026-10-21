import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LeastConnectionsBalancer } from '../src/balancer/strategies.js';

describe('Least Connections Balancer', () => {
  it('selects server with lowest active connection count', () => {
    const servers: any[] = [
      { id: 's1', isHealthy: true, activeConnections: 12 },
      { id: 's2', isHealthy: true, activeConnections: 3 },
      { id: 's3', isHealthy: true, activeConnections: 8 },
    ];

    const balancer = new LeastConnectionsBalancer(servers);
    const selected = balancer.getNext();
    assert.strictEqual(selected.id, 's2');
  });
});