export interface CacheEntry {
  body: string;
  statusCode: number;
  headers: Record<string, string>;
  createdAt: number;
  ttlMs: number;
}
export class EdgeResponseCache {
  private store: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  constructor(maxEntries = 5000) { this.maxEntries = maxEntries; }
  public get(key: string, now = Date.now()): CacheEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (now - entry.createdAt > entry.ttlMs) { this.store.delete(key); return null; }
    return entry;
  }
  public set(key: string, entry: CacheEntry): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, entry);
  }
}
export class StaleWhileRevalidatePolicy {
  public static isStale(entry: CacheEntry, now = Date.now()): boolean {
    return now - entry.createdAt > entry.ttlMs * 0.75;
  }
}