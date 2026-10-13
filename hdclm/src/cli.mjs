// Comenzi: experiment <A1..A7|A> [--seed N] [--profile nume] [--set cheie=valoare ...]
// HDCLM_TAG=nume scrie în runs/nume/<experiment>/
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [cmd, ...args] = process.argv.slice(2);
const what = args[0] && !args[0].startsWith('--') ? args[0] : 'A';
const rest = cmd === 'experiment' && what === args[0] ? args.slice(1) : args;
const seed = rest.includes('--seed') ? Number(rest[rest.indexOf('--seed') + 1]) : 1;
// --set cheie=valoare (repetabil): suprascrie parametri din config/default.json
// --profile nume: config/profiles/<nume>.json, aplicat înaintea lui --set
const base = {};
if (rest.includes('--profile')) {
  const name = rest[rest.indexOf('--profile') + 1];
  const prof = JSON.parse(readFileSync(join(here, '../config/profiles', `${name}.json`), 'utf8'));
  for (const [k, v] of Object.entries(prof)) if (!k.startsWith('_')) base[k] = v;
  console.log(`profil ${name}: ${Object.keys(base).join(', ')}`);
}
rest.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = rest[i + 1].split('=');
  base[k] = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v);
});

if (cmd === 'chat') {
  const { startChat } = await import('./chat.mjs');
  await startChat({ seed, base, args: rest });
} else if (cmd === 'experiment') {
  const BLOCK_A = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
  const list = what.split(',').flatMap((x) => (x === 'A' ? BLOCK_A : [x]));
  for (const e of list) {
    const mod = await import(pathToFileURL(join(here, 'eval/experiments', `${e}.mjs`)).href);
    const t0 = performance.now();
    const r = await mod.run({ seed, base });
    r.base = base;
    console.log(`${e}: ${r.decision}   (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
} else {
  console.log('folosire: node src/cli.mjs experiment [A|A1,A2,...] [--seed N]\n          node src/cli.mjs chat [--demo G7|--empty|--load fisier.txt] [--profile algoritm]');
}
