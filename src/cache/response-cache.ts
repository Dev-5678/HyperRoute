export interface CacheEntry {
  body: string;
  statusCode: number;
  headers: Record<string, string>;
  createdAt: number;
  ttlMs: number;
}