import path from 'path';
import fs from 'fs';
import { SECURITY_CONFIG } from '../config/security';

export class SecurityValidator {
  static isValidFileExtension(filename: string): boolean {
    return SECURITY_CONFIG.ALLOWED_EXTENSIONS.some(allowed => 
      filename.toLowerCase().endsWith(allowed)
    );
  }

  static isValidFilename(filename: string): boolean {
    if (!filename || filename.length > SECURITY_CONFIG.MAX_FILENAME_LENGTH) {
      return false;
    }
    
    if (!SECURITY_CONFIG.FILENAME_REGEX.test(filename)) {
      return false;
    }
    
    const dangerousChars = ['..', '\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    return !dangerousChars.some(char => filename.includes(char));
  }

  static getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.gz': 'application/gzip',
      '.tar.gz': 'application/gzip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  static isPathSafe(filePath: string, baseDir: string): boolean {
    try {
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(baseDir);
      
      if (!resolvedPath.startsWith(resolvedBase)) {
        return false;
      }
      
      const realPath = fs.realpathSync(resolvedPath);
      const realBase = fs.realpathSync(resolvedBase);
      
      return realPath.startsWith(realBase);
    } catch (error) {
      return false;
    }
  }

  static validateFileSize(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.size <= SECURITY_CONFIG.MAX_FILE_SIZE && stats.size > 0;
    } catch (error) {
      return false;
    }
  }

  static validateMimeType(filename: string): boolean {
    const mimeType = this.getMimeType(filename);
    return SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType);
  }

  static sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '');
  }

  static isRequestValid(req: any): boolean {
    const userAgent = req.get('User-Agent');
    const accept = req.get('Accept');
    
    if (!userAgent || userAgent.length > 500) {
      return false;
    }
    
    if (accept && accept.length > 1000) {
      return false;
    }
    
    return true;
  }
} 