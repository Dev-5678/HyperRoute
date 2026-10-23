/**
 * HyperRoute - Canary Router Unit Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CanaryRouter } from '../src/proxy/canary-router';

describe('Weighted Traffic Canary Splitter', () => {
  it('honors sticky header overrides regardless of hash calculation', () => {
    const router = new CanaryRouter({
      stableUpstream: 'http://upstream-v1',
      canaryUpstream: 'http://upstream-v2',
      canaryWeightPercentage: 10,
    });

    // Forced canary override
    const canaryDecision = router.route('client-123', { 'x-canary-override': 'true' });
    assert.strictEqual(canaryDecision.selectedUpstream, 'http://upstream-v2');
    assert.strictEqual(canaryDecision.isCanary, true);
    assert.strictEqual(canaryDecision.reason, 'STICKY_OVERRIDE');

    // Forced stable override
    const stableDecision = router.route('client-123', { 'x-canary-override': 'false' });
    assert.strictEqual(stableDecision.selectedUpstream, 'http://upstream-v1');
    assert.strictEqual(stableDecision.isCanary, false);
    assert.strictEqual(stableDecision.reason, 'STICKY_OVERRIDE');
  });

  it('pins identical client identifiers deterministically to same upstream', () => {
    const router = new CanaryRouter({
      stableUpstream: 'http://upstream-v1',
      canaryUpstream: 'http://upstream-v2',
      canaryWeightPercentage: 25,
    });

    const decisionA = router.route('user-session-abc-999');
    const decisionB = router.route('user-session-abc-999');

    assert.strictEqual(decisionA.selectedUpstream, decisionB.selectedUpstream);
    assert.strictEqual(decisionA.hashSlot, decisionB.hashSlot);
    assert.strictEqual(decisionA.isCanary, decisionB.isCanary);
  });

  it('distributes large sample of clients closely matching weight percentage', () => {
    const canaryPercentage = 30;
    const router = new CanaryRouter({
      stableUpstream: 'http://upstream-v1',
      canaryUpstream: 'http://upstream-v2',
      canaryWeightPercentage: canaryPercentage,
    });

    let canaryCount = 0;
    const totalSamples = 1000;

    for (let i = 0; i < totalSamples; i++) {
      const decision = router.route(`ip-192.168.1.${i}`);
      if (decision.isCanary) canaryCount++;
    }

    const observedRatio = (canaryCount / totalSamples) * 100;
    // Expected ~30%, tolerance +/- 5%
    assert.ok(
      observedRatio >= 25 && observedRatio <= 35,
      `Observed canary ratio ${observedRatio}% should be within [25%, 35%]`
    );
  });
});
