/**
 * HyperRoute - High-Entropy Cryptographic Request ID & Correlation Generator
 * 
 * Generates unique distributed tracing IDs containing timestamp component
 * and cryptographically secure random entropy.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import crypto from 'node:crypto';

export class RequestIdGenerator {
  private static readonly PREFIX = 'hr';

  /**
   * Generates a high-entropy, time-ordered distributed correlation ID
   * Format: hr-<epoch_hex_12char>-<random_hex_16char>
   */
  public static generate(now: number = Date.now()): string {
    const timeHex = now.toString(16).padStart(12, '0');
    const randomHex = crypto.randomBytes(8).toString('hex');
    return `${this.PREFIX}-${timeHex}-${randomHex}`;
  }

  /**
   * Validates whether a string matches HyperRoute request ID specification
   */
  public static isValid(id: string): boolean {
    return /^hr-[0-9a-f]{12}-[0-9a-f]{16}$/i.test(id);
  }

  /**
   * Extracts Unix epoch timestamp from a valid request ID
   */
  public static extractTimestamp(id: string): number | null {
    if (!this.isValid(id)) return null;
    const parts = id.split('-');
    const timeHex = parts[1];
    const timestamp = parseInt(timeHex, 16);
    return isNaN(timestamp) ? null : timestamp;
  }
}
