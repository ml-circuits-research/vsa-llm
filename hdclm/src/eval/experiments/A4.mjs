// A4: se confirmă gruparea singură? (G4; cu și fără înghețarea memoriei; ponderea îmbogățirii)
import { runDir, trainSimple, writeResult } from '../run.mjs';

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('A4');
  const grid = [];
  for (const freeze of [true, false])
    for (const w of [0, 0.25, 0.5, 0.75, 1, 1.5, 2]) {
      const r = trainSimple({ base, set: 'G4', seed, overrides: { freeze, w }, splitOpts: { allTrain: true }, validate: false });
      grid.push({ freeze, w, patternsPerPass: r.passes.map((p) => p.patterns), finalPatterns: r.passes.at(-1)?.patterns ?? 0 });
    }
  const ok = grid.filter((g) => g.freeze && g.finalPatterns === 0).map((g) => g.w);
  const wMax = ok.length ? Math.max(...ok) : null;
  return writeResult(dir, {
    experiment: 'A4',
    question: 'Se confirmă gruparea singură?',
    seed,
    grid,
    decision: grid.every((g) => g.finalPatterns === 0)
      ? `niciun tipar pe text fără structură, la orice w încercat (până la ${wMax}); înghețarea nu schimbă nimic pe G4`
      : `cu memoria înghețată, cel mai mare w fără tipare: ${wMax}`,
  });
}
