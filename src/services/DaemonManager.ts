import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export class DaemonManager {
  static runDaemon(port?: number, maxDownloadRate?: number, host?: string): void {    
    try {
      const pidFile = path.join(process.cwd(), 'helios-backups.pid');
      
      if (fs.existsSync(pidFile)) {
        const existingPid = fs.readFileSync(pidFile, 'utf8').trim();
        try {
          process.kill(parseInt(existingPid), 0);
          console.error('[ERROR] Daemon already running with PID:', existingPid);
          process.exit(1);
        } catch (error) {
          fs.unlinkSync(pidFile);
        }
      }
      const daemonPath = path.resolve(process.cwd(), 'dist', 'daemon.js');
      
      const child = spawn(process.argv[0], [daemonPath], {
        detached: true,
        stdio: 'ignore',
        env: { 
          ...process.env, 
          NODE_ENV: 'production',
          HELIOS_DAEMON: 'true',
          PORT: port?.toString() || process.env.PORT || '3000',
          HOST: host || process.env.HOST || 'localhost',
          MAX_DOWNLOAD_RATE: maxDownloadRate?.toString() || '1048576'
        }
      });
      
      child.unref();
      
      if (!child.pid) {
        throw new Error('Failed to start daemon process');
      }
      
      fs.writeFileSync(pidFile, child.pid.toString());
      
      console.log(`[INFO] Daemon started successfully with PID: ${child.pid}`);
      
      process.exit(0);
    } catch (error) {
      console.error('[ERROR] Error starting daemon:', error);
      process.exit(1);
    }
  }

  static stopDaemon(): void {
    const pidFile = path.join(process.cwd(), 'helios-backups.pid');
    
    if (!fs.existsSync(pidFile)) {
      console.log('[INFO] No daemon PID file found');
      return;
    }

    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());

      try {
        process.kill(pid, 0);
      } catch (error: any) {
        if (error.code === 'ESRCH') {
          fs.unlinkSync(pidFile);
          return;
        }
        throw error;
      }
      process.kill(pid, 'SIGTERM');
      console.log(`[INFO] Sent SIGTERM to daemon PID: ${pid}`);
      
      setTimeout(() => {
        try {
          process.kill(pid, 0);
          console.log('[WARN] Daemon still running, sending SIGKILL');
          process.kill(pid, 'SIGKILL');
        } catch (error: any) {
          if (error.code === 'ESRCH') {
            console.log('[INFO] Daemon stopped successfully');
          } else {
            console.log('[INFO] Daemon stopped successfully');
          }
        }
        
        if (fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }
      }, 2000);
      
    } catch (error: any) {
      if (error.code === 'ESRCH') {
        console.log('[INFO] Daemon process not found, cleaning up PID file');
      } else {
        console.error('[ERROR] Error stopping daemon:', error.message);
      }
      
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    }
  }
}