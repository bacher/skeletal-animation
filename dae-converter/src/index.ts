import { run } from './daeConverter';

const args = process.argv.slice(2);

run({ files: args.length ? args : ['example/*.dae'] }).catch((error) => {
  console.error('Critical Error:');
  console.error(error);
  process.exit(10);
});
