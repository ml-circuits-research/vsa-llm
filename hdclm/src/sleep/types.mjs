// Trecerea de tipuri (D18, somnul adânc): tipul unui loc devine un concept, nu lista valorilor văzute.
// O alegere ai cărei membri sunt aplicări (de exemplu propoziții-distractor într-o poveste) se poate
// rescrie ca alegere tipizată: membrii-aplicări se înlocuiesc cu tiparul lor sau cu cea mai mică clasă
// (concept) care îl conține, iar locul acceptă de acum orice aplicare a acelui tip, și una nevăzută.
//   inducția: un tip intră doar dacă acoperă cel puțin m_min dintre membrii văzuți (dovadă repetată);
//             aplicările singure rămân membri direcți
//   judecata: exactă, pe o copie a memoriei; se păstrează varianta (tipar sau clasă) cu câștigul cel mai
//             mare, dacă este > 0. În biți, alegerea se scurtează, dar fiecare folosire costă mai mult
//             (log din numărul de valori acoperite), deci generalizarea trebuie să se plătească.
//   contraexemplele: o generalizare nu are voie să prezică mai prost unitățile văzute pe care le „revendică”
//             nou (un tipar care folosește alegerea se potrivește acum pe un prefix mai lung al lor). Biții de
//             predicție ai acestor unități, înainte și după, pe copie; dacă cresc, tipizarea nu se face.
//             Exemplu: „orice deplasare” ca distractor revendică și povestea în care aceeași persoană se mută
//             din nou, iar regula ar da locul vechi.
import { total } from '../memory/size.mjs';
import { classIndex } from '../memory/meaning.mjs';
import { Predictor } from '../predict/distribution.mjs';
import { matchPattern } from '../memory/match.mjs';

const EPS = 1e-9;

function typedMembers(mem, c, typeOf, mMin) {
  const d = mem.atoms[c].def;
  const groups = new Map(); // tip -> [[membru, pondere]]
  const plain = [];
  for (const [m, w] of d.members) {
    const md = mem.atoms[m].def;
    if (md?.type === 'PATTERN' || md?.type === 'PCLASS') plain.push([m, w]); // deja tip
    else if (md?.type === 'APP') {
      const T = typeOf(md.pattern);
      if (!groups.has(T)) groups.set(T, []);
      groups.get(T).push([m, w]);
    } else plain.push([m, w]);
  }
  const out = new Map(plain);
  let types = 0;
  for (const [T, ms] of groups) {
    if (ms.length >= mMin) {
      out.set(T, (out.get(T) ?? 0) + ms.reduce((s, [, w]) => s + w, 0));
      types++;
    } else for (const [m, w] of ms) out.set(m, w);
  }
  if (!types) return null;
  return [...out].sort((a, b) => a[0] - b[0]);
}

// cel mai lung prefix al copiilor lui u pe care tiparul P îl potrivește (0 dacă niciunul)
function claim(pred, P, ch) {
  for (let k = ch.length; k > 0; k--) if (matchPattern(pred.env, P, ch.slice(0, k), { partial: true })) return k;
  return 0;
}

function bitsOf(pred, mem, units) {
  let b = 0;
  for (const u of units) {
    const toks = mem.unfold(u).map((t) => ({ text: mem.atoms[t].text, spaceBefore: true, newlineBefore: false }));
    for (const p of pred.docProbs(toks)) b += -Math.log2(p);
  }
  return b;
}

// unitățile văzute revendicate nou de tiparele care acceptă c, și biții lor de predicție înainte / după
function counterCheck(mem, k, cfg, c) {
  const users = (mem.choiceUsers().get(c) ?? []).filter((p) => mem.atoms[p].def.type === 'PATTERN' && mem.isLive(p));
  if (!users.length) return { claimed: 0, delta: 0 };
  const po = new Predictor(mem, cfg), pn = new Predictor(k, cfg);
  const claimed = new Set();
  for (const P of users) {
    const L = mem.atoms[P].level;
    const bl = mem.byLevel(L);
    for (const u of [...bl.SEQ, ...bl.APP]) {
      const d = mem.atoms[u].def;
      if (d.type === 'APP' && d.pattern === P) continue;
      const ch = mem.children(u);
      if (claim(pn, P, ch) > claim(po, P, ch)) claimed.add(u);
    }
  }
  if (!claimed.size) return { claimed: 0, delta: 0 };
  const us = [...claimed].sort((a, b) => a - b);
  return { claimed: us.length, delta: bitsOf(pn, k, us) - bitsOf(po, mem, us) };
}

export function typePass(mem, cfg) {
  const measure = cfg.measure ?? 'terms';
  const mMin = cfg.m_min ?? 2;
  let changed = 0;
  const tried = [];
  const choices = mem.allOfType('CHOICE').filter((c) => mem.isLive(c));
  for (const c of choices) {
    const cls = classIndex(mem);
    const variants = [
      ['tipar', (p) => p],
      ['clasă', (p) => cls.get(p) ?? p],
    ];
    const before = total(mem, measure);
    let best = null;
    const seen = new Set();
    for (const [kind, typeOf] of variants) {
      const members = typedMembers(mem, c, typeOf, mMin);
      if (!members) continue;
      const key = JSON.stringify(members);
      if (seen.has(key)) continue;
      seen.add(key);
      const pkg = { retype: [{ choice: c, members }] };
      const k = mem.clone();
      k.beginPass();
      k.commit(pkg, { check: false });
      const gain = before - total(k, measure);
      const cc = gain > EPS ? counterCheck(mem, k, cfg, c) : { claimed: 0, delta: 0 };
      tried.push({ choice: c, kind, gain: +gain.toFixed(3), claimed: cc.claimed, predDelta: +cc.delta.toFixed(3), types: members.filter(([m]) => ['PATTERN', 'PCLASS'].includes(mem.atoms[m].def?.type)).length });
      if (gain > EPS && cc.delta <= EPS && (!best || gain > best.gain + EPS)) best = { pkg, gain, kind };
    }
    if (best) {
      mem.beginPass();
      mem.commit(best.pkg);
      changed++;
    }
  }
  return { changed: changed > 0, retyped: changed, tried };
}
