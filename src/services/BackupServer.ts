import express from 'express';
import fs from 'fs';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { Throttle } from 'stream-throttle';
import { SECURITY_CONFIG } from '../config/security';
import { BackupPathResolver } from '../utils/BackupPathResolver';
import { SecurityValidator } from '../utils/SecurityValidator';
import { SlowLorisProtection } from '../utils/SlowLorisProtection';

export class BackupServer {
  private app: express.Application;
  private port: number;
  private snapshotDir: string;
  private maxDownloadRate: number;
  private host: string;

  constructor(port: number = 3000, maxDownloadRate: number = 1024 * 1024, host: string = 'localhost') {
    this.app = express();
    this.port = port;
    this.snapshotDir = BackupPathResolver.getBackupPath();
    this.maxDownloadRate = maxDownloadRate;
    this.host = host;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet(SECURITY_CONFIG.HELMET_CONFIG));
    // this.app.use(SlowLorisProtection.middleware());
    
    this.app.use(morgan('combined', {
      skip: (req, res) => res.statusCode < 400,
      stream: {
        write: (message: string) => {
          console.log(`[SECURITY] ${message.trim()}`);
        }
      }
    }));

    const limiter = rateLimit(SECURITY_CONFIG.RATE_LIMIT);
    this.app.use(limiter);

    this.app.use(express.json({ limit: SECURITY_CONFIG.REQUEST_SIZE_LIMIT }));
    this.app.use(express.urlencoded({ extended: true, limit: SECURITY_CONFIG.REQUEST_SIZE_LIMIT }));

