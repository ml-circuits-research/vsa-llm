// trecerile somnului adânc (felul lor) și, pentru tipizare / inducție, ce a judecat judecata unică
import { trainSimple } from '../../src/eval/run.mjs';
const r = trainSimple({ set: process.env.SET ?? 'GBLIND', seed: +(process.argv[2] ?? 1), overrides: JSON.parse(process.env.OV ?? '{}') });
const k = {};
for (const p of r.passes) k[p.kind] = (k[p.kind] ?? 0) + 1;
console.log(JSON.stringify(k));
for (const p of r.passes.filter((p) => p.kind === 'types' || p.kind === 'induction' || p.kind === 'concepts')) console.log(JSON.stringify(p).slice(0, 1500));
