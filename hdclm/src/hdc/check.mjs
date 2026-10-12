// Verificarea proprietăților H1–H8 ale unei strategii HDC (tabelul din secțiunea 7).
// Pentru fiecare proprietate: worst = cea mai mare abatere văzută, mean = media abaterilor;
// trece dacă worst < limita proprietății (t = 5/sqrt(D), sau 1e-4 la H2, 0.6 la structura din H8).
import { rng } from '../core/rng.mjs';

export function checkStrategy(S, { trials = 10000, seed = 1 } = {}) {
  const D = S.D, t = 5 / Math.sqrt(D);
  const R = rng(seed);
  const atom = () => S.newAtom(R);
  const sim = (a, b) => S.similarity(a, b);
  const sum = (vs) => S.normalize(S.bundle(vs));
  const acc = {};
  const lim = { H1: t, H2: 1e-4, H3: t, H4: t, H5: t, H6: t, H7: t, H8: t };
  const hit = (k, m) => {
    const a = (acc[k] ??= { worst: 0, sum: 0, n: 0 });
    if (m > a.worst) a.worst = m;
    a.sum += m; a.n++;
  };
  const maxErr = (a, b) => {
    let m = 0;
    for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
    return m;
  };
  // pozițiile 1-based; comp(copil) = normalize(Σ_k ρ^k ν(atom_k))
  const comp = (children) => sum(children.map((c, i) => S.order(S.embed(c), i + 1)));

  // H8 (structurile) e scump: se rulează pe trials/10 (cel puțin 1)
  const structEvery = 10;
  for (let n = 0; n < trials; n++) {
    const a = atom(), b = atom(), k = atom(), x = atom();
    // H1
    hit('H1', Math.abs(sim(a, b)));
    // H2 (pe vectori normalizați)
    const vn = S.normalize(b);
    hit('H2', maxErr(S.unbind(k, S.bind(k, vn)), vn));
    // H3
    const kb = S.bind(k, b);
    hit('H3', Math.max(Math.abs(sim(kb, k)), Math.abs(sim(kb, b))));
    // H4
    const c = sum([a, x]);
    hit('H4', Math.abs(sim(S.bind(k, a), S.bind(k, c)) - sim(a, c)));
    // H5
    const c3 = S.bundle([a, b, x]);
    hit('H5', Math.max(...[a, b, x].map((u) => Math.abs(sim(c3, u) - 0.577))));
    // H6
    const w = S.bundle([a, b], [1, 0.9]);
    hit('H6', Math.max(Math.abs(sim(w, b) - 0.669), Math.abs(sim(S.normalize(w), b) - 0.669)));
    // H7
    const oa = S.order(a, 1), ob = S.order(c, 1);
    hit('H7', Math.max(Math.abs(sim(oa, a)), Math.abs(sim(oa, ob) - sim(a, c)), maxErr(S.order(oa, -1), a),
      maxErr(S.unembed(S.embed(a)), a)));
    // H8: embed separă nivelurile
    const h8 = Math.abs(sim(S.embed(oa), S.order(S.embed(a), 1)));
    hit('H8', h8);
    if (n % structEvery === 0) {
      const [p, q, r, s] = [a, b, x, atom()];
      const s1 = comp([comp([p, q]), comp([r, s])]);
      const s2 = comp([comp([p, r]), comp([q, s])]);
      hit('H8s', sim(s1, s2));
    }
  }
  const props = {};
  for (const h of Object.keys(lim)) {
    let a = acc[h];
    let worst = a.worst, mean = a.sum / a.n, pass = worst < lim[h];
    if (h === 'H8') {
      const s = acc.H8s; // structura: similaritate < 0.6
      pass = pass && s.worst < 0.6;
      props[h] = { pass, worst, mean, struct: { worst: s.worst, mean: s.sum / s.n, limit: 0.6 }, limit: lim[h] };
    } else props[h] = { pass, worst, mean, limit: lim[h] };
  }
  return { name: S.name, D, t, props, pass: Object.values(props).every((p) => p.pass) };
}
