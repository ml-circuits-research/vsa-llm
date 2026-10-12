// A2: ajunge judecata în pachet? (G1 complet: 60 / 63 / 56)
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { total, describe } from '../metrics.mjs';

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('A2');
  const out = {};
  for (const [name, packageJudge] of [['package', true], ['oneByOne', false]]) {
    const r = trainSimple({ base, set: 'G1', seed, overrides: { packageJudge }, genOpts: { holdout: false }, splitOpts: { allTrain: true }, validate: false });
    out[name] = { totalBefore: r.before.total, totalAfter: total(r.mem, r.cfg.measure), patterns: describe(r.mem).patterns.length };
  }
  const terms = (base.measure ?? 'terms') === 'terms';
  const pass = out.package.totalAfter <= out.oneByOne.totalAfter + 1e-9 && (!terms || out.package.totalAfter <= 56);
  const needed = out.package.totalAfter < out.oneByOne.totalAfter - 1e-9;
  return writeResult(dir, {
    experiment: 'A2',
    question: 'Ajunge judecata în pachet?',
    seed,
    results: out,
    decision: pass
      ? `pachetul rămâne (${out.package.totalAfter.toFixed(1)} față de ${out.oneByOne.totalAfter.toFixed(1)} una câte una${needed ? '' : '; aici nu este necesar'})`
      : 'procedura trebuie schimbată',
  });
}
