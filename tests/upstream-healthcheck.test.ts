/**
 * HyperRoute - Active Upstream Health Probe & Node Eviction Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

interface UpstreamNode {
  url: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastChecked: number;
}

class ActiveHealthChecker {
  private nodes: Map<string, UpstreamNode> = new Map();
  private failureThreshold: number;
  private recoveryThreshold: number;

  constructor(options: { failureThreshold?: number; recoveryThreshold?: number } = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.recoveryThreshold = options.recoveryThreshold ?? 2;
  }

  public registerNode(url: string): void {
    this.nodes.set(url, {
      url,
      isHealthy: true,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastChecked: Date.now(),
    });
  }

  public recordProbeResult(url: string, success: boolean, now = Date.now()): void {
    const node = this.nodes.get(url);
    if (!node) return;

    node.lastChecked = now;
    if (success) {
      node.consecutiveSuccesses++;
      node.consecutiveFailures = 0;
      if (!node.isHealthy && node.consecutiveSuccesses >= this.recoveryThreshold) {
        node.isHealthy = true;
      }
    } else {
      node.consecutiveFailures++;
      node.consecutiveSuccesses = 0;
      if (node.isHealthy && node.consecutiveFailures >= this.failureThreshold) {
        node.isHealthy = false;
      }
    }
  }

  public getHealthyUpstreams(): string[] {
    const healthy: string[] = [];
    for (const [url, node] of this.nodes.entries()) {
      if (node.isHealthy) healthy.push(url);
    }
    return healthy;
  }

  public isNodeHealthy(url: string): boolean {
    return this.nodes.get(url)?.isHealthy ?? false;
  }
}

describe('Active Upstream Health Probe & Node Eviction', () => {
  it('evicts faulty nodes after crossing consecutive failure threshold', () => {
    const checker = new ActiveHealthChecker({ failureThreshold: 3, recoveryThreshold: 2 });
    checker.registerNode('http://node-alpha:8080');
    checker.registerNode('http://node-beta:8080');

    // 2 failures: still healthy
    checker.recordProbeResult('http://node-alpha:8080', false);
    checker.recordProbeResult('http://node-alpha:8080', false);
    assert.strictEqual(checker.isNodeHealthy('http://node-alpha:8080'), true);

    // 3rd failure: evicted
    checker.recordProbeResult('http://node-alpha:8080', false);
    assert.strictEqual(checker.isNodeHealthy('http://node-alpha:8080'), false);
    assert.deepStrictEqual(checker.getHealthyUpstreams(), ['http://node-beta:8080']);
  });

  it('restores unhealthy node only after consecutive recovery threshold satisfied', () => {
    const checker = new ActiveHealthChecker({ failureThreshold: 2, recoveryThreshold: 2 });
    checker.registerNode('http://node-gamma:8080');

    checker.recordProbeResult('http://node-gamma:8080', false);
    checker.recordProbeResult('http://node-gamma:8080', false);
    assert.strictEqual(checker.isNodeHealthy('http://node-gamma:8080'), false);

    // 1 success: still deemed probation / unhealthy
    checker.recordProbeResult('http://node-gamma:8080', true);
    assert.strictEqual(checker.isNodeHealthy('http://node-gamma:8080'), false);

    // 2nd consecutive success: reinstated
    checker.recordProbeResult('http://node-gamma:8080', true);
    assert.strictEqual(checker.isNodeHealthy('http://node-gamma:8080'), true);
  });
});
