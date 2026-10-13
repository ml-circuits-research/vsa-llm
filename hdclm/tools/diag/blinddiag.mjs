import { trainSimple } from '../../src/eval/run.mjs';
import { answerAccuracy, describe } from '../../src/eval/metrics.mjs';
const r = trainSimple({ set: process.env.SET ?? 'GBLIND', seed: +(process.argv[2] ?? 1), overrides: JSON.parse(process.env.OV ?? '{}') });
const by = (rows) => { const o = {}; for (const x of rows) { const k = `${x.meta.nFacts}f/${x.meta.meaningAsked}${x.meta.trap ? '/' + x.meta.trap : ''}`; (o[k] ??= [0, 0])[0]++; if (x.ok) o[k][1]++; } return JSON.stringify(o); };
const sets = { train: r.split.train.slice(0, 80), testNormal: r.split.test.filter((d) => !d.heldout), held: r.split.test.filter((d) => d.heldout) };
for (const [k, docs] of Object.entries(sets)) { const q = answerAccuracy(r.mem, r.cfg, docs); console.log(k, q.n, q.acc.toFixed(2), by(q.rows)); }
const D = describe(r.mem);
for (const p of D.patterns.filter((p) => p.level >= 4)) console.log(p.id, 'L' + p.level, 'u' + p.usage, p.text);
for (const p of D.patterns.filter((p) => p.level === 3)) console.log(p.id, 'L3 u' + p.usage, p.text);
