// C3: câte granițe de propoziție sunt înșelătoare? Cu și fără regula de formă.
// Verificarea „de mână” nu se poate face aici: se scrie un eșantion de 500 de granițe cu context
// (runs/C3/granite.tsv), de verificat de un om. Automat se numără doar cazurile care se pot
// recunoaște după formă (semnul este urmat lipit de ghilimele, de o cifră sau de o literă).
// Cunoașterea folosită aici (ghilimele, abrevieri) ține numai de măsurare, nu intră în sistem.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runDir, writeResult } from '../run.mjs';
import { tinySet } from '../../data/tinystories.mjs';
import { tokenize } from '../../text/tokenizer.mjs';
import { SENTENCE_END } from '../../text/boundaries.mjs';
import { rng } from '../../core/rng.mjs';

const ABBR = new Set(['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Mt', 'vs', 'etc', 'e.g', 'i.e']);

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('C3');
  const data = tinySet(base.tokens ?? 100000, { seed });
  const rows = [];
  const cls = { closes: 0, quoteAfter: 0, digitOrLetterAfter: 0, otherNoSpace: 0, abbrevBefore: 0, endOfText: 0 };
  for (const d of [...data.train, ...data.val, ...data.test]) {
    const toks = tokenize(d.text, 'gpt2');
    toks.forEach((t, i) => {
      if (!SENTENCE_END.has(t.text.trim()) || t.text.trim() !== t.text) return;
      const next = toks[i + 1];
      const prev = toks[i - 1];
      let kind;
      if (!next) kind = 'endOfText';
      else if (next.spaceBefore || next.newlineBefore) kind = 'closes';
      else if (/^["'”’)]/.test(next.text)) kind = 'quoteAfter';
      else if (/^[\p{L}\p{N}]/u.test(next.text)) kind = 'digitOrLetterAfter';
      else kind = 'otherNoSpace';
      cls[kind]++;
      if (kind === 'closes' && prev && ABBR.has(prev.text.trim())) cls.abbrevBefore++;
      const ctx = toks.slice(Math.max(0, i - 6), i + 4).map((x) => x.text).join('').replace(/\s+/g, ' ');
      rows.push({ doc: d.id, pos: i, kind, rule: kind === 'closes' || kind === 'endOfText' ? 'închide' : 'nu închide', ctx });
    });
  }
  const R = rng(seed);
  const sample = R.shuffle(rows.slice()).slice(0, 500).sort((a, b) => (a.doc < b.doc ? -1 : a.doc > b.doc ? 1 : a.pos - b.pos));
  writeFileSync(join(dir, 'granite.tsv'), 'doc\tpoz\tregula\tfel\tcontext\tcorect(da/nu)\n' + sample.map((r) => `${r.doc}\t${r.pos}\t${r.rule}\t${r.kind}\t${r.ctx}\t`).join('\n') + '\n');
  const total = rows.length;
  // fără regula de formă, orice [.!?] închide: greșite sunt cele lipite de o cifră/literă (3.14, a.b)
  // cu regula: greșite sunt (probabil) cele urmate lipit de ghilimele, plus abrevierile
  const withRule = cls.quoteAfter + cls.abbrevBefore;
  const withoutRule = cls.digitOrLetterAfter + cls.abbrevBefore;
  return writeResult(dir, {
    experiment: 'C3',
    question: 'Câte granițe sunt înșelătoare?',
    seed,
    tokens: data.tokens,
    boundaries: total,
    classes: cls,
    estimatedWrong: { withRule, withRulePct: (100 * withRule) / total, withoutRule, withoutRulePct: (100 * withoutRule) / total },
    note: 'estimare automată după formă; verificarea de mână a celor 500 de granițe din granite.tsv nu este făcută',
    decision: `${((100 * withRule) / total).toFixed(1)}% granițe probabil greșite cu regula de formă (fără ea: ${((100 * withoutRule) / total).toFixed(1)}%): ${(100 * withRule) / total < 1 ? 'regula ajunge' : 'trebuie reguli de formă în plus'} — de confirmat de mână pe granite.tsv`,
  });
}
