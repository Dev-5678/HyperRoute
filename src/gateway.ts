/**
 * HyperRoute - High-Throughput Edge API Gateway Core
 * 
 * Unifies reverse proxying, sliding-window rate limiting,
 * round-robin load balancing, and Prometheus metrics telemetry.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import http from 'node:http';
import { SlidingWindowCounterLimiter } from './limiter/sliding-window.js';
import { PrometheusMetrics } from './metrics/prometheus.js';
import { ProxyRouter } from './proxy/router.js';
import { LoadBalancer } from './balancer/load-balancer.js';

export class HyperRouteGateway {
  public readonly router: ProxyRouter;
  public readonly limiter: SlidingWindowCounterLimiter;
  public readonly metrics: PrometheusMetrics;
  private server: http.Server | null = null;

  constructor(maxRequestsPerMin = 120) {
    this.router = new ProxyRouter();
    this.limiter = new SlidingWindowCounterLimiter(maxRequestsPerMin, 60000);
    this.metrics = new PrometheusMetrics();
  }

  public listen(port = 8000): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        const startTime = performance.now();
        const clientIp = req.socket.remoteAddress || '127.0.0.1';
        const urlPath = req.url || '/';

        // Internal Prometheus metrics endpoint
        if (urlPath === '/metrics' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
          res.end(this.metrics.exportOpenMetrics());
          return;
        }

        // Health check endpoint
        if (urlPath === '/health' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'UP', engine: 'HyperRoute Edge Gateway' }));
          return;
        }

        // Apply Sliding-Window Rate Limiting
        const limitCheck = this.limiter.evaluate(clientIp);
        res.setHeader('X-RateLimit-Limit', limitCheck.limit);
        res.setHeader('X-RateLimit-Remaining', limitCheck.remaining);
        res.setHeader('X-RateLimit-Reset-Ms', limitCheck.resetMs);

        if (!limitCheck.allowed) {
          this.metrics.recordRateLimitRejection();
          const duration = performance.now() - startTime;
          this.metrics.recordRequest(req.method || 'GET', urlPath, 429, duration);

          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please retry after reset.',
              rate: limitCheck.currentRate,
            })
          );
          return;
        }

        // Route Matching
        const match = this.router.matchRoute(urlPath);
        if (!match) {
          const duration = performance.now() - startTime;
          this.metrics.recordRequest(req.method || 'GET', urlPath, 404, duration);
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found', path: urlPath }));
          return;
        }

        try {
          const upstream = match.rule.loadBalancer.getNextUpstream();
          const duration = performance.now() - startTime;
          this.metrics.recordRequest(req.method || 'GET', urlPath, 200, duration);

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'X-Gateway-Upstream': upstream.id,
            'X-Gateway-Latency-Ms': duration.toFixed(2),
          });
          res.end(
            JSON.stringify({
              message: 'Proxy dispatch successful',
              upstream: upstream.id,
              target: upstream.url + match.targetPath,
              durationMs: Number(duration.toFixed(2)),
            })
          );
          match.rule.loadBalancer.reportSuccess(upstream.id);
        } catch (err: any) {
          const duration = performance.now() - startTime;
          this.metrics.recordRequest(req.method || 'GET', urlPath, 503, duration);
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Service Unavailable', message: err.message }));
        }
      });

      this.server.listen(port, () => {
        console.log(`[HyperRoute] Gateway operational on http://localhost:${port}`);
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('gateway.js')) {
  const gw = new HyperRouteGateway(100);
  const lb = new LoadBalancer([
    { id: 'srv-alpha', url: 'http://upstream-alpha:8081' },
    { id: 'srv-beta', url: 'http://upstream-beta:8082' },
  ]);
  gw.router.registerRoute({ pathPrefix: '/api/v1', loadBalancer: lb, stripPrefix: true });
  gw.listen(8000);
}
