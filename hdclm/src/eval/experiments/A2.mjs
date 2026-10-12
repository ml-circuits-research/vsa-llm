// A2: ajunge judecata în pachet? (G1 complet: 60 / 63 / 56)
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { total, describe } from '../metrics.mjs';

export function run({ seed = 1 } = {}) {
  const dir = runDir('A2');
  const out = {};
  for (const [name, packageJudge] of [['package', true], ['oneByOne', false]]) {
    const r = trainSimple({ set: 'G1', seed, overrides: { packageJudge }, genOpts: { holdout: false }, splitOpts: { allTrain: true }, validate: false });
    out[name] = { totalBefore: r.before.total, totalAfter: total(r.mem, r.cfg.measure), patterns: describe(r.mem).patterns.length };
  }
  const pass = out.package.totalAfter < out.oneByOne.totalAfter && out.package.totalAfter <= 56;
  return writeResult(dir, {
    experiment: 'A2',
    question: 'Ajunge judecata în pachet?',
    seed,
    results: out,
    decision: pass ? 'pachetul rămâne (total mai mic, 56 termeni)' : 'procedura trebuie schimbată',
  });
}
