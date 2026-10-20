/**
 * HyperRoute - Reverse Proxy Router & Route Matcher
 * 
 * High-performance URL prefix trie/matching with upstream forwarding,
 * request header manipulation, and latency measurement.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import { LoadBalancer } from '../balancer/load-balancer.js';

export interface RouteRule {
  pathPrefix: string;
  loadBalancer: LoadBalancer;
  stripPrefix?: boolean;
  rateLimitKey?: string;
}

export class ProxyRouter {
  private routes: RouteRule[] = [];

  public registerRoute(rule: RouteRule): void {
    this.routes.push(rule);
    // Sort by prefix length descending for longest prefix match
    this.routes.sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
  }

  public matchRoute(urlPath: string): { rule: RouteRule; targetPath: string } | null {
    for (const rule of this.routes) {
      if (urlPath.startsWith(rule.pathPrefix)) {
        let targetPath = urlPath;
        if (rule.stripPrefix) {
          targetPath = urlPath.slice(rule.pathPrefix.length) || '/';
        }
        return { rule, targetPath };
      }
    }
    return null;
  }
}
