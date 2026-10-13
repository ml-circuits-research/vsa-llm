import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { checkInvariants } from '../src/core/invariants.mjs';
import { total } from '../src/memory/size.mjs';

test('intern: aceiași copii -> același id, isNew false', () => {
  const m = new Memory();
  const a = m.token('a'), b = m.token('b');
  const r1 = m.intern({ type: 'SEQ', items: [a, b] }, 1);
  const r2 = m.intern({ type: 'SEQ', items: [a, b] }, 1);
  assert.equal(r1.isNew, true);
  assert.equal(r2.isNew, false);
  assert.equal(r1.id, r2.id);
});

test('citirea aceluiași text de două ori: fără atomi noi, count crește', () => {
  const m = new Memory();
  const r1 = ingest(m, 'Ana reads the book.');
  const n = m.atoms.length;
  const c = m.atoms[r1.root].count;
  const r2 = ingest(m, 'Ana reads the book.');
  assert.equal(m.atoms.length, n);
  assert.equal(r1.root, r2.root);
  assert.equal(m.atoms[r1.root].count, c + 1);
});

test('unfold al rădăcinii = tokenii din ingest', () => {
  const m = new Memory();
  const r = ingest(m, 'Ana reads, Ion writes. Dan sees 3.14 now.\nNew line here.');
  assert.deepEqual(m.unfold(r.root), r.tokens);
});

test('I7: scriere în timpul trecerii de somn', () => {
  const m = new Memory();
  const a = m.token('a'), b = m.token('b');
  m.beginPass();
  assert.throws(() => m.intern({ type: 'SEQ', items: [a, b] }, 1), (e) => e.code === 'I7');
  assert.throws(() => m.token('new'), (e) => e.code === 'I7');
});

function setup() {
  const m = new Memory();
  const roots = ['Ana reads.', 'Ion reads.', 'Dan reads.'].map((t) => ingest(m, t).root);
  const id = (t) => m.tokenId(t);
  m.beginPass();
  const pkg = {
    newChoices: [{ tmp: -1, level: 0, members: [[id('Ana'), 1], [id('Ion'), 1], [id('Dan'), 1]] }],
    newPatterns: [{
      tmp: -2, level: 3,
      items: [{ slot: -3 }, { fixed: id('reads') }, { fixed: id('.') }],
      slots: [-3], structs: [{ tmp: -3, accepts: -1 }],
    }],
    rewrites: [
      { unit: roots[0], pattern: -2, fills: [id('Ana')] },
      { unit: roots[1], pattern: -2, fills: [id('Ion')] },
      { unit: roots[2], pattern: -2, fills: [id('Dan')] },
    ],
    seen: { 3: roots },
  };
  return { m, roots, id, pkg };
}

test('commit: rescriere în APP, copii și text neschimbate', () => {
  const { m, roots, id, pkg } = setup();
  const before = roots.map((r) => ({ c: m.children(r).slice(), u: m.unfold(r).slice() }));
  const v = m.version;
  const map = m.commit(pkg);
  roots.forEach((r, i) => {
    assert.equal(m.def(r).type, 'APP');
    assert.deepEqual(m.children(r), before[i].c);
    assert.deepEqual(m.unfold(r, { fresh: true }), before[i].u);
  });
  assert.equal(m.version, v + 1);
  assert.equal(total(m), 12);
  assert.ok(m.atoms[id('Ana')].choices.includes(map.get(-1)));
  assert.equal(checkInvariants(m), true);
});

test('I6: umplere care nu e membru', () => {
  const { m, roots, id, pkg } = setup();
  m.commit(pkg);
  m.def(roots[0]).fills[0] = id('reads');
  assert.throws(() => checkInvariants(m), (e) => e.code === 'I6');
});
