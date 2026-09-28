import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { HMACValidator, ReplayAttackDefense } from '../src/security/hmac.js';

describe('HMAC Signature Validator', () => {
  it('validates authentic signatures and rejects forged signatures', () => {
    const secret = 'super-secret-key-123';
    const payload = JSON.stringify({ event: 'payment.success', amount: 500 });
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    assert.strictEqual(HMACValidator.verifySignature(payload, signature, secret), true);
    assert.strictEqual(HMACValidator.verifySignature(payload, 'forged-signature', secret), false);
  });

  it('rejects stale timestamp skew beyond 5 minutes', () => {
    const now = Date.now();
    assert.strictEqual(ReplayAttackDefense.isTimestampValid(now - 10000, 300000, now), true);
    assert.strictEqual(ReplayAttackDefense.isTimestampValid(now - 400000, 300000, now), false);
  });
});