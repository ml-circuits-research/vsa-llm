import { qa } from './qa.mjs';
export function run({ seed = 1, base = {} } = {}) {
  const r = qa({ base, name: 'A6', set: 'G8', seed, question: 'Combină două fapte?', threshold: 0.9, variants: [['default', {}], ['f_max3', { f_max: 3 }], ['balanced', {}, { allTrain: true }]] });
  const a = r.results.default.accSleep;
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  r.decision = `${a > 0.9 ? 'trece' : 'pică'} (${pct(a)}); f_max=3: ${pct(r.results.f_max3.accSleep)}; date echilibrate: ${pct(r.results.balanced.accSleep)}`;
  return r;
}
