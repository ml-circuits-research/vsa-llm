import { trainSimple } from '../../src/eval/run.mjs';
import { describe } from '../../src/eval/metrics.mjs';
const r = trainSimple({ set: process.env.SET ?? 'GBLIND', seed: +(process.argv[2] ?? 3), overrides: JSON.parse(process.env.OV ?? '{}') });
const m = r.mem, D = describe(m);
const pt = (id) => D.patterns.find((p) => p.id === id)?.text ?? id;
for (const c of m.allOfType('PCLASS')) {
  console.log('clasa', c, m.isLive(c), m.atoms[c].def.members.map(pt).join(' | '));
  for (const p of D.patterns.filter((p) => p.text.includes(`M${c}(`))) {
    console.log('   regula', p.id, 'u' + p.usage, p.text);
    for (const u of m.allOfType('APP').filter((u) => m.atoms[u].def.pattern === p.id).slice(0, 4)) console.log('      ', m.text(u));
  }
}
for (const c of D.choices.filter((c) => c.members.some((x) => String(x).startsWith('P')))) console.log('alegere', c.id, c.members.map((x) => (String(x).startsWith('P') ? pt(+x.slice(1)) : x)).join(' | '));
