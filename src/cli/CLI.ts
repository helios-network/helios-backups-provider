import { BackupServer } from '../services/BackupServer';
import { DaemonManager } from '../services/DaemonManager';

export class CLI {
  private args: string[];
  private command: string;
  private isDaemon: boolean;
  private port: number;
  private maxDownloadRate: number;
  private host: string;

  constructor() {
    this.args = process.argv.slice(2);
    this.command = this.args[0] || '';
    this.isDaemon = this.args.includes('-d') || this.args.includes('--daemon');
    this.port = this.parsePort();
    this.maxDownloadRate = this.parseDownloadRate();
    this.host = this.parseHost();
  }

  private parsePort(): number {
    const portIndex = this.args.indexOf('-p') || this.args.indexOf('--port');
    if (portIndex !== -1 && portIndex + 1 < this.args.length) {
      const port = parseInt(this.args[portIndex + 1]);
      if (port > 0 && port <= 65535) {
        return port;
      }
    }
    return parseInt(process.env.PORT || '3000');
  }

  private parseDownloadRate(): number {
    const rateIndex = this.args.indexOf('-r') || this.args.indexOf('--rate');
    if (rateIndex !== -1 && rateIndex + 1 < this.args.length) {
      const rate = parseInt(this.args[rateIndex + 1]);
      if (rate > 0) {
        return rate * 1024 * 1024;
      }
    }
    return 1024 * 1024;
  }

  private parseHost(): string {
    const hostIndex = this.args.indexOf('-H') || this.args.indexOf('--host');
    if (hostIndex !== -1 && hostIndex + 1 < this.args.length) {
      return this.args[hostIndex + 1];
    }
    return process.env.HOST || 'localhost';
  }

  public run(): void {
    switch (this.command) {
      case 'serve':
        this.runServer();
        break;
      case 'stop':
        this.stopDaemon();
        break;
      case 'status':
        this.showStatus();
        break;
      case '--help':
      case '-h':
      case 'help':
        this.showHelp();
        break;
      default:
        this.showHelp();
        process.exit(1);
    }
  }

  private runServer(): void {
    if (this.isDaemon) {
      console.log('[INFO] Starting server in daemon mode...');
      console.log(`[INFO] Port: ${this.port}, Rate: ${this.maxDownloadRate / 1024 / 1024} MB/s, Host: ${this.host}`);
      DaemonManager.runDaemon(this.port, this.maxDownloadRate, this.host);
    } else {
      console.log('[INFO] Starting server in foreground mode...');
      const server = new BackupServer(this.port, this.maxDownloadRate, this.host);
      server.start();
    }
  }

  private stopDaemon(): void {
    console.log('[INFO] Stopping daemon...');
    DaemonManager.stopDaemon();
    process.exit(0);
  }

  private showStatus(): void {
    const pidFile = require('path').join(process.cwd(), 'helios-backups.pid');
    const fs = require('fs');
    
    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf8').trim();
      try {
        process.kill(parseInt(pid), 0);
        console.log(`[INFO] Daemon is running with PID: ${pid}`);
      } catch (error) {
        console.log('[INFO] Daemon is not running');
        fs.unlinkSync(pidFile);
      }
    } else {
      console.log('[INFO] Daemon is not running');
    }
    process.exit(0);
  }

  private showHelp(): void {
    console.log('Helios Backups Server - Secure Backup File Server');
    console.log('');
    console.log('Usage: helios-backups <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  serve              Start the backup server');
    console.log('  stop               Stop the daemon server');
    console.log('  status             Show daemon status');
    console.log('  help, --help, -h   Show this help message');
    console.log('');
    console.log('Options:');
    console.log('  -d, --daemon       Run in daemon mode');
    console.log('  -p, --port <port>  Set server port (default: 3000)');
    console.log('  -r, --rate <rate>  Set max download rate in MB/s (default: 1)');
    console.log('  -H, --host <host>  Set hostname for URLs (default: localhost)');
    console.log('');
    console.log('Examples:');
    console.log('  helios-backups serve');
    console.log('  helios-backups serve -d');
    console.log('  helios-backups serve -p 8080 -r 5');
    console.log('  helios-backups serve -H example.com');
    console.log('  helios-backups serve -H example.com -p 443');
    console.log('  helios-backups stop');
    console.log('  helios-backups status');
    console.log('');
    console.log('Environment Variables:');
    console.log('  PORT               Server port (default: 3000)');
    console.log('  HOST               Server hostname (default: localhost)');
    console.log('  NODE_ENV           Environment mode (development/production)');
    process.exit(0);
  }
}