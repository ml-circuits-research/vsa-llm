import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { deepSleep } from '../src/sleep/scheduler.mjs';
import { generateSet, splitDocs } from '../src/data/generate.mjs';
import { loadConfig } from '../src/core/config.mjs';
import { Predictor, argmax, EOT, UNK } from '../src/predict/distribution.mjs';
import { generate } from '../src/predict/generate.mjs';

const cfg = loadConfig();

// memorie din documente; opțional cu somn adânc
function build(docs, sleep) {
  const mem = new Memory(cfg);
  for (const d of docs) ingest(mem, d.text);
  if (sleep) deepSleep(mem, cfg);
  return mem;
}
const texts = (name) => generateSet(name, 1).docs;

test('I10: distribuție normalizată, cu masă pe tot vocabularul + UNK + EOT', () => {
  // prefixe: vid, la jumătate, după "." / "?", și în interiorul cuvintelor
  const prefixes = new Set(['']);
  for (const [name, idx] of [['G1', 0], ['G3', 0], ['G3', 5], ['G7', 3]]) {
    const t = texts(name)[idx].text;
    for (let i = 1; i < t.length; i++) prefixes.add(t.slice(0, i));
  }
  const all = [...prefixes];
  const pick = all.filter((_, i) => i % Math.ceil(all.length / 30) === 0).slice(0, 30);
  pick.push('Ana reads.', 'Ana has the book. Who has the book?');
  for (const name of ['G1', 'G3', 'G7'])
    for (const sleep of [false, true]) {
      const mem = build(texts(name), sleep);
      const pred = new Predictor(mem, cfg);
      for (const p of pick) {
        const d = pred.nextFromText(p);
        assert.ok(d instanceof Map);
        let s = 0;
        for (const v of d.values()) s += v;
        assert.ok(Math.abs(s - 1) < 1e-9, `${name}/${sleep} "${p}": suma ${s}`);
        const keys = [...mem.atoms.slice(1).filter((a) => a.kind === 'TOKEN').map((a) => a.id), UNK, EOT];
        for (const k of keys) assert.ok((d.get(k) ?? 0) > 0, `${name}/${sleep} "${p}": lipsește ${k}`);
      }
    }
});

test('primul token: Ana 0.3 + Anca 0.3 -> [An] 0.6', () => {
  const mem = new Memory();
  const An = mem.token('An'), a = mem.token('a'), ca = mem.token('ca'), X = mem.token('X');
  const ana = mem.intern({ type: 'SEQ', items: [An, a] }, 1).id;
  const anca = mem.intern({ type: 'SEQ', items: [An, ca] }, 1).id;
  const pred = new Predictor(mem, cfg);
  pred.childDistribution = () => new Map([[ana, 0.3], [anca, 0.3], [X, 0.4]]);
  const r = pred.P([{ level: 3, levels: [3], prefix: [] }], 0);
  assert.ok(Math.abs(r.get(An) - 0.6) < 1e-12);
  assert.ok(Math.abs(r.get(X) - 0.4) < 1e-12);
});

test('G3: țara corectă are probabilitatea maximă după "X is the capital of"', () => {
  const docs = texts('G3');
  const mem = build(docs, true);
  const pred = new Predictor(mem, cfg);
  let ok = 0;
  for (const d of docs) {
    const { city, country } = d.meta;
    const prompt = d.text.slice(0, d.text.indexOf(country)).trimEnd();
    const dist = pred.nextFromText(prompt);
    const best = docs.map((e) => e.meta.country).reduce((b, c) => (pred.prob(dist, c) > pred.prob(dist, b) ? c : b));
    if (best === country) ok++;
    if (city === 'Paris') {
      assert.equal(prompt, 'Paris is the capital of');
      for (const e of docs) if (e.meta.country !== 'France') assert.ok(pred.prob(dist, 'France') > pred.prob(dist, e.meta.country));
    }
  }
  console.log(`G3 corect: ${ok}/20`);
  assert.equal(ok, 20, `doar ${ok}/20`);
});

test('G7: legare nume-obiect pe documente ținute deoparte', () => {
  const split = splitDocs(generateSet('G7', 1), 1);
  const mem = build(split.train, true);
  const pred = new Predictor(mem, cfg);
  let ok = 0;
  for (const d of split.test) if (pred.tokenText(argmax(pred.nextFromText(d.meta.prompt))) === d.meta.answer) ok++;
  console.log(`G7 corect: ${ok}/${split.test.length}`);
  assert.ok(split.test.length > 0);
  assert.ok(ok / split.test.length >= 0.9, `${ok}/${split.test.length}`);
});

test('predicția nu scrie în memorie', () => {
  const mem = build(texts('G1'), true);
  const j = mem.toJSONL(), v = mem.version, n = mem.atoms.length;
  const pred = new Predictor(mem, cfg);
  for (const d of texts('G1')) for (let i = 0; i <= d.text.length; i += 2) pred.nextFromText(d.text.slice(0, i));
  pred.nextFromText('Zorro jumps');
  assert.equal(mem.toJSONL(), j);
  assert.equal(mem.version, v);
  assert.equal(mem.atoms.length, n);
});

test('generate: după G1 + somn, "Ana" -> se termină cu "." și ≤ 50 tokeni', () => {
  const mem = build(texts('G1'), true);
  const g = generate(mem, cfg, 'Ana');
  assert.ok(g.tokens.length <= 50);
  assert.ok(g.tokens.length > 0);
  assert.equal(g.tokens[g.tokens.length - 1], '.');
});
