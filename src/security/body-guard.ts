/**
 * HyperRoute - Request Body Size Guard & Content-Type Whitelist Middleware
 * 
 * Protects downstream edge gateways and services against payload exhaustion attacks,
 * oversized multipart uploads, and MIME-type confusion vulnerabilities.
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

export interface BodyGuardConfig {
  maxBytes: number;
  allowedContentTypes: string[];
  allowEmptyBody: boolean;
  rejectUnknownContentType: boolean;
}

export interface BodyInspectionResult {
  allowed: boolean;
  statusCode: number;
  error?: string;
  bytesInspected: number;
  detectedMimeType?: string;
}

export class RequestBodyGuard {
  private config: BodyGuardConfig;

  constructor(config: Partial<BodyGuardConfig> = {}) {
    this.config = {
      maxBytes: config.maxBytes ?? 10 * 1024 * 1024, // 10MB default
      allowedContentTypes: (config.allowedContentTypes ?? [
        'application/json',
        'application/x-www-form-urlencoded',
        'text/plain',
        'application/octet-stream',
      ]).map((t) => t.toLowerCase()),
      allowEmptyBody: config.allowEmptyBody ?? true,
      rejectUnknownContentType: config.rejectUnknownContentType ?? true,
    };
  }

  /**
   * Inspects incoming request headers and body payload size
   */
  public inspect(
    contentLengthHeader: string | undefined,
    contentTypeHeader: string | undefined,
    body?: string | Buffer | null
  ): BodyInspectionResult {
    // 1. Content-Length Header Guard
    if (contentLengthHeader !== undefined) {
      const parsedLength = parseInt(contentLengthHeader, 10);
      if (Number.isNaN(parsedLength) || parsedLength < 0) {
        return {
          allowed: false,
          statusCode: 400,
          error: 'Invalid Content-Length header value',
          bytesInspected: 0,
        };
      }

      if (parsedLength > this.config.maxBytes) {
        return {
          allowed: false,
          statusCode: 413,
          error: `Payload Too Large: Content-Length ${parsedLength} exceeds max allowed ${this.config.maxBytes} bytes`,
          bytesInspected: parsedLength,
        };
      }
    }

    // 2. Actual Body Size Guard
    let actualBytes = 0;
    if (body !== undefined && body !== null) {
      actualBytes = typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : body.length;
      if (actualBytes > this.config.maxBytes) {
        return {
          allowed: false,
          statusCode: 413,
          error: `Payload Too Large: Actual byte size ${actualBytes} exceeds max allowed ${this.config.maxBytes} bytes`,
          bytesInspected: actualBytes,
        };
      }
    }

    // 3. Empty body handling
    if (actualBytes === 0 && (!contentLengthHeader || contentLengthHeader === '0')) {
      if (this.config.allowEmptyBody) {
        return {
          allowed: true,
          statusCode: 200,
          bytesInspected: 0,
        };
      }
      return {
        allowed: false,
        statusCode: 400,
        error: 'Empty request body is disallowed for this endpoint',
        bytesInspected: 0,
      };
    }

    // 4. Content-Type Whitelist Validation
    if (contentTypeHeader) {
      const baseMime = contentTypeHeader.split(';')[0].trim().toLowerCase();
      const isAllowed = this.config.allowedContentTypes.some(
        (allowed) => allowed === baseMime || (allowed.endsWith('/*') && baseMime.startsWith(allowed.slice(0, -1)))
      );

      if (!isAllowed) {
        return {
          allowed: false,
          statusCode: 415,
          error: `Unsupported Media Type: ${baseMime} is not in the allowed content-type whitelist`,
          bytesInspected: actualBytes,
          detectedMimeType: baseMime,
        };
      }

      return {
        allowed: true,
        statusCode: 200,
        bytesInspected: actualBytes,
        detectedMimeType: baseMime,
      };
    }

    // Missing Content-Type when body exists
    if (this.config.rejectUnknownContentType && actualBytes > 0) {
      return {
        allowed: false,
        statusCode: 415,
        error: 'Unsupported Media Type: Content-Type header must be specified for non-empty request bodies',
        bytesInspected: actualBytes,
      };
    }

    return {
      allowed: true,
      statusCode: 200,
      bytesInspected: actualBytes,
    };
  }

  public getConfig(): Readonly<BodyGuardConfig> {
    return { ...this.config };
  }
}
