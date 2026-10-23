/**
 * HyperRoute - Weighted Traffic Canary Splitter
 * 
 * Provides deterministic, hash-pinned traffic splitting for blue-green and canary deployments.
 * Evaluates consistent hash slots against client identifiers (e.g. IP, user UUID, or session token)
 * to guarantee zero session flap across rolling deployments.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import { createHash } from 'node:crypto';

export interface CanaryConfig {
  stableUpstream: string;
  canaryUpstream: string;
  canaryWeightPercentage: number; // 0 to 100
  headerOverrideKey?: string;
}

export interface CanaryDecision {
  selectedUpstream: string;
  isCanary: boolean;
  hashSlot: number;
  reason: 'STICKY_OVERRIDE' | 'HASH_SPLIT' | 'WEIGHT_BOUNDARY';
}

export class CanaryRouter {
  private config: CanaryConfig;

  constructor(config: CanaryConfig) {
    this.config = {
      stableUpstream: config.stableUpstream,
      canaryUpstream: config.canaryUpstream,
      canaryWeightPercentage: Math.max(0, Math.min(100, config.canaryWeightPercentage)),
      headerOverrideKey: config.headerOverrideKey ?? 'x-canary-override',
    };
  }

  /**
   * Evaluates routing decision based on client key and headers
   */
  public route(clientIdentifier: string, headers: Record<string, string | undefined> = {}): CanaryDecision {
    // 1. Explicit Header Override Check
    const overrideVal = headers[this.config.headerOverrideKey!.toLowerCase()];
    if (overrideVal === 'true' || overrideVal === 'canary' || overrideVal === '1') {
      return {
        selectedUpstream: this.config.canaryUpstream,
        isCanary: true,
        hashSlot: 0,
        reason: 'STICKY_OVERRIDE',
      };
    }
    if (overrideVal === 'false' || overrideVal === 'stable' || overrideVal === '0') {
      return {
        selectedUpstream: this.config.stableUpstream,
        isCanary: false,
        hashSlot: 100,
        reason: 'STICKY_OVERRIDE',
      };
    }

    // 2. Short-circuit 0% and 100% boundary conditions
    if (this.config.canaryWeightPercentage <= 0) {
      return {
        selectedUpstream: this.config.stableUpstream,
        isCanary: false,
        hashSlot: 100,
        reason: 'WEIGHT_BOUNDARY',
      };
    }
    if (this.config.canaryWeightPercentage >= 100) {
      return {
        selectedUpstream: this.config.canaryUpstream,
        isCanary: true,
        hashSlot: 0,
        reason: 'WEIGHT_BOUNDARY',
      };
    }

    // 3. Deterministic Consistent Hash Slot [0, 99]
    const hash = createHash('sha256').update(clientIdentifier).digest();
    const hashSlot = hash.readUInt32BE(0) % 100;

    const isCanary = hashSlot < this.config.canaryWeightPercentage;
    return {
      selectedUpstream: isCanary ? this.config.canaryUpstream : this.config.stableUpstream,
      isCanary,
      hashSlot,
      reason: 'HASH_SPLIT',
    };
  }

  /**
   * Dynamically adjusts canary weight percentage
   */
  public setWeight(percentage: number): void {
    this.config.canaryWeightPercentage = Math.max(0, Math.min(100, percentage));
  }

  public getConfig(): Readonly<CanaryConfig> {
    return { ...this.config };
  }
}
