#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function startDaemon() {
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

  const daemonPath = path.resolve(__dirname, 'dist', 'daemon.js');
  console.log(`[INFO] Starting daemon from: ${daemonPath}`);
  
  const child = spawn(process.argv[0], [daemonPath], {
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
    console.error('[ERROR] Failed to start daemon process');
    process.exit(1);
  }
  
  fs.writeFileSync(pidFile, child.pid.toString());
  
  console.log(`[INFO] Daemon started successfully with PID: ${child.pid}`);
  
  process.exit(0);
}

startDaemon(); 