export const SECURITY_CONFIG = {
  ALLOWED_EXTENSIONS: ['.gz', '.tar.gz'],
  MAX_CONCURRENT_DOWNLOADS: 10,
  MAX_CONCURRENT_CONNECTIONS: 100,
  MAX_SLOW_CONNECTIONS: 50,
  
  DOWNLOAD_SLOW_LORIS: {
    MAX_SLOW_DOWNLOADS: 5,
    MIN_TRANSFER_RATE: 256,
    MAX_DOWNLOAD_DURATION: 3600000,
    SLOW_DOWNLOAD_THRESHOLD: 128,
    BLOCK_DURATION: 300000,
  },
  SESSION_TIMEOUT: 30 * 60 * 1000,
  REQUEST_TIMEOUT: 60000,
  RESPONSE_TIMEOUT: 120000,
  CONNECTION_TIMEOUT: 300000,
  SLOW_LORIS_BLOCK_DURATION: 600000,
  SLOW_LORIS_GRACE_PERIOD: 30000,
  
  RATE_LIMIT: {
    windowMs: 60 * 1000,
    max: 200,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req: any) => req.ip,
    skip: (req: any) => {
      return req.path.startsWith('/snapshots/') && req.method === 'GET';
    },
    handler: (req: any, res: any) => {
      res.status(429).json({ 
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(60 / 1000)
      });
    }
  },
  
  DOWNLOAD_RATE_LIMIT: {
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many download requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
    keyGenerator: (req: any) => req.ip,
    handler: (req: any, res: any) => {
      res.status(429).json({ 
        error: 'Too many download requests from this IP, please try again later.',
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
  REQUEST_SIZE_LIMIT: '10kb',
  FILENAME_REGEX: /^[a-zA-Z0-9._-]+\.(gz|tar\.gz|header\.json)$/,
  STRICT_FILENAME_REGEX: /^snapshot_\d+_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(gz|tar\.gz|header\.json)$/,
  MAX_FILENAME_LENGTH: 255,
  ALLOWED_MIME_TYPES: ['application/gzip', 'application/octet-stream', 'application/json'],
  
  PRODUCTION: {
    ENABLE_LOGGING: true,
    LOG_LEVEL: 'warn',
    ENABLE_METRICS: true,
    METRICS_INTERVAL: 60000,
    MAX_LOG_SIZE: 100 * 1024 * 1024,
    MAX_LOG_FILES: 5,
    ENABLE_HEALTH_CHECKS: true,
    HEALTH_CHECK_INTERVAL: 30000,
  }
};