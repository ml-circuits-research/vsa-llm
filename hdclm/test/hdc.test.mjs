import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStrategy, STRATEGIES } from '../src/hdc/strategy.mjs';
import { checkStrategy } from '../src/hdc/check.mjs';
import { rng } from '../src/core/rng.mjs';

const fails = (r) => Object.entries(r.props).filter(([, p]) => !p.pass).map(([h]) => h);

for (const [name, D] of [['bipolar', 1024], ['bipolar', 4096], ['phasor', 1024]]) {
  test(`${name} D=${D} respectă H1–H8`, () => {
    const r = checkStrategy(makeStrategy(name, { D, seed: 1 }), { trials: 2000, seed: 1 });
    assert.deepEqual(fails(r), [], JSON.stringify(r.props));
  });
}

test('binary D=1024 pică H6 (așteptat: majoritatea rotunjește; rezultat legitim pentru B1)', () => {
  const r = checkStrategy(makeStrategy('binary', { D: 1024, seed: 1 }), { trials: 2000, seed: 1 });
  assert.equal(r.props.H6.pass, false);
  assert.equal(r.props.H2.pass, true); // XOR e exact
});

test('determinism: aceeași sămânță, aceiași atomi și permutări', () => {
  for (const name of STRATEGIES) {
    const A = makeStrategy(name, { D: 256, seed: 7 }), B = makeStrategy(name, { D: 256, seed: 7 });
    const a = A.newAtom(rng(3)), b = B.newAtom(rng(3));
    assert.deepEqual(a, b);
    assert.deepEqual(A.order(a, 2), B.order(b, 2));
    assert.deepEqual(A.embed(a), B.embed(b));
  }
});

test('nearest: sortare după sim desc, apoi id', () => {
  const S = makeStrategy('bipolar', { D: 512, seed: 1 });
  const R = rng(1), q = S.newAtom(R), o = S.newAtom(R);
  const r = S.nearest(q, [{ id: 'b', v: q }, { id: 'a', v: q }, { id: 'c', v: o }], 2);
  assert.deepEqual(r.map((x) => x.id), ['a', 'b']);
  assert.ok(Math.abs(r[0].sim - 1) < 1e-6);
});
