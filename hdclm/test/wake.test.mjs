import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { wordDetokenize } from '../src/text/tokenizer.mjs';
import { checkInvariants } from '../src/core/invariants.mjs';
import { generateSet } from '../src/data/generate.mjs';
import { rng } from '../src/core/rng.mjs';

for (const name of ['G1', 'G2', 'G3', 'G4', 'G5', 'G7', 'G8', 'G9']) {
  test(`ingest ${name}`, () => {
    const mem = new Memory();
    const set = generateSet(name, 1);
    for (const d of set.docs) {
      const { root, tokens } = ingest(mem, d.text, { docName: d.id });
      assert.deepEqual(mem.unfold(root), tokens, d.text);
      assert.equal(mem.text(root, wordDetokenize), d.text);
    }
    assert.equal(checkInvariants(mem), true);
  });
}

test('1000 texte aleatoare: refacere exactă', () => {
  const R = rng(99);
  const vocab = ['Ana', 'reads', 'the', 'book', 'Ion', 'x', 'pi', '3'];
  const mem = new Memory({ K: 5 });
  for (let it = 0; it < 1000; it++) {
    const pieces = [];
    const n = 1 + R.int(20);
    for (let i = 0; i < n; i++) {
      let w = R.pick(vocab);
      const p = R();
      if (p < 0.15) w += ',';
      else if (p < 0.3) w += '.';
      else if (p < 0.35) w += '?';
      pieces.push(w);
      if (R() < 0.08) pieces.push('\n');
    }
    const text = pieces.join(' ');
    const { root, tokens } = ingest(mem, text);
    assert.deepEqual(mem.unfold(root), tokens, text);
    if (!text.includes('\n')) assert.equal(mem.text(root, wordDetokenize), wordDetokenize(tokens.map((t) => mem.atoms[t].text)));
  }
  assert.equal(checkInvariants(mem), true);
});
