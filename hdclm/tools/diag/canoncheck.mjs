// capcanele contopite: cu clasele folosite de metrica (classIndex: vii sau „sens”) și doar cu clasele vii
import { trainSimple } from '../../src/eval/run.mjs';
import { classIndex, liveClassIndex } from '../../src/memory/meaning.mjs';
import { paraphraseScore } from '../../src/eval/experiments/FORMAL.mjs';
import { GBLIND2_GOLD } from '../../src/data/gblind2.mjs';
import * as meaning from '../../src/memory/meaning.mjs';
const r = trainSimple({ set: 'GBLIND2', seed: +(process.argv[2] ?? 1), overrides: JSON.parse(process.env.OV ?? '{}') });
const m = r.mem;
console.log('metrica preînregistrată', JSON.stringify(paraphraseScore(m, GBLIND2_GOLD)));
const ci = classIndex(m), li = liveClassIndex(m);
for (const c of m.allOfType('PCLASS')) console.log('clasa', c, 'vie', m.isLive(c), JSON.stringify(m.atoms[c].concept?.kind ?? null), m.atoms[c].def.members.map((p) => m.atoms[p].def.items.filter((it) => it.fixed !== undefined).map((it) => m.atoms[it.fixed].text).join(' ')).join(' | '));
// aceeași metrică, cu classIndex înlocuit de clasele vii (citire post-hoc, consecventă cu D20)
const orig = meaning.classIndex;
const pkg = await import('../../src/eval/experiments/FORMAL.mjs');
console.log('diferențe classIndex vs vii:', [...ci].filter(([p, c]) => li.get(p) !== c).map(([p, c]) => `${p}:${c}→${li.get(p) ?? '-'}`).join(' '));
