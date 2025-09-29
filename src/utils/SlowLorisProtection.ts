import { Request, Response, NextFunction } from 'express';
import { SECURITY_CONFIG } from '../config/security';

interface ConnectionTracker {
  ip: string;
  connections: number;
  lastActivity: number;
  isBlocked: boolean;
  blockUntil: number;
}

export class SlowLorisProtection {
  private static connectionMap = new Map<string, ConnectionTracker>();
  private static cleanupInterval: NodeJS.Timeout;

  static {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredConnections();
    }, 30000);
  }

  static middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      if (this.isIpBlocked(clientIp)) {
        console.warn(`[SECURITY] Blocked request from ${clientIp} - Slow Loris protection`);
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
        lastActivity: Date.now(),
        isBlocked: false,
        blockUntil: 0
      };
      this.connectionMap.set(ip, tracker);
    }

    tracker.connections++;
    tracker.lastActivity = Date.now();

    if (tracker.connections > SECURITY_CONFIG.MAX_CONCURRENT_CONNECTIONS) {
      tracker.isBlocked = true;
      tracker.blockUntil = Date.now() + SECURITY_CONFIG.SLOW_LORIS_BLOCK_DURATION;
      console.warn(`[SECURITY] Blocking IP ${ip} - Too many concurrent connections: ${tracker.connections}`);
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
      console.warn(`[SECURITY] Request timeout for ${clientIp}`);
      this.penalizeIp(clientIp);
      if (!res.headersSent) {
        res.status(408).json({ error: 'Request timeout' });
      }
    });

    res.setTimeout(SECURITY_CONFIG.RESPONSE_TIMEOUT, () => {
      console.warn(`[SECURITY] Response timeout for ${clientIp}`);
      this.penalizeIp(clientIp);
      if (!res.headersSent) {
        res.status(408).json({ error: 'Response timeout' });
      }
    });

    const connectionTimeout = setTimeout(() => {
      console.warn(`[SECURITY] Connection timeout for ${clientIp}`);
      this.penalizeIp(clientIp);
      if (!res.headersSent) {
        res.status(408).json({ error: 'Connection timeout' });
      }
      res.end();
    }, SECURITY_CONFIG.CONNECTION_TIMEOUT);

    res.on('finish', () => clearTimeout(connectionTimeout));
    res.on('close', () => clearTimeout(connectionTimeout));
  }

  private static penalizeIp(ip: string): void {
    const tracker = this.connectionMap.get(ip);
    if (tracker) {
      tracker.isBlocked = true;
      tracker.blockUntil = Date.now() + SECURITY_CONFIG.SLOW_LORIS_BLOCK_DURATION;
      console.warn(`[SECURITY] Penalizing IP ${ip} for slow connection behavior`);
    }
  }

  private static cleanupExpiredConnections(): void {
    const now = Date.now();
    const expiredIps: string[] = [];

    for (const [ip, tracker] of this.connectionMap.entries()) {
      if (now - tracker.lastActivity > 300000 && tracker.connections === 0) {
        expiredIps.push(ip);
      }
    }

    expiredIps.forEach(ip => {
      this.connectionMap.delete(ip);
    });

    if (expiredIps.length > 0) {
      console.debug(`[SECURITY] Cleaned up ${expiredIps.length} expired connection trackers`);
    }
  }

  static getStats(): { totalConnections: number; blockedIps: number; activeIps: number } {
    let totalConnections = 0;
    let blockedIps = 0;
    let activeIps = 0;

    for (const tracker of this.connectionMap.values()) {
      totalConnections += tracker.connections;
      if (tracker.isBlocked && Date.now() < tracker.blockUntil) {
        blockedIps++;
      }
      if (tracker.connections > 0) {
        activeIps++;
      }
    }

    return { totalConnections, blockedIps, activeIps };
  }

  static destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.connectionMap.clear();
  }
} 