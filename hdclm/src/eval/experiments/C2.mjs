// C2: se reface textul? Din definiții (trebuie 100%) și doar din vectori (până la ce nivel).
// „Doar din vectori”: se pornește de la comp(unitate) și se decodează copiii poziție cu poziție
// (unembed(order(v, -k)) -> nearest printre vectorii atomilor de pe nivelurile de dedesubt),
// recursiv, până la tokeni. Fără somn, deci enr = comp.
import { runDir, writeResult } from '../run.mjs';
import { loadConfig } from '../../core/config.mjs';
import { Memory } from '../../memory/store.mjs';
import { ingest } from '../../wake/ingest.mjs';
import { tinySet } from '../../data/tinystories.mjs';
import { VectorView } from '../../memory/vectors.mjs';
import { makeStrategy } from '../../hdc/strategy.mjs';
import { rng } from '../../core/rng.mjs';

export function run({ seed = 1, base = {} } = {}) {
  const cfg = loadConfig(base);
  const dir = runDir('C2');
  // 1. din definiții
  const N = base.tokens ?? 100000;
  const data = tinySet(N, { seed });
  const mem = new Memory(cfg);
  let ok = 0;
  const docs = [...data.train, ...data.val, ...data.test];
  for (const d of docs) {
    const r = ingest(mem, d.text, { mode: 'gpt2', docName: d.id });
    const u = mem.unfold(r.root);
    if (u.length === r.tokens.length && u.every((x, i) => x === r.tokens[i])) ok++;
  }
  const fromDefs = ok / docs.length;
  // 2. doar din vectori, pe un corpus mai mic (căutarea e scumpă)
  const vt = base.vecTokens ?? 20000;
  const small = tinySet(vt, { seed });
  const m2 = new Memory(cfg);
  for (const d of [...small.train, ...small.val, ...small.test]) ingest(m2, d.text, { mode: 'gpt2', docName: d.id });
  const strategy = base.vecStrategy ?? 'bipolar';
  const D = base.vecD ?? 4096;
  const S = makeStrategy(strategy, { D, seed });
  const view = new VectorView(VectorView.memorySource(m2), S, { seed, w: 0 });
  // dicționarul pe niveluri: pentru o unitate de pe nivelul l, candidații sunt atomii care apar copii pe l.
  // (Presupune că se știe nivelul unității decodate; vezi nota din rezultat.)
  const L = S.name === 'phasor' ? 2 * D : D;
  const books = new Map();
  const bookFor = (l) => {
    if (books.has(l)) return books.get(l);
    const ids = [...m2.childFreq[l].keys()].sort((x, y) => x - y);
    const mat = new Float32Array(ids.length * L);
    ids.forEach((id, i) => mat.set(view.comp(id), i * L));
    const bk = { ids, mat };
    books.set(l, bk);
    return bk;
  };
  const best = (q, bk) => {
    let bi = -1, bs = -Infinity;
    for (let i = 0, o = 0; i < bk.ids.length; i++, o += L) {
      let t = 0;
      for (let j = 0; j < L; j++) t += q[j] * bk.mat[o + j];
      if (t > bs) { bs = t; bi = i; }
    }
    return { id: bk.ids[bi], sim: bs / Math.sqrt(q.reduce((x, y) => x + y * y, 0) || 1) };
  };
  const theta = 0.1; // sub acest prag, poziția k nu mai are copil
  const decode = (u) => {
    const vec = view.comp(u);
    const bk = bookFor(m2.level(u));
    const out = [];
    for (let k = 1; k <= cfg.K; k++) {
      const r = best(S.unembed(S.order(vec, -k)), bk);
      if (r.sim < theta) break;
      out.push(r.id);
    }
    return out;
  };
  // fiecare atom se decodează o singură dată
  const memo1 = new Map(), memoFull = new Map();
  const oneLevel = (u) => {
    if (!memo1.has(u)) {
      const got = decode(u), want = m2.children(u);
      memo1.set(u, got.length === want.length && got.every((x, i) => x === want[i]));
    }
    return memo1.get(u);
  };
  const full = (u) => {
    if (m2.isToken(u)) return true;
    if (!memoFull.has(u)) memoFull.set(u, oneLevel(u) && m2.children(u).every(full));
    return memoFull.get(u);
  };
  const book = { length: [1, 2, 3, 4, 5].reduce((t, l) => t + m2.childFreq[l].size, 0) };
  const R = rng(seed);
  const byLevel = {};
  const per = base.vecSample ?? 40;
  for (let l = 1; l <= 5; l++) {
    const units = [...m2.byLevel(l).SEQ];
    if (!units.length) continue;
    const sample = R.shuffle(units.slice()).slice(0, per);
    // un nivel de copii (decodarea directă) și refacerea completă până la tokeni
    byLevel[l] = {
      units: units.length,
      sampled: sample.length,
      oneLevel: sample.filter(oneLevel).length / sample.length,
      full: sample.filter(full).length / sample.length,
    };
  }
  let upTo = 0;
  for (let l = 1; l <= 5; l++) if (byLevel[l] && byLevel[l].full >= 0.99) upTo = l; else if (byLevel[l]) break;
  return writeResult(dir, {
    experiment: 'C2',
    question: 'Se reface textul?',
    seed,
    tokens: data.tokens,
    documents: docs.length,
    fromDefinitions: fromDefs,
    vectors: { strategy, D, tokens: small.tokens, codebook: book.length, theta, byLevel, note: 'candidații: atomii care apar copii pe nivelul unității decodate (nivelul se presupune cunoscut)' },
    decision: `din definiții: ${(fromDefs * 100).toFixed(1)}% ${fromDefs === 1 ? '(trece)' : '(PICĂ)'}; doar din vectori (${strategy}, D=${D}, dicționar ${book.length}): refacere completă ≥ 99% până la nivelul ${upTo}`,
  });
}
