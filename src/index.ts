import { CLI } from './cli/CLI';
import { argv, run, showHelp } from './cli/commands';

export { CLI, argv, run, showHelp };

if (require.main === module) {
  const cli = new CLI();
  cli.run();
} 