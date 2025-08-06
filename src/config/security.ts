export const SECURITY_CONFIG = {
  ALLOWED_EXTENSIONS: ['.gz', '.tar.gz'],
  MAX_CONCURRENT_DOWNLOADS: 5,
  SESSION_TIMEOUT: 30 * 60 * 1000,
  RATE_LIMIT: {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req: any) => req.ip,
    handler: (req: any, res: any) => {
      console.warn(`[SECURITY] Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ 
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(60 / 1000)
      });
    }
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
  FILENAME_REGEX: /^[a-zA-Z0-9._-]+\.(gz|tar\.gz|header\.json)$/,
  STRICT_FILENAME_REGEX: /^snapshot_\d+_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(gz|tar\.gz|header\.json)$/,
  MAX_FILENAME_LENGTH: 255,
  ALLOWED_MIME_TYPES: ['application/gzip', 'application/octet-stream', 'application/json']
};