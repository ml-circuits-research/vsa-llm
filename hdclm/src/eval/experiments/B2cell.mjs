// Lucrător B2: o celulă (strategie, D, M), toate valorile n. Rulat în paralel de B2.mjs.
// uz: node B2cell.mjs <strategie> <D> <M> <seed> <fișier-ieșire>
import { makeStrategy } from '../../hdc/strategy.mjs';
import { rng } from '../../core/rng.mjs';
import { w, compose, candMatrix, fastNearest, distinct } from './hdutil.mjs';

export const NS = [2, 4, 8, 12, 16, 24, 32, 48, 64, 128, 256];
export const CFG = { BUDGET: 8e8, MIN_DEC: 20, MAX_DEC: 2000, PER_UNIT: 20 };

export function cell(name, D, M, seed, cfg = CFG) {
  const R = rng((seed * 1000003 + D * 31 + M * 7 + (name === 'phasor' ? 99991 : 0)) >>> 0);
  const S = makeStrategy(name, { D, seed });
  const L = D * w(S);
  const mat = candMatrix(S, M, R);
  const dec = Math.max(cfg.MIN_DEC, Math.min(cfg.MAX_DEC, Math.floor(cfg.BUDGET / (M * L))));
  const rows = [];
  let K = 0, open = true, stopped = false;
  for (const n of NS) {
    const per = Math.min(n, cfg.PER_UNIT), units = Math.ceil(dec / per);
    let err = 0, tot = 0;
    for (let u = 0; u < units; u++) {
      const idx = distinct(R, M, n);
      const cur0 = compose(S, idx.map((i) => mat.subarray(i * L, (i + 1) * L)));
      const pos = new Set(distinct(R, n, per).map((p) => p + 1)); // poziții 1-based decodate
      let cur = cur0;
      for (let p = 1; p <= n; p++) {
        cur = S.order(cur, -1); // ρ^-p comp (== order(comp, -(k+1)))
        if (!pos.has(p)) continue;
        tot++;
        if (fastNearest(S.unembed(cur), mat, M, L) !== idx[p - 1]) err++;
      }
    }
    const rate = err / tot;
    rows.push({ strategy: name, D, M, n, decodes: tot, units, errors: err, errorRate: rate });
    if (open && rate < 0.01) K = n; else open = false; // K = prefixul cu eroare <1%
    if (rate > 0.2) { stopped = true; break; }
  }
  return { rows, summary: { strategy: name, D, M, summary: true, K, decodesPerN: dec, stoppedAbove20pct: stopped } };
}

// lucrător (node:worker_threads): calculează o celulă și o trimite înapoi
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
if (!isMainThread && workerData?.b2cell) {
  const { name, D, M, seed, cfg } = workerData.b2cell;
  parentPort.postMessage(cell(name, D, M, seed, { ...CFG, ...cfg }));
}
