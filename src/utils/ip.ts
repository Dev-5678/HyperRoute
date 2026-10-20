/**
 * HyperRoute - Client IP & Subnet Extraction Utilities
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import http from 'node:http';

export function getClientIp(req: http.IncomingMessage): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}
