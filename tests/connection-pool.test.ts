/**
 * HyperRoute - Connection Pool & Keep-Alive Recycling Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

interface SocketConnection {
  id: string;
  host: string;
  port: number;
  idleSince: number;
  inUse: boolean;
  totalRequests: number;
}

class UpstreamConnectionPool {
  private pool: Map<string, SocketConnection[]> = new Map();
  private maxSocketsPerHost: number;
  private idleTimeoutMs: number;

  constructor(options: { maxSocketsPerHost?: number; idleTimeoutMs?: number } = {}) {
    this.maxSocketsPerHost = options.maxSocketsPerHost ?? 10;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 5000;
  }

  public acquire(host: string, port: number): SocketConnection {
    const key = `${host}:${port}`;
    let sockets = this.pool.get(key);
    if (!sockets) {
      sockets = [];
      this.pool.set(key, sockets);
    }

    const now = Date.now();
    // Prune expired sockets
    for (let i = sockets.length - 1; i >= 0; i--) {
      if (!sockets[i].inUse && now - sockets[i].idleSince > this.idleTimeoutMs) {
        sockets.splice(i, 1);
      }
    }

    // Reuse existing idle socket
    const idleSocket = sockets.find((s) => !s.inUse);
    if (idleSocket) {
      idleSocket.inUse = true;
      idleSocket.totalRequests++;
      return idleSocket;
    }

    if (sockets.length >= this.maxSocketsPerHost) {
      throw new Error(`Max sockets reached for upstream ${key}`);
    }

    const newSocket: SocketConnection = {
      id: `sock_${Math.random().toString(36).substring(2, 9)}`,
      host,
      port,
      idleSince: now,
      inUse: true,
      totalRequests: 1,
    };
    sockets.push(newSocket);
    return newSocket;
  }

  public release(socket: SocketConnection): void {
    socket.inUse = false;
    socket.idleSince = Date.now();
  }

  public getActiveCount(host: string, port: number): number {
    const key = `${host}:${port}`;
    return this.pool.get(key)?.filter((s) => s.inUse).length ?? 0;
  }

  public getTotalSockets(host: string, port: number): number {
    return this.pool.get(`${host}:${port}`)?.length ?? 0;
  }
}

describe('Upstream Connection Pool & Keep-Alive Recycling', () => {
  it('reuses idle connections instead of creating redundant sockets', () => {
    const pool = new UpstreamConnectionPool({ maxSocketsPerHost: 5, idleTimeoutMs: 10000 });
    const conn1 = pool.acquire('10.0.0.1', 8080);
    assert.strictEqual(pool.getTotalSockets('10.0.0.1', 8080), 1);
    assert.strictEqual(conn1.totalRequests, 1);

    pool.release(conn1);
    assert.strictEqual(pool.getActiveCount('10.0.0.1', 8080), 0);

    const conn2 = pool.acquire('10.0.0.1', 8080);
    assert.strictEqual(conn2.id, conn1.id, 'Should recycle the exact same socket connection');
    assert.strictEqual(conn2.totalRequests, 2);
    pool.release(conn2);
  });

  it('enforces max sockets per host and rejects over-subscription', () => {
    const pool = new UpstreamConnectionPool({ maxSocketsPerHost: 2 });
    const c1 = pool.acquire('upstream-cluster', 443);
    const c2 = pool.acquire('upstream-cluster', 443);
    assert.strictEqual(pool.getActiveCount('upstream-cluster', 443), 2);

    assert.throws(() => {
      pool.acquire('upstream-cluster', 443);
    }, /Max sockets reached/);

    pool.release(c1);
    const c3 = pool.acquire('upstream-cluster', 443);
    assert.strictEqual(c3.id, c1.id);
    pool.release(c2);
    pool.release(c3);
  });
});
