import { qa } from './qa.mjs';
export function run({ seed = 1, base = {} } = {}) {
  const r = qa({ base, name: 'A5', set: 'G7', seed, question: 'Răspunde la o întrebare din faptul de alături?', threshold: 0.95, variants: [['bound', { bindSlots: true }], ['unbound', { bindSlots: false }], ['balanced', { bindSlots: true }, { allTrain: true }]] });
  const b = r.results.bound.accSleep, u = r.results.unbound.accSleep;
  r.decision = `${b > 0.95 ? 'trece' : 'pică'} cu locuri legate (${(b * 100).toFixed(1)}%); fără locuri legate ${(u * 100).toFixed(1)}%${u > 0.95 ? ' (nu pică: locurile legate nu sunt necesare)' : ' (pică, cum era de așteptat)'}; cu date echilibrate ${(r.results.balanced.accSleep * 100).toFixed(1)}%`;
  return r;
}
