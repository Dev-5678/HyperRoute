/**
 * HyperRoute - Correlation & Tracing Headers Middleware
 * 
 * Injects and propagates high-resolution distributed tracing IDs and metadata
 * across request/response gateway lifecycles.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import http from 'node:http';
import { RequestIdGenerator } from '../utils/request-id.js';

export interface TracingOptions {
  headerName?: string;
  gatewayIdentifier?: string;
}

export class TracingHeadersMiddleware {
  private headerName: string;
  private gatewayIdentifier: string;

  constructor(options: TracingOptions = {}) {
    this.headerName = options.headerName || 'x-request-id';
    this.gatewayIdentifier = options.gatewayIdentifier || 'HyperRoute/1.1.0';
  }

  public handle(req: http.IncomingMessage, res: http.ServerResponse, next: () => void): void {
    const start = performance.now();
    const existingId = req.headers[this.headerName];

    let requestId: string;
    if (typeof existingId === 'string' && existingId.trim().length > 0) {
      requestId = existingId.trim();
    } else {
      requestId = RequestIdGenerator.generate();
      req.headers[this.headerName] = requestId;
    }

    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Gateway', this.gatewayIdentifier);
    res.setHeader('X-Correlation-Timestamp', Date.now().toString());

    // Intercept finish to compute response time header
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const elapsedMs = (performance.now() - start).toFixed(2);
      if (!res.headersSent) {
        res.setHeader('X-Response-Time-Ms', elapsedMs);
      }
      return originalEnd.apply(this, args as any);
    };

    next();
  }
}
