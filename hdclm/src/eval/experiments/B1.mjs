// B1: cât de bine respectă fiecare strategie HDC proprietățile H1–H8 (secțiunea 7).
import { makeStrategy } from '../../hdc/strategy.mjs';
import { checkStrategy } from '../../hdc/check.mjs';
import { runDir, writeResult } from '../run.mjs';

const NAMES = ['bipolar', 'phasor', 'binary'];
const DIMS = [1024, 4096, 16384]; // D=65536 omis pentru timp

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('B1');
  const results = [];
  for (const name of NAMES) {
    for (const D of DIMS) {
      const t0 = performance.now();
      const r = checkStrategy(makeStrategy(name, { D, seed }), { trials: D <= 4096 ? 10000 : 2000, seed });
      results.push({ ...r, trials: D <= 4096 ? 10000 : 2000, seconds: +((performance.now() - t0) / 1000).toFixed(1) });
    }
  }
  const ok = [], bad = [];
  for (const name of NAMES) {
    const rs = results.filter((r) => r.name === name);
    if (rs.every((r) => r.pass)) ok.push(name);
    else {
      const dev = [...new Set(rs.flatMap((r) => Object.entries(r.props).filter(([, p]) => !p.pass).map(([h]) => h)))];
      bad.push(`${name} (pică ${dev.join(',')})`);
    }
  }
  const decision = `trec H1–H8 la orice D: ${ok.join(', ') || 'niciuna'}; strategia care încalcă o proprietate iese: ${bad.join('; ') || 'niciuna'}. D=65536 omis.`;
  return writeResult(dir, {
    experiment: 'B1', question: 'Cât de bine respectă strategia proprietățile H1–H8?',
    seed, note: 'D=65536 omis pentru timp', results, decision,
  });
}
