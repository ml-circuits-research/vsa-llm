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
  // dicționarul de vectori: atomii care apar copii (tokeni și unități)
  const book = [];
  for (let id = 1; id < m2.atoms.length; id++) if (m2.isToken(id) || m2.isUnit(id)) book.push({ id, v: view.comp(id) });
  const theta = 0.1; // sub acest prag, poziția k nu mai are copil
  const decode = (vec) => {
    const out = [];
    for (let k = 1; k <= cfg.K; k++) {
      const q = S.unembed(S.order(vec, -k));
      const [best] = S.nearest(q, book, 1);
      if (!best || best.sim < theta) break;
      out.push(best.id);
    }
    return out;
  };
  const exact = (id, depth) => {
    if (m2.isToken(id)) return true;
    const got = decode(view.comp(id));
    const want = m2.children(id);
    if (got.length !== want.length || !got.every((x, i) => x === want[i])) return false;
    return depth <= 1 || want.every((c) => exact(c, depth - 1));
  };
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
      oneLevel: sample.filter((u) => exact(u, 1)).length / sample.length,
      full: sample.filter((u) => exact(u, 9)).length / sample.length,
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
    vectors: { strategy, D, tokens: small.tokens, codebook: book.length, theta, byLevel },
    decision: `din definiții: ${(fromDefs * 100).toFixed(1)}% ${fromDefs === 1 ? '(trece)' : '(PICĂ)'}; doar din vectori (${strategy}, D=${D}, dicționar ${book.length}): refacere completă ≥ 99% până la nivelul ${upTo}`,
  });
}
