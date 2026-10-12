// Comenzi: experiment <A1..A7|A> [--seed N] [--set cheie=valoare ...]
// HDCLM_TAG=nume scrie în runs/nume/<experiment>/
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [cmd, what = 'A', ...rest] = process.argv.slice(2);
const seed = rest.includes('--seed') ? Number(rest[rest.indexOf('--seed') + 1]) : 1;
// --set cheie=valoare (repetabil): suprascrie parametri din config/default.json
const base = {};
rest.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = rest[i + 1].split('=');
  base[k] = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v);
});

if (cmd === 'experiment') {
  const list = what === 'A' ? ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'] : what.split(',');
  for (const e of list) {
    const mod = await import(pathToFileURL(join(here, 'eval/experiments', `${e}.mjs`)).href);
    const t0 = performance.now();
    const r = mod.run({ seed, base });
    r.base = base;
    console.log(`${e}: ${r.decision}   (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
} else {
  console.log('folosire: node src/cli.mjs experiment [A|A1,A2,...] [--seed N]');
}
