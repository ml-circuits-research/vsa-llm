// Judecata unică a generalizărilor (D20). Orice schimbare care lărgește ce acceptă memoria (un loc tipizat,
// o formă adăugată unei clase, o ipoteză de concept folosită) se judecă la fel:
//   1. lungimea memoriei (MDL), măsurată exact, pe o copie;
//   2. contraexemplele: unitățile văzute pe care schimbarea le „revendică” nou (un tipar atins se potrivește
//      acum pe un prefix mai lung al lor). Biții lor de predicție se măsoară înainte și după; în biți, creșterea
//      lor se scade din câștigul memoriei (descrierea totală: memoria + predicția datelor revendicate);
//   3. dacă există textul de validare (opts.validate), eroarea lui nu are voie să crească.
// Schimbarea trece numai dacă descrierea totală scade și validarea nu se strică. Nu există praguri.
import { total } from '../memory/size.mjs';
import { Predictor } from '../predict/distribution.mjs';
import { matchPattern } from '../memory/match.mjs';

const EPS = 1e-9;

function claim(pred, P, ch) {
  for (let k = ch.length; k > 0; k--) if (matchPattern(pred.env, P, ch.slice(0, k), { partial: true })) return k;
  return 0;
}

// biții de predicție ai unităților, de la primul copil revendicat nou (înainte, potrivirea e aceeași)
function bitsOf(pred, mem, units, fromChild) {
  let b = 0;
  for (const u of units) {
    const toks = mem.unfold(u).map((t) => ({ text: mem.atoms[t].text, spaceBefore: true, newlineBefore: false }));
    const from = mem.children(u).slice(0, fromChild.get(u) ?? 0).reduce((s, c) => s + mem.unfold(c).length, 0);
    for (const p of pred.docProbs(toks, { from })) b += -Math.log2(p);
  }
  return b;
}

// unitățile văzute revendicate nou de tiparele `patterns` (din memoria veche), în copia k
export function newlyClaimed(mem, k, cfg, patterns) {
  const po = new Predictor(mem, cfg), pn = new Predictor(k, cfg);
  const claimed = new Map(); // unitate -> primul copil revendicat nou
  for (const P of patterns) {
    if (!mem.atoms[P] || mem.atoms[P].def?.type !== 'PATTERN') continue;
    const bl = mem.byLevel(mem.atoms[P].level);
    for (const u of [...bl.SEQ, ...bl.APP]) {
      const d = mem.atoms[u].def;
      if (d.type === 'APP' && d.pattern === P) continue;
      const ch = mem.children(u);
      const kOld = claim(po, P, ch);
      if (claim(pn, P, ch) > kOld) claimed.set(u, Math.min(kOld, claimed.get(u) ?? Infinity));
    }
  }
  return { units: [...claimed.keys()].sort((a, b) => a - b), fromChild: claimed, po, pn };
}

// mem: memoria de acum; k: copia cu schimbarea aplicată; patterns: tiparele a căror potrivire o schimbă
export function judgeGeneralization(mem, k, cfg, { patterns = [], validate, before = total(mem, cfg.measure ?? 'terms') } = {}) {
  const gain = before - total(k, cfg.measure ?? 'terms');
  const out = { gain, claimed: 0, predDelta: 0, valDelta: 0, accept: false };
  if (!(gain > EPS)) return out;
  const { units, fromChild, po, pn } = newlyClaimed(mem, k, cfg, patterns);
  out.claimed = units.length;
  if (units.length) out.predDelta = bitsOf(pn, k, units, fromChild) - bitsOf(po, mem, units, fromChild);
  // în biți, cele două părți se adună: memoria mai scurtă (gain) față de predicția mai scumpă a unităților
  // revendicate (predDelta). În termeni nu au aceeași unitate: atunci predicția nu are voie să se strice deloc.
  if ((cfg.measure ?? 'terms') === 'bits' ? out.gain - Math.max(0, out.predDelta) <= EPS : out.predDelta > EPS) return out;
  if (validate) {
    out.valDelta = validate(k) - validate(mem);
    if (out.valDelta > EPS) return out;
  }
  out.accept = true;
  return out;
}

// tiparele care folosesc o alegere (prin locuri sau prin rolurile unei clase cuibărite) sau o clasă
export function patternsUsing(mem, { choice, cls }) {
  const out = new Set();
  for (const p of mem.allOfType('PATTERN')) {
    if (!mem.isLive(p)) continue;
    const d = mem.atoms[p].def;
    if (choice !== undefined && d.slots.some((s) => mem.atoms[s].accepts === choice)) out.add(p);
    if (cls !== undefined && d.items.some((it) => it.sub === cls)) out.add(p);
  }
  if (choice !== undefined)
    for (const c of mem.allOfType('PCLASS')) if (mem.atoms[c].def.roles.some((r) => mem.atoms[r].accepts === choice)) for (const p of patternsUsing(mem, { cls: c })) out.add(p);
  return [...out];
}
