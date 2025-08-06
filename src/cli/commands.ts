import { CLI } from './CLI';

export function argv(): string[] | number {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || (command !== 'serve' && command !== 'stop' && command !== 'status' && command !== '--help' && command !== '-h' && command !== 'help')) {
    return 1;
  }
  
  return args;
}

export function run(args: string[], callback: (exitCode: number) => void): void {
  const cli = new CLI();
  
  try {
    cli.run();
  } catch (error) {
    console.error('Error:', error);
    callback(1);
  }
}

export function showHelp(): void {
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
  console.log('');
  console.log('Examples:');
  console.log('  helios-backups serve');
  console.log('  helios-backups serve -d');
  console.log('  helios-backups serve -p 8080 -r 5');
  console.log('  helios-backups stop');
  console.log('  helios-backups status');
  console.log('');
  console.log('Environment Variables:');
  console.log('  PORT               Server port (default: 3000)');
  console.log('  NODE_ENV           Environment mode (development/production)');
} 