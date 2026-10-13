// Controlul orb (P2): aceleași măsurători ca FORMAL, pe GBLIND, cu configurarea fixată dinainte.
// Se rulează o singură dată pe configurare; rezultatul se raportează așa cum iese.
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { answerAccuracy } from '../metrics.mjs';
import { formalQuality } from '../formal.mjs';
import { meaningSummary } from '../../memory/meaning.mjs';
import { GBLIND_GOLD } from '../../data/gblind.mjs';
import { GBLIND2_GOLD } from '../../data/gblind2.mjs';
import { paraphraseScore } from './FORMAL.mjs';

export function run({ seed = 1, base = {} } = {}) {
  // setul orb: GBLIND (implicit) sau altul dat prin --set blindSet=GBLIND2
  const set = base.blindSet ?? 'GBLIND';
  const GOLD = { GBLIND: GBLIND_GOLD, GBLIND2: GBLIND2_GOLD }[set];
  const dir = runDir(set === 'GBLIND' ? 'BLIND' : `BLIND-${set}`);
  const r = trainSimple({ base, set, seed, dir });
  const held = r.split.test.filter((d) => d.heldout);
  const qa = answerAccuracy(r.mem, r.cfg, held);
  const byMeaning = {};
  for (const row of qa.rows) {
    const k = `${row.meta.meaningAsked}${row.meta.trap ? '/' + row.meta.trap : ''}`;
    const g = (byMeaning[k] ??= { n: 0, ok: 0 });
    g.n++;
    if (row.ok) g.ok++;
  }
  const para = paraphraseScore(r.mem, GOLD);
  const quality = formalQuality(r.mem, r.roots.map((x) => x.id), { meanings: GOLD.meanings });
  return writeResult(dir, {
    experiment: 'BLIND',
    question: 'Se generalizează unificarea reformulărilor pe un set nevăzut, fără reparații după el?',
    seed,
    config: r.cfg,
    results: { train: r.split.train.length, heldoutTested: qa.n, qa: qa.acc, qaByMeaning: byMeaning, paraphrase: para, quality, meaning: meaningSummary(r.mem), passes: r.passes.length },
    decision: `${set}: reformulări cu aceeași ecuație ${(para.sameCanon * 100).toFixed(0)}% (${para.paraphrasePairs} perechi), capcane contopite ${(para.trapSameCanon * 100).toFixed(0)}% (${para.trapPairs} perechi), tipare ${quality.patterns}, clase ${quality.patternClasses}, QA pe puse deoparte ${(qa.acc * 100).toFixed(0)}% (${qa.n})`,
  });
}
