/**
 * HyperRoute - Prometheus Observability & Metrics Exporter
 * 
 * Tracks request throughput, HTTP response codes, latency histograms,
 * and rate-limiting rejections adhering to OpenMetrics format.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

export class PrometheusMetrics {
  private requestCounter: Map<string, number> = new Map();
  private rateLimitRejections = 0;
  private latencies: number[] = [];

  public recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const key = `${method}:${path}:${statusCode}`;
    this.requestCounter.set(key, (this.requestCounter.get(key) || 0) + 1);
    this.latencies.push(durationMs);

    // Keep sliding window of last 10,000 latencies
    if (this.latencies.length > 10000) {
      this.latencies.shift();
    }
  }

  public recordRateLimitRejection(): void {
    this.rateLimitRejections++;
  }

  public getPercentile(p: number): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.floor((p / 100) * (sorted.length - 1));
    return Number(sorted[index].toFixed(2));
  }

  public exportOpenMetrics(): string {
    let output = '# HELP hyperroute_requests_total Total number of HTTP requests processed\n';
    output += '# TYPE hyperroute_requests_total counter\n';
    for (const [labels, count] of this.requestCounter.entries()) {
      const [method, path, status] = labels.split(':');
      output += `hyperroute_requests_total{method="${method}",path="${path}",status="${status}"} ${count}\n`;
    }

    output += '\n# HELP hyperroute_ratelimit_rejections_total Total requests rejected due to 429\n';
    output += '# TYPE hyperroute_ratelimit_rejections_total counter\n';
    output += `hyperroute_ratelimit_rejections_total ${this.rateLimitRejections}\n`;

    output += '\n# HELP hyperroute_latency_ms Latency percentiles in milliseconds\n';
    output += '# TYPE hyperroute_latency_ms gauge\n';
    output += `hyperroute_latency_ms{quantile="0.50"} ${this.getPercentile(50)}\n`;
    output += `hyperroute_latency_ms{quantile="0.95"} ${this.getPercentile(95)}\n`;
    output += `hyperroute_latency_ms{quantile="0.99"} ${this.getPercentile(99)}\n`;

    return output;
  }
}
