import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EWMALatencyBalancer } from '../src/balancer/strategies.js';
import { UpstreamServer } from '../src/types/gateway.js';

describe('EWMA Adaptive Latency Load Balancer', () => {
  const createServers = (): UpstreamServer[] => [
    { id: 's1', url: 'http://srv-1.internal:8080', weight: 1, isHealthy: true, activeConnections: 0, consecutiveFailures: 0 },
    { id: 's2', url: 'http://srv-2.internal:8080', weight: 1, isHealthy: true, activeConnections: 0, consecutiveFailures: 0 },
    { id: 's3', url: 'http://srv-3.internal:8080', weight: 1, isHealthy: true, activeConnections: 0, consecutiveFailures: 0 },
  ];

  it('computes exponential moving average latency updates with smoothing alpha', () => {
    const servers = createServers();
    const balancer = new EWMALatencyBalancer(servers, 0.2);

    // Initial baseline is 10.0ms
    assert.strictEqual(balancer.getLatency('http://srv-1.internal:8080'), 10.0);

    // Record sample of 50ms: 0.2 * 50 + 0.8 * 10 = 10 + 8 = 18.0ms
    balancer.recordLatency('http://srv-1.internal:8080', 50.0);
    assert.strictEqual(balancer.getLatency('http://srv-1.internal:8080'), 18.0);

    // Second sample of 100ms: 0.2 * 100 + 0.8 * 18 = 20 + 14.4 = 34.4ms
    balancer.recordLatency('http://srv-1.internal:8080', 100.0);
    assert.strictEqual(Math.round(balancer.getLatency('http://srv-1.internal:8080') * 10) / 10, 34.4);
  });

  it('routes traffic to the upstream with lowest recorded EWMA latency', () => {
    const servers = createServers();
    const balancer = new EWMALatencyBalancer(servers, 0.5);

    // Srv-1 gets degraded (high latency)
    balancer.recordLatency('http://srv-1.internal:8080', 250);
    // Srv-2 gets fast latency (2ms)
    balancer.recordLatency('http://srv-2.internal:8080', 2);
    // Srv-3 stays at baseline (10ms)

    const selected = balancer.getNext();
    assert.strictEqual(selected.url, 'http://srv-2.internal:8080');
  });

  it('skips unhealthy nodes even if their recorded EWMA latency was low', () => {
    const servers = createServers();
    const balancer = new EWMALatencyBalancer(servers, 0.5);

    // Srv-2 has lowest latency
    balancer.recordLatency('http://srv-2.internal:8080', 1);

    // But Srv-2 becomes unhealthy
    servers[1].isHealthy = false;

    const selected = balancer.getNext();
    // Must select either srv-1 or srv-3 (both healthy)
    assert.notStrictEqual(selected.url, 'http://srv-2.internal:8080');
    assert.strictEqual(selected.isHealthy, true);
  });
});
