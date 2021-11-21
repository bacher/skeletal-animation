import glob from 'glob';

import { convert } from './daeConverter';

const args = process.argv.slice(2);

async function getFiles(globs: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    glob(globs.join('|'), (error, files) => {
      if (error) {
        reject(error);
      } else {
        resolve(files);
      }
    });
  });
}

async function run() {
  const files = await getFiles(args.length ? args : ['example/*.dae']);

  await convert({ files });
}

run().catch((error) => {
  console.error('Critical Error:');
  console.error(error);
  process.exit(10);
});
