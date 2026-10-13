// Generarea: predicția repetată, token cu token.
import { Predictor, argmax, EOT } from './distribution.mjs';
import { tokenize, wordDetokenize } from '../text/tokenizer.mjs';
import { segmentPrefix } from '../text/boundaries.mjs';

const PUNCT = /^[^\p{L}\p{N}]$/u;

export function generate(mem, cfg, text, { stopLevel = 3, maxTokens = 50, sample = false, rand = null } = {}) {
  const pred = new Predictor(mem, cfg);
  const tokens = tokenize(text, mem.tokenMode ?? 'word');
  const out = [];
  const closedAbove = (toks) => {
    const st = segmentPrefix(toks.map((t) => ({ ...t, ref: t.text })));
    return st.filter((e) => e.level > stopLevel).reduce((s, e) => s + e.items.length, 0);
  };
  const start = closedAbove(tokens);
  for (let n = 0; n < maxTokens; n++) {
    const d = pred.nextToken(tokens);
    let t;
    if (sample) {
      let r = rand(), acc = 0;
      for (const [k, p] of [...d].sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1))) {
        acc += p;
        t = k;
        if (r <= acc) break;
      }
    } else t = argmax(d);
    if (t === EOT) break;
    const txt = pred.tokenText(t);
    tokens.push({ text: txt, spaceBefore: !PUNCT.test(txt), newlineBefore: false });
    out.push(txt);
    if (closedAbove(tokens) > start) break;
  }
  return { tokens: out, text: wordDetokenize(out) };
}
