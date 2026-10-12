// Etapa 1 din PLAN.md: generalizează sistemul la o pereche verb–obiect nevăzută la învățare?
// Se compară măsurile: termeni, biți (amândouă cu interpretări alternative), și fără somn.
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { predError, describe, answerAccuracy } from '../metrics.mjs';
import { Predictor } from '../../predict/distribution.mjs';

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('G2P');
  const res = {};
  for (const [label, overrides, sleep] of [
    ['fără somn', {}, false],
    ['termeni', { measure: 'terms', alternatives: true }, true],
    ['biți', { measure: 'bits', alternatives: true }, true],
  ]) {
    const r = trainSimple({ base, set: 'G2P', seed, overrides, sleep, splitOpts: { allTrain: true }, validate: false });
    const held = [...r.split.val, ...r.split.test];
    const pred = new Predictor(r.mem, r.cfg);
    // probabilitatea obiectului corect după „Nume verb the”, printre cele 5 obiecte
    let pObj = 0;
    for (const d of held) {
      const dist = pred.nextFromText(d.meta.prompt);
      const ps = ['book', 'letter', 'poem', 'note', 'story'].map((o) => pred.prob(dist, o));
      pObj += pred.prob(dist, d.meta.answer) / ps.reduce((a, b) => a + b, 0);
    }
    const desc = describe(r.mem);
    res[label] = {
      patterns: desc.patterns.map((p) => p.text),
      choices: desc.choices.map((c) => c.members.join(',')),
      errHeld: predError(r.mem, r.cfg, held),
      errTrain: predError(r.mem, r.cfg, r.split.train.slice(0, 20)),
      objectShare: pObj / held.length, // partea obiectului corect, printre obiecte
      objectTop1: answerAccuracy(r.mem, r.cfg, held).acc,
    };
  }
  const t = res['termeni'], b = res['biți'];
  return writeResult(dir, {
    experiment: 'G2P',
    question: 'Generalizează la o pereche verb–obiect nevăzută? (termeni față de biți)',
    seed,
    heldPairs: [['writes', 'poem'], ['reads', 'note']],
    results: res,
    decision: b.errHeld < t.errHeld - 0.05
      ? `biții generalizează mai bine (eroare ${b.errHeld.toFixed(3)} față de ${t.errHeld.toFixed(3)} biți/token pe perechile nevăzute)`
      : `fără diferență clară (biți ${b.errHeld.toFixed(3)}, termeni ${t.errHeld.toFixed(3)}): decizia se rediscută`,
  });
}
