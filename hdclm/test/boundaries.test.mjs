import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { wordTokenize } from '../src/text/tokenizer.mjs';
import { segmentPrefix, buildUnit } from '../src/text/boundaries.mjs';
import { rng } from '../src/core/rng.mjs';

const fresh = (text, cfg) => {
  const m = new Memory(cfg);
  const r = ingest(m, text);
  return { m, r, t: (w) => m.tokenId(w) };
};

test('Ana reads. -> unitate de nivel 3', () => {
  const { m, r, t } = fresh('Ana reads.');
  assert.equal(m.level(r.root), 3);
  assert.deepEqual(m.children(r.root), [t('Ana'), t('reads'), t('.')]);
});

test('3.14 is pi. -> cuvânt [3 . 14] la nivel 1', () => {
  const { m, r, t } = fresh('3.14 is pi.');
  const w = m.lookup([t('3'), t('.'), t('14')]);
  assert.ok(w);
  assert.equal(m.level(w), 1);
  assert.deepEqual(m.children(r.root), [w, t('is'), t('pi'), t('.')]);
});

test('Ana reads, Ion writes.', () => {
  const { m, r, t } = fresh('Ana reads, Ion writes.');
  assert.equal(m.level(r.root), 3);
  const [c1, c2, dot] = m.children(r.root);
  assert.equal(dot, t('.'));
  assert.equal(m.level(c1), 2);
  assert.equal(m.level(c2), 2);
  assert.deepEqual(m.children(c1), [t('Ana'), t('reads'), t(',')]);
  assert.deepEqual(m.children(c2), [t('Ion'), t('writes')]);
});

test('un singur copil: Hi. -> [Hi .], Hi nu e învelit', () => {
  const { m, r, t } = fresh('Hi.');
  assert.deepEqual(m.children(r.root), [t('Hi'), t('.')]);
  assert.equal(m.byLevel(1).SEQ.length, 0);
});

test('mai mult de K copii: bucăți', () => {
  const { m, r } = fresh('a b c d e f g h i j.', { K: 4 });
  for (let id = 1; id < m.atoms.length; id++) if (m.atoms[id].def) assert.ok(m.atoms[id].def.items.length <= 4);
  assert.equal(m.text(r.root), 'a b c d e f g h i j .');
  assert.deepEqual(m.unfold(r.root), r.tokens);
  assert.ok(m.unitCount() > 1);
});

test('I12: prefixele produc unități existente care acoperă exact prefixul', () => {
  const R = rng(12);
  const vocab = ['Ana', 'reads', 'the', 'book', 'Ion', 'a', 'pi'];
  const K = 16;
  for (let it = 0; it < 200; it++) {
    const pieces = [];
    const n = 1 + R.int(14);
    for (let i = 0; i < n; i++) {
      let w = R.pick(vocab);
      const p = R();
      if (p < 0.15) w += ',';
      else if (p < 0.3) w += '.';
      pieces.push(w);
      if (R() < 0.1) pieces.push('\n');
    }
    const text = pieces.join(' ');
    const mem = new Memory({ K });
    const { tokens: ids } = ingest(mem, text);
    const toks = wordTokenize(text).map((t, i) => ({ ...t, ref: ids[i] }));
    for (let k = 1; k <= toks.length; k++) {
      const last = toks[k - 1].text;
      const next = toks[k];
      if ('.!?'.includes(last) && next && !next.spaceBefore && !next.newlineBefore) continue;
      const stack = segmentPrefix(toks.slice(0, k));
      const out = [];
      for (let l = stack.length - 1; l >= 0; l--) {
        for (const item of stack[l].items) {
          const id = buildUnit(item, { unit: (items) => mem.lookup(items) }, K);
          if (id === null) continue;
          assert.notEqual(id, undefined, `unitate lipsă: "${text}" prefix ${k}`);
          out.push(...mem.unfold(id));
        }
      }
      assert.deepEqual(out, ids.slice(0, k), `"${text}" prefix ${k}`);
    }
  }
});
