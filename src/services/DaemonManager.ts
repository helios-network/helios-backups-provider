import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export class DaemonManager {
  static runDaemon(): void {
    console.log('[INFO] Starting Helios Backups server in daemon mode...');
    
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

      const child = spawn(process.argv[0], process.argv.slice(1), {
        detached: true,
        stdio: 'ignore',
        env: { 
          ...process.env, 
          NODE_ENV: 'production',
          HELIOS_DAEMON: 'true'
        }
      });
      
      child.unref();
      
      if (!child.pid) {
        throw new Error('Failed to start daemon process');
      }
      
      fs.writeFileSync(pidFile, child.pid.toString());
      
      setTimeout(() => {
        try {
          process.kill(child.pid!, 0);
          console.log(`[INFO] Daemon started successfully with PID: ${child.pid}`);
          console.log(`[INFO] PID file: ${pidFile}`);
          console.log(`[INFO] To stop the daemon: kill ${child.pid} or delete ${pidFile}`);
        } catch (error) {
          console.error('[ERROR] Failed to start daemon:', error);
          if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
          }
          process.exit(1);
        }
      }, 1000);
      
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
      process.kill(pid, 'SIGTERM');
      console.log(`[INFO] Sent SIGTERM to daemon PID: ${pid}`);
      
      setTimeout(() => {
        try {
          process.kill(pid, 0);
          console.log('[WARN] Daemon still running, sending SIGKILL');
          process.kill(pid, 'SIGKILL');
        } catch (error) {
          console.log('[INFO] Daemon stopped successfully');
        }
        
        if (fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }
      }, 2000);
      
    } catch (error) {
      console.error('[ERROR] Error stopping daemon:', error);
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    }
  }
}