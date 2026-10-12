// Tokenizerul GPT-2: BPE la nivel de octet, reguli citite din vocab.json și merges.txt.
// Spațiul rămâne lipit de tokenul care urmează (ex. " cat").
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRE = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
const WS_ONLY = /^\s+$/u;

// octet -> caracter vizibil (tabela standard GPT-2)
function bytesToUnicode() {
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n++); }
  const enc = new Array(256);
  const dec = new Map();
  bs.forEach((b, i) => { enc[b] = String.fromCharCode(cs[i]); dec.set(enc[b], b); });
  return { enc, dec };
}

export function loadGpt2(dir) {
  const vocab = JSON.parse(readFileSync(join(dir, 'vocab.json'), 'utf8'));
  const lines = readFileSync(join(dir, 'merges.txt'), 'utf8').split('\n');
  const rank = new Map();
  let r = 0;
  for (const ln of lines) {
    if (!ln || ln.startsWith('#version')) continue;
    rank.set(ln, r++);
  }
  const { enc: B2U, dec: U2B } = bytesToUnicode();
  const idTok = [];
  for (const [k, v] of Object.entries(vocab)) idTok[v] = k;
  const utf8 = new TextEncoder();
  const cache = new Map();

  // pre-token -> lista de id-uri
  function bpe(piece) {
    const hit = cache.get(piece);
    if (hit) return hit;
    let sym = Array.from(utf8.encode(piece), (b) => B2U[b]);
    while (sym.length > 1) {
      let best = Infinity, at = -1;
      for (let i = 0; i < sym.length - 1; i++) {
        const k = rank.get(sym[i] + ' ' + sym[i + 1]);
        if (k !== undefined && k < best) { best = k; at = i; }
      }
      if (at < 0) break;
      const a = sym[at], b = sym[at + 1], out = [];
      for (let i = 0; i < sym.length; i++) {
        if (i < sym.length - 1 && sym[i] === a && sym[i + 1] === b) { out.push(a + b); i++; } else out.push(sym[i]);
      }
      sym = out;
    }
    const ids = sym.map((s) => vocab[s]);
    cache.set(piece, ids);
    return ids;
  }

  const tokBytes = (id) => Uint8Array.from(Array.from(idTok[id], (c) => U2B.get(c)));

  function encode(text) {
    const out = [];
    let prevWs = null; // ultimul token, dacă este doar spațiu alb
    for (const m of text.matchAll(PRE)) {
      const piece = m[0];
      const ws = WS_ONLY.test(piece);
      const dec = new TextDecoder('utf-8', { fatal: false });
      const ids = bpe(piece);
      let last = null;
      ids.forEach((id, j) => {
        // decodare în flux: octeții unui caracter împărțit între tokeni ajung la ultimul
        const t = dec.decode(tokBytes(id), { stream: j < ids.length - 1 });
        let spaceBefore = t.startsWith(' ');
        let newlineBefore = t.includes('\n');
        if (ws && !newlineBefore) spaceBefore = true;
        if (!ws && j === 0 && prevWs) {
          if (prevWs.text.includes('\n')) newlineBefore = true;
          else if (prevWs.text.includes(' ')) spaceBefore = true;
        }
        last = { id, text: t, spaceBefore, newlineBefore };
        out.push(last);
      });
      prevWs = ws ? last : null;
    }
    return out;
  }

  function decode(ids) {
    const parts = ids.map(tokBytes);
    let n = 0;
    for (const p of parts) n += p.length;
    const buf = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { buf.set(p, o); o += p.length; }
    return new TextDecoder().decode(buf);
  }

  return { encode, decode };
}
