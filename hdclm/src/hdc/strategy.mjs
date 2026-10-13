// Interfața strategiilor HDC (secțiunea 7). Vectorii sunt Float32Array.
//   name, D
//   newAtom(R)            atom aleator (R = rng cu sămânță)
//   bind(k, v) / unbind(k, b)   inverse exacte (până la eroarea float)
//   bundle(vs, ws)        sumă ponderată, NEROTUNJITĂ (excepție: binary, majoritate)
//   order(v, k)           ρ aplicat de k ori (k<0: inversa); embed(v)=ν, unembed(v)=ν⁻¹
//   normalize(v)          lungime 1, ponderile relative păstrate
//   similarity(a, b)      cosinus în [-1, 1] (fazori: Re<a,b̄>/D)
//   nearest(q, cands, n)  cands = [{id, v}] -> primii n [{id, sim}], sim desc apoi id
import { bipolar } from './bipolar.mjs';
import { phasor } from './phasor.mjs';
import { binary } from './binary.mjs';

const FACTORY = { bipolar, phasor, binary };
export const STRATEGIES = Object.keys(FACTORY);

export function makeStrategy(name, { D, seed = 1 }) {
  const f = FACTORY[name];
  if (!f) throw new Error(`strategie necunoscută: ${name}`);
  return f(D, seed);
}
