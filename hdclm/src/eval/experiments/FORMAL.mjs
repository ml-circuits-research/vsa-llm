// E0/E1+ (ANALIZA_PARAFRAZE.md): calitatea formalizării pe GPARA și BABI2.
//  - formalQuality: acoperire, tipare, atomi de structură față de roluri, categorii duplicate, aur
//  - reformulări (GPARA): perechi de propoziții cu același sens, aceeași persoană și același loc/obiect,
//    formă diferită -> au aceeași ecuație canonică? Perechi MOVE/LEAVE (sens opus) -> nu au voie
//  - răspunsurile pe combinațiile puse deoparte
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { answerAccuracy } from '../metrics.mjs';
import { formalQuality } from '../formal.mjs';
import { canon, bearingSlots, meaningSummary, classIndex } from '../../memory/meaning.mjs';
import { GPARA_GOLD } from '../../data/gpara.mjs';

const formsOf = (gold) => new Map(Object.entries(gold.meanings).flatMap(([m, fs]) => fs.map((f) => [f, m])));

// „Nora went back to the attic .” -> { meaning, form, key: nume|țintă }
function parseFact(words, FORMS) {
  if (words.at(-1) !== '.' || words.length < 4) return null;
  const the = words.lastIndexOf('the');
  if (the < 2) return null;
  let mid = words.slice(1, the);
  if (mid.at(-1) === 'to') mid = mid.slice(0, -1);
  const form = mid.join(' ');
  const meaning = FORMS.get(form);
  return meaning ? { meaning, form, key: `${words[0]}|${words[the + 1]}` } : null;
}

// gold = { meanings, traps: [[sens, sens]] }: perechile de sensuri care nu au voie să aibă aceeași ecuație
export function paraphraseScore(mem, gold = { meanings: GPARA_GOLD.meanings, traps: [['MOVE', 'LEAVE']] }) {
  const FORMS = formsOf(gold);
  const isTrap = (x, y) => gold.traps.some(([p, q]) => (x === p && y === q) || (x === q && y === p));
  const bearing = bearingSlots(mem);
  const classOf = classIndex(mem);
  const facts = [];
  for (const u of [...mem.allOfType('SEQ'), ...mem.allOfType('APP')]) {
    if (mem.level(u) !== 3) continue;
    const f = parseFact(mem.unfold(u).map((t) => mem.atoms[t].text), FORMS);
    if (f) facts.push({ u, ...f, canon: canon(mem, u, bearing, classOf) });
  }
  let pairs = 0, same = 0, traps = 0, trapSame = 0;
  for (let i = 0; i < facts.length; i++)
    for (let j = i + 1; j < facts.length; j++) {
      const a = facts[i], b = facts[j];
      if (a.key !== b.key || a.form === b.form) continue;
      const eq = a.canon !== null && a.canon === b.canon;
      if (a.meaning === b.meaning) {
        pairs++;
        if (eq) same++;
      } else if (isTrap(a.meaning, b.meaning)) {
        traps++;
        if (eq) trapSame++;
      }
    }
  return { factUnits: facts.length, paraphrasePairs: pairs, sameCanon: pairs ? same / pairs : 0, trapPairs: traps, trapSameCanon: traps ? trapSame / traps : 0 };
}

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('FORMAL');
  const res = {};
  for (const set of ['GPARA', 'BABI2']) {
    const r = trainSimple({ base, set, seed, splitOpts: set === 'BABI2' ? { allTrain: true } : {}, validate: set !== 'BABI2' });
    const gold = set === 'GPARA' ? { meanings: GPARA_GOLD.meanings } : { meanings: { MOVE: ['moved', 'went', 'journeyed', 'travelled'] } };
    const held = r.split.test.filter((d) => d.heldout);
    const qa = answerAccuracy(r.mem, r.cfg, held.slice(0, 300));
    const byForm = {};
    if (set === 'GPARA')
      for (const row of qa.rows) {
        const k = `${row.meta.meaningAsked}${row.meta.trap ? '/capcană' : ''}`;
        const g = (byForm[k] ??= { n: 0, ok: 0 });
        g.n++;
        if (row.ok) g.ok++;
      }
    res[set] = {
      train: r.split.train.length,
      heldoutTested: qa.n,
      qa: qa.acc,
      qaByMeaning: byForm,
      quality: formalQuality(r.mem, r.roots.map((x) => x.id), gold),
      meaning: meaningSummary(r.mem),
      paraphrase: set === 'GPARA' ? paraphraseScore(r.mem) : null,
      classes: r.mem.allOfType('PCLASS').filter((c) => r.mem.isLive(c)).map((c) => r.mem.atoms[c].def.members.length),
      rules: r.mem.allOfType('PATTERN').filter((p) => r.mem.isLive(p) && r.mem.atoms[p].level >= 4).length,
    };
  }
  const g = res.GPARA;
  return writeResult(dir, {
    experiment: 'FORMAL',
    question: 'Cât de bună este formalizarea? Au reformulările aceeași ecuație canonică?',
    seed,
    results: res,
    decision: `GPARA: reformulări cu aceeași ecuație ${(g.paraphrase.sameCanon * 100).toFixed(0)}% (${g.paraphrase.paraphrasePairs} perechi), capcane MOVE/LEAVE contopite ${(g.paraphrase.trapSameCanon * 100).toFixed(0)}%, tipare ${g.quality.patterns}, redundanța rolurilor ${g.quality.redundancy.toFixed(1)} (efectivă, cu clase: ${g.quality.effectiveRedundancy.toFixed(1)}), clase ${g.quality.patternClasses}, QA pe puse deoparte ${(g.qa * 100).toFixed(0)}%; BABI2: tipare ${res.BABI2.quality.patterns}, reguli ${res.BABI2.rules}, QA ${(res.BABI2.qa * 100).toFixed(0)}%`,
  });
}
