// B2: câți copii poate ține o unitate? K = cel mai mare n cu eroare de decodare < 1%.
import { makeStrategy } from '../../hdc/strategy.mjs';
import { rng } from '../../core/rng.mjs';
import { runDir, writeResult } from '../run.mjs';
import { w, compose, candMatrix, fastNearest, distinct } from './hdutil.mjs';

const NAMES = ['bipolar', 'phasor'];
const DIMS = [1024, 4096, 16384];
const NS = [2, 4, 8, 12, 16, 24, 32, 48, 64, 128, 256];
const MS = [1000, 10000];
const BUDGET = 6e8;       // elemente înmulțite per celulă (limitează timpul)
const MIN_DEC = 60, MAX_DEC = 2000, PER_UNIT = 20; // decodări/celulă și pozițiile decodate/unitate

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('B2');
  const R = rng(seed);
  const results = [];
  for (const name of NAMES) for (const D of DIMS) {
    const S = makeStrategy(name, { D, seed });
    const L = D * w(S);
    const mat = candMatrix(S, Math.max(...MS), R);
    for (const M of MS) {
      const dec = Math.max(MIN_DEC, Math.min(MAX_DEC, Math.floor(BUDGET / (M * L))));
      let K = 0, stopped = false;
      for (const n of NS) {
        const per = Math.min(n, PER_UNIT);
        const units = Math.ceil(dec / per);
        let err = 0, tot = 0;
        for (let u = 0; u < units; u++) {
          const idx = distinct(R, M, n);
          const comp = compose(S, idx.map((i) => mat.subarray(i * L, (i + 1) * L)));
          // pozițiile decodate (1-based), în ordine crescătoare
          const pos = new Set(distinct(R, n, per).map((p) => p + 1));
          let cur = comp;
          for (let p = 1; p <= n; p++) {
            cur = S.order(cur, -1); // ρ^-p comp
            if (!pos.has(p)) continue;
            tot++;
            if (fastNearest(S.unembed(cur), mat, M, L) !== idx[p - 1]) err++;
          }
        }
        const rate = err / tot;
        results.push({ strategy: name, D, M, n, decodes: tot, units, errors: err, errorRate: rate });
        if (rate < 0.01) K = n;
        if (rate > 0.2) { stopped = true; break; }
      }
      results.push({ strategy: name, D, M, summary: true, K, decodesPerN: dec, stoppedAbove20pct: stopped });
    }
  }
  const sum = results.filter((r) => r.summary);
  const K = (s, D, M) => sum.find((r) => r.strategy === s && r.D === D && r.M === M)?.K;
  const ks = sum.map((r) => `${r.strategy}/D${r.D}/M${r.M}: K=${r.K}`).join('; ');
  const sup = NAMES.map((s) => `${s} ${K(s, 4096, 10000) >= 16 ? 'da' : 'nu'} (K=${K(s, 4096, 10000)})`).join(', ');
  const decision = `K (eroare<1%) per strategie/D/M: ${ks}. K=16 la D=4096, M=10000 susținut: ${sup}. M=100000 omis (matrice prea mare/lentă). Valorile K sunt limitate de grila de n și de numărul de decodări (vezi decodesPerN).`;
  return writeResult(dir, {
    experiment: 'B2', question: 'Câți copii ține o unitate?', seed,
    note: `decodări/celulă între ${MIN_DEC} și ${MAX_DEC} (buget ${BUDGET} elem.), max ${PER_UNIT} poziții/unitate; compunere Horner`,
    counts: { BUDGET, MIN_DEC, MAX_DEC, PER_UNIT }, results, decision,
  });
}
