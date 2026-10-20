/**
 * HyperRoute - Cryptographic JWT Token Verification
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

export interface TokenPayload {
  sub: string;
  role: string;
  exp: number;
}

export function verifyBearerToken(authHeader?: string): { valid: boolean; payload?: TokenPayload } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }

  const token = authHeader.substring(7);
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false };
  }

  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
    const payload: TokenPayload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return { valid: false }; // Token expired
    }

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}
