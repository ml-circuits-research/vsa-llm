// Set de control G11, proiectat orb (fără acces la mecanism) și rulat o singură dată, fără reparații înainte.
import { qa } from './qa.mjs';
export function run({ seed = 1, base = {} } = {}) {
  const r = qa({ base, name: 'G11', set: 'G11', seed, question: 'Control orb: fapte tranzitive, întrebare despre subiect sau obiect, cu forma verbului schimbată', threshold: 0.9, groupBy: 'ask', variants: [['default', {}]] });
  const v = r.results.default;
  r.decision = `${v.accSleep > 0.9 ? 'trece' : 'pică'} (${(v.accSleep * 100).toFixed(1)}%; fără somn ${(v.accNoSleep * 100).toFixed(1)}%; pe tip de întrebare: ${Object.entries(v.byGroup).map(([k, g]) => `${k === '0' ? 'ce' : 'cine'} ${(g.acc * 100).toFixed(0)}%`).join(', ')})`;
  return r;
}
