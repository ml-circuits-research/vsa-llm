// Set de control G10 (nefolosit la proiectare): apare o regulă generală și pe altă structură?
import { qa } from './qa.mjs';
export function run({ seed = 1, base = {} } = {}) {
  const r = qa({ base, name: 'G10', set: 'G10', seed, question: 'Generalizează mecanismul pe o structură nouă (două fapte, întrebare despre unul)?', threshold: 0.9, groupBy: 'ask', variants: [['default', {}], ['terms', { measure: 'terms' }]] });
  const a = r.results.default.accSleep;
  r.decision = `${a > 0.9 ? 'trece' : 'pică'} (${(a * 100).toFixed(1)}%; fără somn ${(r.results.default.accNoSleep * 100).toFixed(1)}%; în termeni ${(r.results.terms.accSleep * 100).toFixed(1)}%)`;
  return r;
}
