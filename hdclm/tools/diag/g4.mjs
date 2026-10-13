// A4: ce tipar apare pe G4 (text fără structură) și cât câștigă
import { trainSimple } from '../../src/eval/run.mjs';
import { describe } from '../../src/eval/metrics.mjs';
const r = trainSimple({ set: 'G4', seed: +(process.argv[2] ?? 2), overrides: JSON.parse(process.env.OV ?? '{}'), splitOpts: { allTrain: true }, validate: false });
const D = describe(r.mem);
for (const p of D.patterns) console.log(p.id, 'L' + p.level, 'u' + p.usage, p.text);
for (const p of r.passes) if (p.kind !== 'deep≤1' && (p.changed || p.accepted)) console.log(p.kind, p.group ?? '', p.gain ?? '', p.total);
const units = r.mem.allOfType('APP');
for (const u of units.slice(0, 6)) console.log('  ', r.mem.text(u));