    this.app.use((req, res, next) => {
      if (!SecurityValidator.isRequestValid(req)) {
        console.warn(`[SECURITY] Invalid request from ${req.ip}: ${req.method} ${req.path}`);
        return res.status(400).json({ error: 'Invalid request' });
      }
      return next();
    });
  }

  private setupRoutes(): void {
    this.app.get('/snapshots/:filename.header.json', (req, res) => {
      try {
        const fileName = path.basename(req.params.filename);
        const headerFileName = `${fileName}.header.json`;
        
        if (!SecurityValidator.isValidFilename(fileName)) {
          console.warn(`[SECURITY] Invalid filename attempted: ${fileName} from ${req.ip}`);
          return res.status(400).json({ 
            error: 'Invalid filename format.' 
          });
        }

        const hasValidBackupExtension = SECURITY_CONFIG.ALLOWED_EXTENSIONS.some(ext => {
          return fileName.toLowerCase().endsWith(ext);
        });
        
        if (!hasValidBackupExtension) {
          console.warn(`[SECURITY] Invalid backup file extension attempted: ${fileName} from ${req.ip}`);
          return res.status(400).json({ 
            error: 'Invalid file type. Only backup files (.gz, .tar.gz) are allowed.' 
          });
        }

        const filePath = path.join(this.snapshotDir, fileName);
        
        if (!SecurityValidator.isPathSafe(filePath, this.snapshotDir)) {
          console.warn(`[SECURITY] Path traversal attempt: ${filePath} from ${req.ip}`);
          return res.status(400).json({ 
            error: 'Invalid file path' 
          });
        }

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ 
            error: 'Snapshot not found.' 
          });
        }

        const stats = fs.statSync(filePath);
        const blockId = this.extractBlockId(fileName);
        const uploadedAt = stats.mtime.toISOString();
        const description = this.generateDescription(fileName, blockId);
        const downloadUrl = this.generateUrl(fileName);

        const headerContent = {
          filename: SecurityValidator.sanitizeFilename(fileName),
          blockId: blockId,
          uploadedAt: uploadedAt,
          description: description,
          downloadUrl: downloadUrl,
          fileSize: stats.size,
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');

        res.json(headerContent);
        return;

      } catch (error) {
        console.error('[ERROR] Header route error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
        return;
      }
    });

    this.app.get('/snapshots/:filename', (req, res) => {
      try {
        const fileName = path.basename(req.params.filename);
        
        if (!SecurityValidator.isValidFilename(fileName)) {
          console.warn(`[SECURITY] Invalid filename attempted: ${fileName} from ${req.ip}`);
          return res.status(400).json({ 
            error: 'Invalid filename format. Only alphanumeric characters, dots, underscores, and hyphens are allowed.' 
          });
        }

        if (!SecurityValidator.isValidFileExtension(fileName)) {
          console.warn(`[SECURITY] Invalid file extension attempted: ${fileName} from ${req.ip}`);
          return res.status(400).json({ 
            error: 'Invalid file type. Only backup files (.gz, .tar.gz) are allowed.' 
          });
        }

        if (!SecurityValidator.validateMimeType(fileName)) {
          console.warn(`[SECURITY] Invalid MIME type attempted: ${fileName} from ${req.ip}`);
          return res.status(400).json({ 
            error: 'Invalid file type.' 
          });
        }

        const filePath = path.join(this.snapshotDir, fileName);
        
        if (!SecurityValidator.isPathSafe(filePath, this.snapshotDir)) {
          console.warn(`[SECURITY] Path traversal attempt: ${filePath} from ${req.ip}`);
          return res.status(400).json({ 
            error: 'Invalid file path' 
          });
        }

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ 
            error: 'Snapshot not found.' 
          });
        }

        if (!SecurityValidator.validateFileSize(filePath)) {
          console.warn(`[SECURITY] File validation failed: ${fileName} from ${req.ip}`);
          return res.status(404).json({ 
            error: 'File not found or invalid' 
          });
        }

        const sanitizedFilename = SecurityValidator.sanitizeFilename(fileName);
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
        res.setHeader('Content-Type', SecurityValidator.getMimeType(fileName));
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

        const throttle = new Throttle({ rate: this.maxDownloadRate });
        const fileStream = fs.createReadStream(filePath);

        fileStream.pipe(throttle).pipe(res);

        fileStream.on('error', (err) => {
          console.error('[ERROR] File read error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
          }
        });

        res.on('error', (err) => {
          console.error('[ERROR] Response error:', err);
        });

        return;

      } catch (error) {
        console.error('[ERROR] Route error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
        return;
      }
    });



    this.app.get('/snapshots', (req, res) => {
      try {
        if (!fs.existsSync(this.snapshotDir)) {
          console.info(`[INFO] Backup directory not found: ${this.snapshotDir} requested by ${req.ip}`);
          return res.json({
            snapshots: [],
            totalCount: 0,
            serverInfo: {
              name: 'Helios Backups Server',
              version: '1.0.0',
              backupDirectory: this.snapshotDir
            }
          });
        }

        const files = fs.readdirSync(this.snapshotDir)
          .filter(file => SecurityValidator.isValidFileExtension(file))
          .sort((a, b) => {
            const blockIdA = this.extractBlockId(a);
            const blockIdB = this.extractBlockId(b);
            return blockIdB - blockIdA;
          });

        const snapshots = files.map(file => {
          const filePath = path.join(this.snapshotDir, file);
          const stats = fs.statSync(filePath);
          const blockId = this.extractBlockId(file);
          
          return {
            filename: file,
            blockId: blockId,
            uploadedAt: stats.mtime.toISOString(),
            description: this.generateDescription(file, blockId),
            downloadUrl: this.generateUrl(file),
            headerUrl: this.generateUrl(file) + '.header.json',
            fileSize: stats.size,
          };
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

        res.json({
          snapshots: snapshots,
          totalCount: snapshots.length,
        });
        return;

      } catch (error) {
        console.error('[ERROR] List route error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
        return;
      }
    });

    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    this.app.use('*', (req, res) => {
      console.warn(`[SECURITY] 404 - Route not found: ${req.method} ${req.originalUrl} from ${req.ip}`);
      res.status(404).json({ error: 'Route not found' });
    });

    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
      
      res.status(500).json({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    });
  }

  public start(): void {
    const server = this.app.listen(this.port, () => {
      console.log(`[INFO] Helios Backups server running on http://localhost:${this.port}`);
      console.log(`[INFO] Serving backups from: ${this.snapshotDir}`);
      console.log(`[INFO] Max download rate: ${this.maxDownloadRate / 1024 / 1024} MB/s`);
    });

    server.timeout = SECURITY_CONFIG.CONNECTION_TIMEOUT;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    let isShuttingDown = false;

    const gracefulShutdown = (signal: string) => {
      if (isShuttingDown) {
        process.exit(1);
      }

      isShuttingDown = true;
      
      SlowLorisProtection.destroy();
      
      server.close(() => {
        process.exit(0);
      });

      setTimeout(() => {
        process.exit(1);
      }, 5000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  private generateUrl(filename: string): string {
    const protocol = this.host === 'localhost' ? 'http' : 'https';
    const port = this.host === 'localhost' ? `:${this.port}` : '';
    return `${protocol}://${this.host}${port}/snapshots/${SecurityValidator.sanitizeFilename(filename)}`;
  }

  private extractBlockId(filename: string): number {
    const match = filename.match(/snapshot_(\d+)_/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private generateDescription(filename: string, blockId: number): string {
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
    if (dateMatch) {
      const date = dateMatch[1];
      const time = dateMatch[2];
      return `Helios Node Backup - Block ${blockId} - ${date} ${time}`;
    }
    return `Helios Node Backup - Block ${blockId} - ${filename}`;
  }
}