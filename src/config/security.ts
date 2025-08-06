// Enhanced security configuration
export const SECURITY_CONFIG = {
    ALLOWED_EXTENSIONS: ['.gz', '.tar.gz'],
    MAX_FILE_SIZE: 1024 * 1024 * 1024,
    RATE_LIMIT: {
      windowMs: 60 * 1000,
      max: 20,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    HELMET_CONFIG: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true,
      frameguard: { action: 'deny' as const },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const }
    },
    REQUEST_SIZE_LIMIT: '1kb',
    FILENAME_REGEX: /^[a-zA-Z0-9._-]+\.(gz|tar\.gz)$/,
    MAX_FILENAME_LENGTH: 255,
    ALLOWED_MIME_TYPES: ['application/gzip', 'application/octet-stream']
  };