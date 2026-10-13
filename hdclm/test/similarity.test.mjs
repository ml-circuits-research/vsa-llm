// Exact față de vectori: similarity(comp(x), comp(y)) și simC(x, y) diferă cu mai puțin de t = 5/√D
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainSimple } from '../src/eval/run.mjs';
import { ExactSim } from '../src/memory/similarity.mjs';
import { VectorView, VectorSim } from '../src/memory/vectors.mjs';
import { makeStrategy } from '../src/hdc/strategy.mjs';
import { rng } from '../src/core/rng.mjs';

for (const [name, D] of [['bipolar', 4096], ['phasor', 4096]]) {
  test(`exact față de vectori (${name}, D=${D}), pe G7 după somn`, () => {
    const r = trainSimple({ set: 'G7', validate: false });
    const mem = r.mem;
    const S = makeStrategy(name, { D, seed: 1 });
    const vs = new VectorSim(new VectorView(VectorView.memorySource(mem), S, { seed: 1, w: r.cfg.w }));
    const ex = new ExactSim(ExactSim.memorySource(mem), r.cfg.w);
    const units = mem.allOfType('SEQ').concat(mem.allOfType('APP'));
    const t = 5 / Math.sqrt(D);
    const R = rng(7);
    let worstC = 0, worstE = 0;
    for (let i = 0; i < 300; i++) {
      const x = R.pick(units), y = R.pick(units);
      worstC = Math.max(worstC, Math.abs(vs.simC(x, y) - ex.simC(x, y)));
      worstE = Math.max(worstE, Math.abs(vs.simE(x, y) - ex.simE(x, y)));
    }
    assert.ok(worstC < t, `simC: abatere ${worstC} >= ${t}`);
    assert.ok(worstE < t, `simE: abatere ${worstE} >= ${t}`);
  });
}
