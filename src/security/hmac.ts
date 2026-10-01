import crypto from 'node:crypto';
export interface WebhookSignatureConfig {
  secret: string;
  headerName: string;
  maxSkewSec: number;
}

export class HMACValidator {
  public static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}