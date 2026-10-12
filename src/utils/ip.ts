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

/**
 * Converts an IPv4 address string to an unsigned 32-bit integer
 */
export function ipv4ToInt(ip: string): number {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(o => isNaN(o) || o < 0 || o > 255)) {
    throw new Error(`Invalid IPv4 address format: ${ip}`);
  }
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

/**
 * Determines whether an IPv4 address falls within a CIDR subnet block (e.g., 192.168.1.0/24)
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, prefixStr] = cidr.split('/');
    const prefix = prefixStr !== undefined ? parseInt(prefixStr, 10) : 32;

    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }

    const ipInt = ipv4ToInt(ip);
    const rangeInt = ipv4ToInt(range);

    if (prefix === 0) return true;

    const mask = (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  } catch {
    return false;
  }
}

/**
 * Validates if an IP address is permitted against an ACL CIDR whitelist
 */
export function isIpAllowed(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) return true;
  return whitelist.some(cidr => isIpInCidr(ip, cidr));
}

