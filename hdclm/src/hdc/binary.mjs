// Binar dens: atomi {0,1}, legare = XOR, grupare = majoritate (rotunjește, prin construcție).
import { rng } from '../core/rng.mjs';
import { baseStrategy } from './perm.mjs';

export function binary(D, seed = 1) {
  const s = baseStrategy('binary', D, seed, 1);
  // vector fix cu sămânță pentru egalități la majoritate
  const T = rng((seed + 0x3003) >>> 0);
  const tie = new Float32Array(D);
  for (let i = 0; i < D; i++) tie[i] = T() < 0.5 ? 0 : 1;
  const xor = (a, b) => {
    const o = new Float32Array(D);
    for (let i = 0; i < D; i++) o[i] = a[i] !== b[i] ? 1 : 0;
    return o;
  };
  s.newAtom = (R) => {
    const v = new Float32Array(D);
    for (let i = 0; i < D; i++) v[i] = R() < 0.5 ? 0 : 1;
    return v;
  };
  s.bind = xor;
  s.unbind = xor;
  s.bundle = (vectors, weights) => {
    const acc = new Float64Array(D);
    vectors.forEach((v, j) => {
      const c = weights ? weights[j] : 1;
      for (let i = 0; i < D; i++) acc[i] += c * (v[i] ? 1 : -1);
    });
    const o = new Float32Array(D);
    for (let i = 0; i < D; i++) o[i] = Math.abs(acc[i]) < 1e-9 ? tie[i] : acc[i] > 0 ? 1 : 0;
    return o;
  };
  s.normalize = (v) => Float32Array.from(v);
  s.similarity = (a, b) => {
    let h = 0;
    for (let i = 0; i < D; i++) if (a[i] !== b[i]) h++;
    return 1 - (2 * h) / D;
  };
  return s;
}
