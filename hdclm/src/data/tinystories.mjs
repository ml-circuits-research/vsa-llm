// TinyStories: povești despărțite prin <|endoftext|>. Se iau primele povești până la N tokeni
// (în ordinea din fișier, deterministă) și se împart pe documente 80/10/10 cu sămânța.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize } from '../text/tokenizer.mjs';
import { rng } from '../core/rng.mjs';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '../../data/tinystories/TinyStories-valid.txt');

export function loadStories(file = FILE) {
  if (!existsSync(file)) throw new Error(`lipsește ${file}: vezi data/tinystories/README.md`);
  return readFileSync(file, 'utf8')
    .split('<|endoftext|>')
    .map((s) => s.trim())
    .filter(Boolean);
}

// primele povești până la cel puțin nTokens tokeni (GPT-2)
export function tinySet(nTokens, { seed = 1, mode = 'gpt2' } = {}) {
  const stories = loadStories();
  const docs = [];
  let n = 0;
  for (let i = 0; i < stories.length && n < nTokens; i++) {
    const t = tokenize(stories[i], mode).length;
    docs.push({ id: `TS-${i}`, text: stories[i], heldout: false, meta: { tokens: t } });
    n += t;
  }
  const R = rng(seed);
  const idx = R.shuffle(docs.map((_, i) => i));
  const nv = Math.floor(docs.length / 10);
  const val = new Set(idx.slice(0, nv)), test = new Set(idx.slice(nv, 2 * nv));
  return {
    tokens: n,
    train: docs.filter((_, i) => !val.has(i) && !test.has(i)),
    val: docs.filter((_, i) => val.has(i)),
    test: docs.filter((_, i) => test.has(i)),
  };
}
