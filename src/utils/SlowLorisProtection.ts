import { Request, Response, NextFunction } from 'express';
import { SECURITY_CONFIG } from '../config/security';

interface ConnectionTracker {
  ip: string;
  connections: number;
  slowConnections: number;
  lastActivity: number;
  isBlocked: boolean;
  blockUntil: number;
  firstConnection: number;
  requestCount: number;
  timeoutCount: number;
}

interface DownloadTracker {
  ip: string;
  activeDownloads: number;
  slowDownloads: number;
  totalBytesTransferred: number;
  lastActivity: number;
  isBlocked: boolean;
  blockUntil: number;
  downloadStartTime: number;
  lastTransferTime: number;
  transferRate: number; // bytes per second
}

export class SlowLorisProtection {
  private static connectionMap = new Map<string, ConnectionTracker>();
  private static downloadMap = new Map<string, DownloadTracker>();
  private static cleanupInterval: NodeJS.Timeout;

  static {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredConnections();
    }, 30000);
  }

  static middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      if (req.path.startsWith('/snapshots/') && req.method === 'GET') {
        return this.handleDownloadProtection(req, res, next, clientIp);
      }
      
      if (this.isIpBlocked(clientIp)) {
        res.status(429).json({ 
          error: `Too many slow connections from this IP (${clientIp})`,
          retryAfter: Math.ceil((this.getBlockTime(clientIp) - Date.now()) / 1000)
        });
        return;
      }

      this.addConnection(clientIp);
      this.setupConnectionTimeouts(req, res, clientIp);

      res.on('finish', () => {
        this.removeConnection(clientIp);
      });

      res.on('close', () => {
        this.removeConnection(clientIp);
      });

      next();
    };
  }

  private static isIpBlocked(ip: string): boolean {
    const tracker = this.connectionMap.get(ip);
    if (!tracker) return false;
    
    if (tracker.isBlocked && Date.now() < tracker.blockUntil) {
      return true;
    }
    
    if (tracker.isBlocked && Date.now() >= tracker.blockUntil) {
      tracker.isBlocked = false;
      tracker.blockUntil = 0;
    }
    
    return false;
  }

  private static getBlockTime(ip: string): number {
    const tracker = this.connectionMap.get(ip);
    return tracker?.blockUntil || 0;
  }

  private static addConnection(ip: string): void {
    let tracker = this.connectionMap.get(ip);
    
    if (!tracker) {
      tracker = {
        ip,
        connections: 0,
        slowConnections: 0,
        lastActivity: Date.now(),
        isBlocked: false,
        blockUntil: 0,
        firstConnection: Date.now(),
        requestCount: 0,
        timeoutCount: 0
      };
      this.connectionMap.set(ip, tracker);
    }

    tracker.connections++;
    tracker.lastActivity = Date.now();
    tracker.requestCount++;

    const now = Date.now();
    const timeSinceFirstConnection = now - tracker.firstConnection;
    
    const adaptiveThreshold = Math.min(
      SECURITY_CONFIG.MAX_CONCURRENT_CONNECTIONS,
      Math.max(20, Math.floor(timeSinceFirstConnection / 5000))
    );

    const timeoutRatio = tracker.timeoutCount / Math.max(tracker.requestCount, 1);
    const shouldBlock = tracker.connections > adaptiveThreshold && 
                       timeSinceFirstConnection > SECURITY_CONFIG.SLOW_LORIS_GRACE_PERIOD &&
                       (timeoutRatio > 0.5 || tracker.connections > SECURITY_CONFIG.MAX_SLOW_CONNECTIONS); // Ratio plus tolérant

    if (shouldBlock) {
      tracker.isBlocked = true;
      tracker.blockUntil = now + SECURITY_CONFIG.SLOW_LORIS_BLOCK_DURATION;
    }
  }

  private static removeConnection(ip: string): void {
    const tracker = this.connectionMap.get(ip);
    if (tracker && tracker.connections > 0) {
      tracker.connections--;
      tracker.lastActivity = Date.now();
    }
  }

  private static setupConnectionTimeouts(req: Request, res: Response, clientIp: string): void {
    req.setTimeout(SECURITY_CONFIG.REQUEST_TIMEOUT, () => {
      this.recordTimeout(clientIp);
      if (!res.headersSent) {
        res.status(408).json({ error: 'Request timeout' });
      }
    });

    res.setTimeout(SECURITY_CONFIG.RESPONSE_TIMEOUT, () => {
      this.recordTimeout(clientIp);
      if (!res.headersSent) {
        res.status(408).json({ error: 'Response timeout' });
      }
    });

    const connectionTimeout = setTimeout(() => {
      this.recordTimeout(clientIp);
      if (!res.headersSent) {
        res.status(408).json({ error: 'Connection timeout' });
      }
      res.end();
    }, SECURITY_CONFIG.CONNECTION_TIMEOUT);

    res.on('finish', () => clearTimeout(connectionTimeout));
    res.on('close', () => clearTimeout(connectionTimeout));
  }

  private static recordTimeout(ip: string): void {
    const tracker = this.connectionMap.get(ip);
    if (tracker) {
      tracker.timeoutCount++;
      tracker.slowConnections++;
      
      const timeoutRatio = tracker.timeoutCount / Math.max(tracker.requestCount, 1);
      if (timeoutRatio > 0.7 && tracker.timeoutCount > 10) {
        tracker.isBlocked = true;
        tracker.blockUntil = Date.now() + SECURITY_CONFIG.SLOW_LORIS_BLOCK_DURATION;
        // eslint-disable-next-line no-console
        console.warn(`[SECURITY] Blocking IP ${ip} - High timeout ratio: ${timeoutRatio.toFixed(2)} (${tracker.timeoutCount}/${tracker.requestCount})`);
      }
    }
  }

  private static handleDownloadProtection(req: Request, res: Response, next: NextFunction, clientIp: string): void {
    if (this.isDownloadBlocked(clientIp)) {
      // eslint-disable-next-line no-console
      console.warn(`[SECURITY] Blocked download from ${clientIp} - Download Slow Loris protection`);
      res.status(429).json({ 
        error: `Too many slow downloads from this IP (${clientIp})`,
        retryAfter: Math.ceil((this.getDownloadBlockTime(clientIp) - Date.now()) / 1000)
      });
      return;
    }

    this.addDownload(clientIp);
    this.setupDownloadMonitoring(req, res, clientIp);

    res.on('finish', () => {
      this.removeDownload(clientIp);
    });

    res.on('close', () => {
      this.removeDownload(clientIp);
    });

    next();
  }

  private static isDownloadBlocked(ip: string): boolean {
    const tracker = this.downloadMap.get(ip);
    if (!tracker) return false;
    
    if (tracker.isBlocked && Date.now() < tracker.blockUntil) {
      return true;
    }
    
    if (tracker.isBlocked && Date.now() >= tracker.blockUntil) {
      tracker.isBlocked = false;
      tracker.blockUntil = 0;
    }
    
    return false;
  }

  private static getDownloadBlockTime(ip: string): number {
    const tracker = this.downloadMap.get(ip);
    return tracker?.blockUntil || 0;
  }

  private static addDownload(ip: string): void {
    let tracker = this.downloadMap.get(ip);
    
    if (!tracker) {
      tracker = {
        ip,
        activeDownloads: 0,
        slowDownloads: 0,
        totalBytesTransferred: 0,
        lastActivity: Date.now(),
        isBlocked: false,
        blockUntil: 0,
        downloadStartTime: Date.now(),
        lastTransferTime: Date.now(),
        transferRate: 0
      };
      this.downloadMap.set(ip, tracker);
    }

    tracker.activeDownloads++;
    tracker.lastActivity = Date.now();
    tracker.downloadStartTime = Date.now();
    tracker.lastTransferTime = Date.now();

    if (tracker.activeDownloads > SECURITY_CONFIG.DOWNLOAD_SLOW_LORIS.MAX_SLOW_DOWNLOADS) {
      tracker.isBlocked = true;
      tracker.blockUntil = Date.now() + SECURITY_CONFIG.DOWNLOAD_SLOW_LORIS.BLOCK_DURATION;
      // eslint-disable-next-line no-console
      console.warn(`[SECURITY] Blocking IP ${ip} - Too many concurrent downloads: ${tracker.activeDownloads}`);
    }
  }

  private static removeDownload(ip: string): void {
    const tracker = this.downloadMap.get(ip);
    if (tracker && tracker.activeDownloads > 0) {
      tracker.activeDownloads--;
      tracker.lastActivity = Date.now();
    }
  }

  private static setupDownloadMonitoring(req: Request, res: Response, clientIp: string): void {
    const tracker = this.downloadMap.get(clientIp);
    if (!tracker) return;

    let bytesTransferred = 0;
    const startTime = Date.now();

    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function(chunk: any, encoding?: any, callback?: any) {
      if (chunk && Buffer.isBuffer(chunk)) {
        bytesTransferred += chunk.length;
        tracker.totalBytesTransferred += chunk.length;
        
        const now = Date.now();
        const timeElapsed = now - tracker.lastTransferTime;
        
        if (timeElapsed > 1000) {
          tracker.transferRate = bytesTransferred / ((now - startTime) / 1000);
          tracker.lastTransferTime = now;
          
          if (tracker.transferRate < SECURITY_CONFIG.DOWNLOAD_SLOW_LORIS.SLOW_DOWNLOAD_THRESHOLD) {
            tracker.slowDownloads++;
            // eslint-disable-next-line no-console
            console.warn(`[SECURITY] Slow download detected from ${clientIp}: ${tracker.transferRate.toFixed(2)} bytes/s`);
          }
        }
      }
      return originalWrite.call(this, chunk, encoding, callback);
    };

    res.end = function(chunk?: any, encoding?: any, callback?: any) {
      if (chunk && Buffer.isBuffer(chunk)) {
        bytesTransferred += chunk.length;
        tracker.totalBytesTransferred += chunk.length;
      }
      return originalEnd.call(this, chunk, encoding, callback);
    };

    const downloadTimeout = setTimeout(() => {
      if (tracker.transferRate < SECURITY_CONFIG.DOWNLOAD_SLOW_LORIS.MIN_TRANSFER_RATE) {
        tracker.isBlocked = true;
        tracker.blockUntil = Date.now() + SECURITY_CONFIG.DOWNLOAD_SLOW_LORIS.BLOCK_DURATION;
        // eslint-disable-next-line no-console
        console.warn(`[SECURITY] Blocking IP ${clientIp} - Download too slow: ${tracker.transferRate.toFixed(2)} bytes/s`);
        if (!res.headersSent) {
          res.status(408).json({ error: 'Download too slow, connection terminated' });
        }
        res.end();
      }
    }, SECURITY_CONFIG.DOWNLOAD_SLOW_LORIS.MAX_DOWNLOAD_DURATION);

    res.on('finish', () => clearTimeout(downloadTimeout));
    res.on('close', () => clearTimeout(downloadTimeout));
  }

  private static cleanupExpiredConnections(): void {
    const now = Date.now();
    const expiredIps: string[] = [];
    const expiredDownloadIps: string[] = [];

    for (const [ip, tracker] of this.connectionMap.entries()) {
      const isExpired = now - tracker.lastActivity > 600000 && tracker.connections === 0;
      const isBlockExpired = tracker.isBlocked && now >= tracker.blockUntil;
      
      if (isExpired || isBlockExpired) {
        expiredIps.push(ip);
      }
    }

    for (const [ip, tracker] of this.downloadMap.entries()) {
      const isExpired = now - tracker.lastActivity > 1800000 && tracker.activeDownloads === 0; // 30 minutes
      const isBlockExpired = tracker.isBlocked && now >= tracker.blockUntil;
      
      if (isExpired || isBlockExpired) {
        expiredDownloadIps.push(ip);
      }
    }

    expiredIps.forEach(ip => {
      this.connectionMap.delete(ip);
    });

    expiredDownloadIps.forEach(ip => {
      this.downloadMap.delete(ip);
    });

    if (expiredIps.length > 0 || expiredDownloadIps.length > 0) {
      // eslint-disable-next-line no-console
      console.debug(`[SECURITY] Cleaned up ${expiredIps.length} expired connection trackers and ${expiredDownloadIps.length} download trackers`);
    }
  }

  static getStats(): { 
    totalConnections: number; 
    blockedIps: number; 
    activeIps: number;
    totalDownloads: number;
    blockedDownloadIps: number;
    activeDownloadIps: number;
    slowDownloads: number;
  } {
    let totalConnections = 0;
    let blockedIps = 0;
    let activeIps = 0;
    let totalDownloads = 0;
    let blockedDownloadIps = 0;
    let activeDownloadIps = 0;
    let slowDownloads = 0;

    for (const tracker of this.connectionMap.values()) {
      totalConnections += tracker.connections;
      if (tracker.isBlocked && Date.now() < tracker.blockUntil) {
        blockedIps++;
      }
      if (tracker.connections > 0) {
        activeIps++;
      }
    }

    for (const tracker of this.downloadMap.values()) {
      totalDownloads += tracker.activeDownloads;
      slowDownloads += tracker.slowDownloads;
      if (tracker.isBlocked && Date.now() < tracker.blockUntil) {
        blockedDownloadIps++;
      }
      if (tracker.activeDownloads > 0) {
        activeDownloadIps++;
      }
    }

    return { 
      totalConnections, 
      blockedIps, 
      activeIps,
      totalDownloads,
      blockedDownloadIps,
      activeDownloadIps,
      slowDownloads
    };
  }

  static destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.connectionMap.clear();
    this.downloadMap.clear();
  }
} 