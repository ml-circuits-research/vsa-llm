import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadGpt2 } from '../src/text/gpt2.mjs';
import { tokenize } from '../src/text/tokenizer.mjs';
import { Memory } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { rng } from '../src/core/rng.mjs';

const g = loadGpt2(fileURLToPath(new URL('../data/gpt2', import.meta.url)));
const ids = (t) => g.encode(t).map((x) => x.id);

test('id-uri GPT-2 cunoscute', () => {
  assert.deepEqual(ids('Hello world'), [15496, 995]);
  assert.deepEqual(ids(' Hello'), [18435]);
  assert.deepEqual(ids('Once upon a time, there was a little girl.'),
    [7454, 2402, 257, 640, 11, 612, 373, 257, 1310, 2576, 13]);
});

test('unicode: café ☕ și emoji', () => {
  for (const t of ['café ☕', 'Ana citește 😀 țară', '日本語 テキスト']) {
    assert.equal(g.decode(ids(t)), t);
    assert.equal(g.encode(t).map((x) => x.text).join(''), t);
  }
});

test('500 texte aleatoare: refacere exactă', () => {
  const R = rng(7);
  const parts = ['a', 'b', 'the', 'Ana', 'x', 'Z', '7', '42', '.', ',', '!', '?', "'s", "n't", '-', '(', ' ', ' ', '  ', '\n', '\n\n', '\t', 'é', 'ț', '☕', '😀', '日'];
  for (let i = 0; i < 500; i++) {
    let t = '';
    const n = R.int(40);
    for (let j = 0; j < n; j++) t += R.pick(parts);
    const toks = g.encode(t);
    assert.equal(g.decode(toks.map((x) => x.id)), t, JSON.stringify(t));
    assert.equal(toks.map((x) => x.text).join(''), t, JSON.stringify(t));
  }
});

test('indicatori pentru spațiu alb și cuvinte cu spațiu în față', () => {
  const a = g.encode('end.\n\nNext word');
  assert.deepEqual(a.map((x) => x.text), ['end', '.', '\n', '\n', 'Next', ' word']); // regula \s+(?!\S)
  assert.equal(a[2].newlineBefore, true);
  assert.equal(a[4].newlineBefore, true); // după un token cu \n
  assert.equal(a[5].spaceBefore, true);
  assert.equal(a[5].newlineBefore, false);
  const b = g.encode('a   b');
  assert.equal(b[1].text, '  '.slice(1));
  assert.equal(b[1].spaceBefore, true);
  assert.equal(b[1].newlineBefore, false);
});

test('tokenize(gpt2) și ingest cu modul gpt2', () => {
  assert.deepEqual(tokenize('Hello world', 'gpt2').map((x) => x.text), ['Hello', ' world']);
  const mem = new Memory();
  for (const text of [
    'The cat sat on the mat. It was happy.\n\nThen the dog came, and they played.\n',
    'One paragraph only',
    'A  double  space.\n\n\nThree newlines, café ☕ — done!',
  ]) {
    const { root } = ingest(mem, text, { mode: 'gpt2' });
    const joined = mem.unfold(root).map((t) => mem.atoms[t].text).join('');
    assert.equal(joined, text);
  }
});

test('viteza: 1 MB text englez', () => {
  const R = rng(3);
  const w = ['the', 'cat', 'sat', 'on', 'a', 'mat', 'and', 'was', 'happy', 'little', 'girl', 'there', 'once', 'upon', 'time'];
  let t = '';
  while (t.length < 1e6) t += R.pick(w) + R.pick([' ', ' ', ' ', ', ', '. ', '.\n']);
  const t0 = performance.now();
  const toks = g.encode(t);
  const ms = performance.now() - t0;
  console.log(`encode 1 MB: ${ms.toFixed(0)} ms, ${toks.length} tokeni`);
  assert.ok(ms < 5000);
  assert.equal(toks.map((x) => x.text).join(''), t);
});
