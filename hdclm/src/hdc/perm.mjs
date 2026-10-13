// Părți comune strategiilor HDC: permutările ρ și ν, normalizare, căutare.
// w = numărul de floaturi pe poziție (1 real, 2 pentru fazori re/im).
import { rng, byScoreThenId } from '../core/rng.mjs';

// permutare aleatoare a lui 0..D-1 (Fisher–Yates cu rng-ul cu sămânță)
export function randPerm(D, seed) {
  const R = rng(seed);
  const p = new Uint32Array(D);
  for (let i = 0; i < D; i++) p[i] = i;
  for (let i = D - 1; i > 0; i--) {
    const j = R.int(i + 1);
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  return p;
}

export function invPerm(p) {
  const q = new Uint32Array(p.length);
  for (let i = 0; i < p.length; i++) q[p[i]] = i;
  return q;
}

// out[i] = v[p[i]]
export function applyPerm(v, p, w) {
  const out = new Float32Array(v.length);
  if (w === 1) for (let i = 0; i < p.length; i++) out[i] = v[p[i]];
  else for (let i = 0; i < p.length; i++) { out[2 * i] = v[2 * p[i]]; out[2 * i + 1] = v[2 * p[i] + 1]; }
  return out;
}

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// bază comună: ρ, ν, normalize, similarity (cosinus), nearest, bundle liniar
export function baseStrategy(name, D, seed, w = 1) {
  const rho = randPerm(D, (seed + 0x1001) >>> 0), rhoInv = invPerm(rho);
  const nu = randPerm(D, (seed + 0x2002) >>> 0), nuInv = invPerm(nu);
  const s = {
    name, D,
    bundle(vectors, weights) {
      const out = new Float32Array(vectors[0].length);
      for (let j = 0; j < vectors.length; j++) {
        const v = vectors[j], c = weights ? weights[j] : 1;
        for (let i = 0; i < out.length; i++) out[i] += c * v[i];
      }
      return out;
    },
    order(v, k) {
      const p = k >= 0 ? rho : rhoInv;
      for (let i = Math.abs(k); i > 0; i--) v = applyPerm(v, p, w);
      return k === 0 ? Float32Array.from(v) : v;
    },
    embed: (v) => applyPerm(v, nu, w),
    unembed: (v) => applyPerm(v, nuInv, w),
    normalize(v) {
      const n = Math.sqrt(dot(v, v));
      const out = new Float32Array(v.length);
      if (n > 0) for (let i = 0; i < out.length; i++) out[i] = v[i] / n;
      return out;
    },
    similarity(a, b) {
      const d = Math.sqrt(dot(a, a) * dot(b, b));
      return d > 0 ? dot(a, b) / d : 0;
    },
    nearest(query, candidates, n) {
      return candidates
        .map((c) => ({ id: c.id, score: s.similarity(query, c.v) }))
        .sort(byScoreThenId)
        .slice(0, n)
        .map((c) => ({ id: c.id, sim: c.score }));
    },
  };
  return s;
}
