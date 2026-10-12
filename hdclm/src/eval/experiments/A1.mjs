// A1: găsește sistemul singur două tipare care folosesc aceeași alegere? (G1, G2)
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { predError, describe, total } from '../metrics.mjs';
import { Memory } from '../../memory/store.mjs';
import { ingest } from '../../wake/ingest.mjs';

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('A1');
  const out = {};
  for (const measure of ['terms', 'bits']) out[measure] = runMeasure(seed, measure, base);
  const sets = out.terms;
  return writeResult(dir, {
    experiment: 'A1',
    question: 'Găsește sistemul singur două tipare care folosesc aceeași alegere?',
    seed,
    byMeasure: out,
    decision: ['terms', 'bits'].map((m) => `${m}: G1 ${out[m].G1.pass ? 'trece' : 'pică'}, G2 ${out[m].G2.pass ? 'trece' : 'pică'}`).join('; '),
  });
}

function runMeasure(seed, measure, base = {}) {
  const sets = {};
  for (const set of ['G1', 'G2']) {
    const r = trainSimple({ base, set, seed, overrides: { ...base, measure }, splitOpts: { allTrain: true }, dir: null });
    // aceeași memorie fără somn, ca referință
    const raw = new Memory(r.cfg);
    for (const d of r.split.train) ingest(raw, d.text, { docName: d.id });
    const errNoSleep = predError(raw, r.cfg, r.split.test);
    const errSleep = predError(r.mem, r.cfg, r.split.test);
    const desc = describe(r.mem);
    const choicesUsed = new Set(desc.patterns.flatMap((p) => p.slots.map((s) => s.accepts)));
    const crit = {
      // două tipare care folosesc aceleași alegeri
      twoPatternsSharedChoices: desc.patterns.length === 2 && [...choicesUsed].every((c) => desc.patterns.every((p) => p.slots.some((s) => s.accepts === c))),
      totalSmaller: total(r.mem, r.cfg.measure) < r.before.total,
      reconstruction100: r.recon === 1,
      errorLower: errSleep < errNoSleep,
    };
    sets[set] = {
      train: r.split.train.length,
      test: r.split.test.length,
      totalBefore: r.before.total,
      totalAfter: total(r.mem, r.cfg.measure),
      patterns: desc.patterns,
      choices: desc.choices,
      reconstruction: r.recon,
      errNoSleep,
      errSleep,
      criteria: crit,
      pass: Object.values(crit).every(Boolean),
      passes: r.passes,
    };
  }
  return sets;
}
