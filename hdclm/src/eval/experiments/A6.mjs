import { qa } from './qa.mjs';
export function run({ seed = 1 } = {}) {
  const r = qa({ name: 'A6', set: 'G8', seed, question: 'Combină două fapte?', threshold: 0.9, variants: [['default', {}], ['f_max3', { f_max: 3 }]] });
  const a = r.results.default.accSleep;
  r.decision = a > 0.9 ? `trece (${(a * 100).toFixed(1)}%)` : `pică (${(a * 100).toFixed(1)}%): sistemul face un pas de judecată, dar nu doi`;
  return r;
}
