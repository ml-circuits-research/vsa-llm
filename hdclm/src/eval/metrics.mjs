// Măsurători: eroarea de predicție, refacerea, totalul.
import { Predictor, EOT } from '../predict/distribution.mjs';
import { tokenize } from '../text/tokenizer.mjs';
import { total, stats } from '../memory/size.mjs';
import { fail } from '../core/invariants.mjs';

// eroarea de predicție: media lui -log2 P(tokenul corect), pe tokenii documentelor (plus sfârșitul textului)
export function predError(mem, cfg, docs) {
  const pred = new Predictor(mem, cfg);
  let bits = 0, n = 0;
  for (const d of docs) {
    const toks = tokenize(d.text, 'word');
    for (let i = 0; i <= toks.length; i++) {
      const dist = pred.nextToken(toks.slice(0, i));
      const p = pred.prob(dist, i < toks.length ? toks[i].text : EOT);
      bits += -Math.log2(p);
      n++;
    }
  }
  return n ? bits / n : 0;
}

// I11: niciun document de validare sau de test nu a intrat în memorie
export function checkSplit(mem, split) {
  const read = new Set(mem.docsRead);
  for (const d of [...split.val, ...split.test]) if (read.has(d.id)) fail('I11', `documentul ${d.id} a intrat în memorie`);
  return true;
}

export function reconstruction(mem, roots) {
  let ok = 0;
  for (const { id, tokens } of roots) {
    const u = mem.unfold(id, { fresh: true });
    if (u.length === tokens.length && u.every((x, i) => x === tokens[i])) ok++;
  }
  return roots.length ? ok / roots.length : 1;
}

// răspunsul la o întrebare: tokenul cel mai probabil după meta.prompt este meta.answer?
export function answerAccuracy(mem, cfg, docs) {
  const pred = new Predictor(mem, cfg);
  const rows = docs.map((d) => {
    const dist = pred.nextFromText(d.meta.prompt);
    let best = null, bp = -1;
    for (const [k, p] of dist) if (p > bp + 1e-12 || (Math.abs(p - bp) <= 1e-12 && String(k) < String(best))) [best, bp] = [k, p];
    return { id: d.id, answer: d.meta.answer, top: pred.tokenText(best), p: pred.prob(dist, d.meta.answer), ok: pred.tokenText(best) === d.meta.answer, meta: d.meta };
  });
  return { acc: rows.length ? rows.filter((r) => r.ok).length / rows.length : 0, n: rows.length, rows };
}

export function describe(mem) {
  const show = (id) => {
    const a = mem.atoms[id];
    if (a.kind === 'TOKEN') return a.text;
    if (a.kind === 'STRUCT') return `S${id}`;
    return `N${id}`;
  };
  const patterns = mem.allOfType('PATTERN').filter((p) => mem.isLive(p)).map((p) => {
    const d = mem.atoms[p].def;
    const items = d.items.map((it) => (it.fixed !== undefined ? show(it.fixed) : it.slot !== undefined ? `S${it.slot}` : `N${it.sub}(${it.args.map((s) => `S${s}`).join(',')})`));
    return { id: p, level: mem.atoms[p].level, text: `[${items.join(', ')}]`, slots: d.slots.map((s) => ({ slot: s, accepts: mem.atoms[s].accepts })), usage: mem.usage(p) };
  });
  const choices = mem.allOfType('CHOICE').filter((c) => mem.isLive(c)).map((c) => ({ id: c, level: mem.atoms[c].level, members: [...mem.atoms[c].def.members.keys()].map((m) => (mem.isToken(m) ? mem.atoms[m].text : `N${m}:"${mem.text(m)}"`)) }));
  return { patterns, choices };
}

export { total, stats };
