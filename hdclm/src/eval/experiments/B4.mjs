// B4: cât costă? Memorie per vector și timp de căutare (nearest) — doar măsurători, depind de mașină.
import { existsSync, readFileSync } from 'node:fs';
import { makeStrategy } from '../../hdc/strategy.mjs';
import { rng } from '../../core/rng.mjs';
import { runDir, writeResult } from '../run.mjs';
import { w } from './hdutil.mjs';

const NAMES = ['bipolar', 'phasor'];
const DIMS = [1024, 4096, 16384];
const NSTORED = [10000, 100000];
const POOL = 2000; // vectori distincți în memorie; se repetă ciclic ca să nu cerem GB de RAM

const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('B4');
  const R = rng(seed);
  const results = [];
  for (const name of NAMES) for (const D of DIMS) {
    const S = makeStrategy(name, { D, seed });
    const bytes = D * w(S) * 4;
    const pool = Array.from({ length: POOL }, () => S.normalize(S.newAtom(R)));
    const q = S.normalize(S.newAtom(R));
    S.nearest(q, pool.slice(0, 200).map((v, i) => ({ id: i, v })), 1); // încălzire
    const times = {};
    for (const N of NSTORED) {
      const cands = Array.from({ length: N }, (_, i) => ({ id: i, v: pool[i % POOL] }));
      const t0 = performance.now();
      S.nearest(q, cands, 1);
      times[N] = performance.now() - t0;
    }
    results.push({
      strategy: name, D, bytesPerVector: bytes, msNearest: times,
      msPer1M_from100k: times[100000] * 10, msPer1M_from10k: times[10000] * 100,
      gbPer1M: bytes * 1e6 / 1e9,
    });
  }
  // strategii care trec B2/B3 (dacă rezultatele există), la D=4096
  const b2 = readJson('runs/B2/result.json'), b3 = readJson('runs/B3/result.json');
  const pass = {};
  for (const name of NAMES) {
    const p2 = b2 ? (b2.results.find((r) => r.summary && r.strategy === name && r.D === 4096 && r.M === 10000)?.K ?? 0) >= 16 : null;
    const p3 = b3 ? b3.results.filter((r) => r.strategy === name && r.D === 4096).every((r) => r.ok) : null;
    pass[name] = { B2: p2, B3: p3, passes: p2 !== false && p3 !== false };
  }
  const cand = results.filter((r) => r.D === 4096 && pass[r.strategy].passes)
    .sort((x, y) => x.bytesPerVector - y.bytesPerVector || x.msNearest[100000] - y.msNearest[100000]);
  const best = cand[0];
  const src = b2 && b3 ? 'B2/B3 citite din runs/' : 'B2/B3 lipsă: nefiltrat';
  const decision = best
    ? `cea mai ieftină strategie dintre cele care trec B1–B3 (${src}): ${best.strategy} (la D=4096: ${best.bytesPerVector} B/vector, ~${(best.msPer1M_from100k / 1000).toFixed(1)} s/căutare la 1M, extrapolat liniar; ${best.gbPer1M.toFixed(1)} GB per 1M vectori). Timpii depind de mașină.`
    : `nicio strategie nu trece B2/B3 la D=4096 (${src}). Timpii depind de mașină.`;
  return writeResult(dir, {
    experiment: 'B4', question: 'Cât costă?', seed,
    note: `nearest-ul strategiei, 1 măsurătoare; ${POOL} vectori distincți repetați ciclic; extrapolare liniară la 1.000.000`,
    pass, results, decision,
  });
}
