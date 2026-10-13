import { qa } from './qa.mjs';
export function run({ seed = 1, base = {} } = {}) {
  const r = qa({ base, name: 'A7', set: 'G9', seed, question: 'Găsește faptul util printre altele?', threshold: 0.9, groupBy: 'distractors', variants: [['default', {}]] });
  const bg = r.results.default.byGroup;
  let upTo = 0;
  for (let k = 1; k <= 5; k++) if (bg[k] && bg[k].acc > 0.9) upTo = k; else break;
  r.decision = upTo ? `peste 90% până la ${upTo} propoziții între fapt și întrebare` : 'pică de la prima propoziție: sistemul leagă doar propoziții alăturate';
  return r;
}
