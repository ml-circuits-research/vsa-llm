// B3: de la ce asemănare în sus două unități „seamănă” (θ_group)?
import { makeStrategy } from '../../hdc/strategy.mjs';
import { rng } from '../../core/rng.mjs';
import { runDir, writeResult } from '../run.mjs';
import { w, compose } from './hdutil.mjs';

const NAMES = ['bipolar', 'phasor'];
const DIMS = [1024, 4096, 16384];
const NS = [3, 5, 8];
const BUDGET = 2.5e8; // ~elemente procesate per celulă; trials = BUDGET/(D·w·n·10), între 200 și 2000
const stat = (a) => {
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return { mean: m, sd: Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length), min: Math.min(...a), max: Math.max(...a) };
};

// prag t (sim >= t => „seamănă”) care minimizează max(eroare neînrudite, eroare înrudite)
function bestThreshold(unrel, rel) {
  const all = [...unrel, ...rel].sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i <= all.length; i++) {
    const t = i === 0 ? all[0] - 1e-6 : i === all.length ? all[i - 1] + 1e-6 : (all[i - 1] + all[i]) / 2;
    const eA = unrel.filter((x) => x >= t).length / unrel.length;
    const eR = rel.filter((x) => x < t).length / rel.length;
    const m = Math.max(eA, eR);
    if (!best || m < best.maxErr) best = { threshold: t, errUnrelated: eA, errRelated: eR, maxErr: m };
  }
  return best;
}

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('B3');
  const R = rng(seed);
  const results = [];
  for (const name of NAMES) for (const D of DIMS) {
    const S = makeStrategy(name, { D, seed });
    for (const n of NS) {
      const trials = Math.max(200, Math.min(2000, Math.floor(BUDGET / (D * w(S) * n * 10))));
      const a = [], b = [], c = [];
      const atoms = (k) => Array.from({ length: k }, () => S.newAtom(R));
      for (let t = 0; t < trials; t++) {
        const ch = atoms(n), U = compose(S, ch);
        a.push(S.similarity(U, compose(S, atoms(n))));
        const rep = R.shuffle([...Array(n).keys()]); // pozițiile înlocuite
        const x = ch.slice(); x[rep[0]] = S.newAtom(R);
        b.push(S.similarity(U, compose(S, x)));
        const y = x.slice(); y[rep[1]] = S.newAtom(R);
        c.push(S.similarity(U, compose(S, y)));
      }
      const e1 = bestThreshold(a, b), e2 = bestThreshold(a, c);
      results.push({
        strategy: name, D, n, trials, exact: { except1: (n - 1) / n, except2: (n - 2) / n },
        dist: { unrelated: stat(a), except1: stat(b), except2: stat(c) },
        except1: e1, except2: e2,
        theta_group: e2.threshold, // pragul pentru „except 2” (cazul greu) separă și „except 1”
        ok: e1.maxErr < 0.01 && e2.maxErr < 0.01,
      });
    }
  }
  const lines = [];
  for (const name of NAMES) {
    const okD = DIMS.filter((D) => results.filter((r) => r.strategy === name && r.D === D).every((r) => r.ok));
    lines.push(`${name}: separă (<1%) pentru n=3,5,8 de la D=${okD[0] ?? 'niciunul (D prea mic)'}`);
  }
  const ref = results.filter((r) => r.D === 4096).map((r) => `${r.strategy}/n${r.n}: θ=${r.theta_group.toFixed(2)}`).join(', ');
  const decision = `θ_group = pragul care separă neînrudite de unități cu 1–2 copii diferiți cu eroare <1%: ${lines.join('; ')}. La D=4096: ${ref}. Valori exacte (n−j)/n.`;
  return writeResult(dir, {
    experiment: 'B3', question: 'De la ce asemănare în sus două unități seamănă?', seed,
    note: `trials per celulă între 200 și 2000 (buget ${BUDGET})`, results, decision,
  });
}
