// Tokenizer. Modul tokeni-cuvânt: fiecare cuvânt și fiecare semn de punctuație este un token.
// Pentru fiecare token: { text, spaceBefore, newlineBefore }. Spațiul nu face parte din text în acest mod.
// Modul GPT-2: vezi gpt2.mjs (date în data/gpt2).

import { fileURLToPath } from 'node:url';
import { loadGpt2 } from './gpt2.mjs';

const WORD = /[\p{L}\p{N}'’_-]+/uy;

export function wordTokenize(text) {
  const out = [];
  let i = 0, ws = '';
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { ws += ch; i++; continue; }
    WORD.lastIndex = i;
    const m = WORD.exec(text);
    const t = m ? m[0] : ch;
    out.push({ text: t, spaceBefore: ws.length > 0 && !ws.includes('\n'), newlineBefore: ws.includes('\n') });
    ws = '';
    i += t.length;
  }
  return out;
}

const PUNCT = /^[^\p{L}\p{N}]$/u;

// refacerea textului din tokeni-cuvânt: spațiu înaintea cuvintelor, nimic înaintea punctuației
export function wordDetokenize(texts) {
  let s = '';
  texts.forEach((t, i) => {
    if (i > 0 && !PUNCT.test(t)) s += ' ';
    s += t;
  });
  return s;
}

// date imuabile, încărcate o singură dată (cache, nu stare de model)
let gpt2Cache = null;
function gpt2() {
  gpt2Cache ??= loadGpt2(fileURLToPath(new URL('../../data/gpt2', import.meta.url)));
  return gpt2Cache;
}

export function tokenize(text, mode = 'word') {
  if (mode === 'word') return wordTokenize(text);
  if (mode === 'gpt2') return gpt2().encode(text);
  throw new Error(`modul de tokenizare ${mode} nu este implementat (pasul 7)`);
}
