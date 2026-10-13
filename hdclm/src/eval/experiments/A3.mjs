// A3: ține predicția cont de perechi? (G3)
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { Predictor } from '../../predict/distribution.mjs';
import { describe } from '../metrics.mjs';

function pairs(mem, cfg, docs) {
  const pred = new Predictor(mem, cfg);
  const countries = docs.map((d) => d.meta.country);
  const rows = docs.map((d) => {
    const prompt = d.text.slice(0, d.text.lastIndexOf(' ' + d.meta.country));
    const dist = pred.nextFromText(prompt);
    const ps = countries.map((c) => ({ c, p: pred.prob(dist, c) }));
    const best = ps.reduce((a, b) => (b.p > a.p + 1e-12 ? b : a));
    return { city: d.meta.city, country: d.meta.country, top: best.c, pCorrect: pred.prob(dist, d.meta.country), ok: best.c === d.meta.country };
  });
  return { acc: rows.filter((r) => r.ok).length / rows.length, rows };
}

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('A3');
  const noSleep = trainSimple({ base, set: 'G3', seed, splitOpts: { allTrain: true }, sleep: false });
  const r = trainSimple({ base, set: 'G3', seed, splitOpts: { allTrain: true }, validate: false });
  const a0 = pairs(noSleep.mem, noSleep.cfg, r.split.train);
  const a1 = pairs(r.mem, r.cfg, r.split.train);
  return writeResult(dir, {
    experiment: 'A3',
    question: 'Ține predicția cont de perechi?',
    seed,
    patterns: describe(r.mem).patterns,
    accNoSleep: a0.acc,
    accSleep: a1.acc,
    rows: a1.rows,
    decision: a1.acc > 0.95 ? 'trece (> 95%)' : 'pică',
  });
}
