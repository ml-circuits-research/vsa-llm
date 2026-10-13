// Controlul orb (P2): aceleași măsurători ca FORMAL, pe GBLIND, cu configurarea fixată dinainte.
// Se rulează o singură dată pe configurare; rezultatul se raportează așa cum iese.
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { answerAccuracy } from '../metrics.mjs';
import { formalQuality } from '../formal.mjs';
import { meaningSummary } from '../../memory/meaning.mjs';
import { GBLIND_GOLD } from '../../data/gblind.mjs';
import { paraphraseScore } from './FORMAL.mjs';

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('BLIND');
  const r = trainSimple({ base, set: 'GBLIND', seed, dir });
  const held = r.split.test.filter((d) => d.heldout);
  const qa = answerAccuracy(r.mem, r.cfg, held);
  const byMeaning = {};
  for (const row of qa.rows) {
    const k = `${row.meta.meaningAsked}${row.meta.trap ? '/' + row.meta.trap : ''}`;
    const g = (byMeaning[k] ??= { n: 0, ok: 0 });
    g.n++;
    if (row.ok) g.ok++;
  }
  const para = paraphraseScore(r.mem, GBLIND_GOLD);
  const quality = formalQuality(r.mem, r.roots.map((x) => x.id), { meanings: GBLIND_GOLD.meanings });
  return writeResult(dir, {
    experiment: 'BLIND',
    question: 'Se generalizează unificarea reformulărilor pe un set nevăzut, fără reparații după el?',
    seed,
    config: r.cfg,
    results: { train: r.split.train.length, heldoutTested: qa.n, qa: qa.acc, qaByMeaning: byMeaning, paraphrase: para, quality, meaning: meaningSummary(r.mem), passes: r.passes.length },
    decision: `GBLIND: reformulări cu aceeași ecuație ${(para.sameCanon * 100).toFixed(0)}% (${para.paraphrasePairs} perechi), capcane contopite ${(para.trapSameCanon * 100).toFixed(0)}% (${para.trapPairs} perechi), tipare ${quality.patterns}, clase ${quality.patternClasses}, QA pe puse deoparte ${(qa.acc * 100).toFixed(0)}% (${qa.n})`,
  });
}
