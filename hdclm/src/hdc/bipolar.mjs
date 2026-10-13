// Strategia bipolară: atomi ±1, legare = produs pe componente.
import { baseStrategy } from './perm.mjs';

export function bipolar(D, seed = 1) {
  const s = baseStrategy('bipolar', D, seed, 1);
  const mul = (a, b) => {
    const o = new Float32Array(D);
    for (let i = 0; i < D; i++) o[i] = a[i] * b[i];
    return o;
  };
  s.newAtom = (R) => {
    const v = new Float32Array(D);
    for (let i = 0; i < D; i++) v[i] = R() < 0.5 ? -1 : 1;
    return v;
  };
  s.bind = mul;
  s.unbind = mul; // ±1 este propriul invers
  return s;
}
