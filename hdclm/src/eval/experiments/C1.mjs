// C1: cât de des depășește o unitate K copii? (pe text adevărat, fără învățare)
import { runDir, writeResult } from '../run.mjs';
import { loadConfig } from '../../core/config.mjs';
import { tinySet } from '../../data/tinystories.mjs';
import { tokenize } from '../../text/tokenizer.mjs';
import { segment } from '../../text/boundaries.mjs';

// numărul de copii al fiecărui nod, după regula „un singur copil fără închizător -> copilul”
function countNodes(node, out) {
  if (node.tok !== undefined) return;
  for (const c of node.children) countNodes(c, out);
  if (node.children.length === 1 && !node.closer) return;
  (out[node.level] ??= []).push(node.children.length);
}

export function run({ seed = 1, base = {} } = {}) {
  const cfg = loadConfig(base);
  const dir = runDir('C1');
  const N = base.tokens ?? 100000;
  const data = tinySet(N, { seed });
  const counts = {};
  for (const d of [...data.train, ...data.val, ...data.test]) countNodes(segment(tokenize(d.text, 'gpt2').map((t, i) => ({ ...t, ref: i }))), counts);
  const names = { 1: 'cuvânt', 2: 'parte de propoziție', 3: 'propoziție', 4: 'paragraf', 5: 'document' };
  const levels = {};
  for (const [l, arr] of Object.entries(counts)) {
    arr.sort((a, b) => a - b);
    const over = arr.filter((x) => x > cfg.K).length;
    levels[l] = { name: names[l], units: arr.length, overK: over, overPct: (100 * over) / arr.length, p50: arr[arr.length >> 1], p95: arr[Math.floor(arr.length * 0.95)], max: arr.at(-1) };
  }
  const worst = Object.values(levels).filter((x) => x.name !== 'document').reduce((a, b) => (b.overPct > a.overPct ? b : a));
  return writeResult(dir, {
    experiment: 'C1',
    question: 'Cât de des depășește o unitate K copii?',
    seed,
    K: cfg.K,
    tokens: data.tokens,
    documents: data.train.length + data.val.length + data.test.length,
    levels,
    decision: Object.values(levels).every((x) => x.name === 'document' || x.overPct < 5)
      ? `sub 5% depășiri pe fiecare nivel (cel mai rău: ${worst.name}, ${worst.overPct.toFixed(1)}%): împărțirea după mărime rămâne`
      : `peste 5% pe nivelul ${worst.name} (${worst.overPct.toFixed(1)}%): în D1 se compară cu tăierea la marginea celui mai lung tipar`,
  });
}
