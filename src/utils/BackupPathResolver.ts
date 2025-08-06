import fs from 'fs';
import path from 'path';
import os from 'os';

export class BackupPathResolver {
  static getBackupPath(): string {
    const basePwd = fs.existsSync(path.join(os.homedir(), '.helios-cli', 'pwd'))
      ? fs.readFileSync(path.join(os.homedir(), '.helios-cli', 'pwd'), 'utf8').trim()
      : os.homedir();
    
    const primaryPath = path.join(basePwd, 'data', 'node1', '.heliades', 'backups');
    const defaultPath = path.join(basePwd, '.heliades', 'backups');
    
    return fs.existsSync(primaryPath) ? primaryPath : defaultPath;
  }
} 