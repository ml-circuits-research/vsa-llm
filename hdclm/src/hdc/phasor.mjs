// Fazori (FHRR): D fazori unitari, stocați re/im alternat (lungime 2D).
import { baseStrategy } from './perm.mjs';

export function phasor(D, seed = 1) {
  const s = baseStrategy('phasor', D, seed, 2);
  // (a · b) sau (a · conj b) pe componente complexe
  const cmul = (a, b, conj) => {
    const o = new Float32Array(2 * D), sg = conj ? -1 : 1;
    for (let i = 0; i < D; i++) {
      const ar = a[2 * i], ai = a[2 * i + 1], br = b[2 * i], bi = sg * b[2 * i + 1];
      o[2 * i] = ar * br - ai * bi;
      o[2 * i + 1] = ar * bi + ai * br;
    }
    return o;
  };
  s.newAtom = (R) => {
    const v = new Float32Array(2 * D);
    for (let i = 0; i < D; i++) {
      const th = R() * 2 * Math.PI;
      v[2 * i] = Math.cos(th);
      v[2 * i + 1] = Math.sin(th);
    }
    return v;
  };
  s.bind = (k, v) => cmul(k, v, false);
  s.unbind = (k, b) => cmul(b, k, true); // înmulțire cu conjugata cheii
  // Re(Σ a·conj b)/(|a||b|) = produsul scalar real pe floaturile re/im (moștenit)
  return s;
}
