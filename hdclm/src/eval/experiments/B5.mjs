// B5: dă strategia cu vectori aceleași rezultate ca cea exactă? (blocul A, fără A4 și A7, care sunt lente)
import { runDir, writeResult } from '../run.mjs';
import * as A1 from './A1.mjs';
import * as A3 from './A3.mjs';
import * as A5 from './A5.mjs';
import * as A6 from './A6.mjs';
import * as G2P from './G2P.mjs';

const pick = {
  A1: (r) => ({ pass: r.byMeasure.bits.G1.pass && r.byMeasure.bits.G2.pass, G2errSleep: r.byMeasure.bits.G2.errSleep }),
  A3: (r) => ({ pass: r.accSleep > 0.95, acc: r.accSleep }),
  A5: (r) => ({ pass: r.results.bound.accSleep > 0.95, acc: r.results.bound.accSleep, total: r.results.bound.totalAfter }),
  A6: (r) => ({ pass: r.results.default.accSleep > 0.9, acc: r.results.default.accSleep, total: r.results.default.totalAfter }),
  G2P: (r) => ({ pass: r.results['biți'].errHeld < r.results['termeni'].errHeld - 0.05, errHeld: r.results['biți'].errHeld }),
};

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('B5');
  const out = {};
  for (const strategy of ['exact', 'bipolar', 'phasor']) {
    const b = { ...base, strategy, D: base.D ?? 4096 };
    out[strategy] = {};
    for (const [name, mod] of Object.entries({ A1, A3, A5, A6, G2P })) {
      const t0 = performance.now();
      out[strategy][name] = { ...pick[name](mod.run({ seed, base: b })), seconds: +((performance.now() - t0) / 1000).toFixed(1) };
    }
  }
  const same = (s) => Object.keys(pick).every((k) => out[s][k].pass === out.exact[k].pass);
  const res = writeResult(dir, {
    experiment: 'B5',
    question: 'Dă strategia cu vectori aceleași rezultate ca cea exactă?',
    seed,
    D: base.D ?? 4096,
    note: 'timpii depind de mașină; doar măsurătoare',
    results: out,
    decision: ['bipolar', 'phasor'].map((s) => `${s}: ${same(s) ? 'rămâne (aceleași decizii ca exacta)' : 'iese (decizii diferite)'}`).join('; '),
  });
  return res;
}
