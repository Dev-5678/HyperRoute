/**
 * HyperRoute - High-Speed CORS Middleware
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import http from 'node:http';

export function applyCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true; // Preflight handled
  }
  return false;
}
