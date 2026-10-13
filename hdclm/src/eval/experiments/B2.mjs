// B2: câți copii poate ține o unitate? K = cel mai mare n cu eroare de decodare < 1%.
// Celulele (strategie, D, M) rulează în paralel (4 procese), fiecare cu rng propriu din sămânță.
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDir, writeResult } from '../run.mjs';
import { CFG } from './B2cell.mjs';

const here = dirname(fileURLToPath(import.meta.url));


// celulele rulează pe fire de execuție (node:worker_threads), fiecare cu rng propriu din sămânță:
// rezultatul nu depinde de ordinea în care termină firele
function runCells(tasks, seed, cfg) {
  const out = new Array(tasks.length);
  let next = 0;
  const pool = Math.max(1, Math.min(cpus().length, tasks.length));
  return new Promise((resolve, reject) => {
    let active = 0;
    const launch = () => {
      if (next >= tasks.length) return active === 0 && resolve(out);
      const i = next++;
      const t = tasks[i];
      active++;
      const w = new Worker(join(here, 'B2cell.mjs'), { workerData: { b2cell: { name: t.name, D: t.D, M: t.M, seed, cfg } } });
      w.once('message', (m) => (out[i] = m));
      w.once('error', reject);
      w.once('exit', () => {
        active--;
        launch();
      });
    };
    for (let k = 0; k < pool; k++) launch();
  });
}

export async function run({ seed = 1, base = {} } = {}) {
  // base.b2: { names, dims, ms, cfg } pentru o rulare țintită (de ex. mai multe decodări)
  const NAMES = base.b2names ? String(base.b2names).split('+') : ['bipolar', 'phasor'];
  const DIMS = base.b2dims ? String(base.b2dims).split('+').map(Number) : [1024, 4096, 16384];
  const MS = base.b2ms ? String(base.b2ms).split('+').map(Number) : [1000, 10000];
  const cellCfg = { ...(base.b2minDec ? { MIN_DEC: base.b2minDec } : {}), ...(base.b2budget ? { BUDGET: base.b2budget } : {}) };
  const dir = runDir('B2');
  // cele mai scumpe primele
  const tasks = [];
  for (const name of NAMES) for (const D of DIMS) for (const M of MS) tasks.push({ name, D, M });
  tasks.sort((a, b) => b.D * b.M * (b.name === 'phasor' ? 2 : 1) - a.D * a.M * (a.name === 'phasor' ? 2 : 1));
  const cells = await runCells(tasks, seed, cellCfg);
  const results = [];
  for (const name of NAMES) for (const D of DIMS) for (const M of MS) {
    const c = cells[tasks.findIndex((x) => x.name === name && x.D === D && x.M === M)];
    results.push(...c.rows, c.summary);
  }
  const sum = results.filter((x) => x.summary);
  const K = (s, D, M) => sum.find((x) => x.strategy === s && x.D === D && x.M === M)?.K;
  const ks = sum.map((x) => `${x.strategy}/D${x.D}/M${x.M}: K=${x.K}`).join('; ');
  const sup = NAMES.filter((s) => K(s, 4096, 10000) !== undefined).map((s) => `${s} ${K(s, 4096, 10000) >= 16 ? 'da' : 'nu'} (K=${K(s, 4096, 10000)})`).join(', ');
  const decision = `K (eroare<1%, prefix de n) per strategie/D/M: ${ks}. K=16 la D=4096, M=10000 susținut: ${sup}. M=100000 omis (matrice prea mare/lentă). K e limitat la 256 (cel mai mare n) și de numărul de decodări (decodesPerN).`;
  return writeResult(dir, {
    experiment: 'B2', question: 'Câți copii ține o unitate?', seed,
    note: `decodări/celulă între ${CFG.MIN_DEC} și ${CFG.MAX_DEC} (buget ${CFG.BUDGET} elem.), max ${CFG.PER_UNIT} poziții/unitate; compunere Horner; M=100000 omis`,
    counts: { ...CFG, ...cellCfg }, results, decision,
  });
}
