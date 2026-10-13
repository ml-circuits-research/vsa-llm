// Trecerea de tipuri (D18, somnul adânc): tipul unui loc devine un concept, nu lista valorilor văzute.
// O alegere ai cărei membri sunt aplicări (de exemplu propoziții-distractor într-o poveste) se poate
// rescrie ca alegere tipizată: membrii-aplicări se înlocuiesc cu tiparul lor sau cu cea mai mică clasă
// (concept) care îl conține, iar locul acceptă de acum orice aplicare a acelui tip, și una nevăzută.
//   inducția: un tip intră doar dacă acoperă cel puțin m_min dintre membrii văzuți (dovadă repetată);
//             aplicările singure rămân membri direcți
//   judecata: exactă, pe o copie a memoriei; se păstrează varianta (tipar sau clasă) cu câștigul cel mai
//             mare, dacă este > 0. În biți, alegerea se scurtează, dar fiecare folosire costă mai mult
//             (log din numărul de valori acoperite), deci generalizarea trebuie să se plătească.
//   judecata unică (D20, generalize.mjs): MDL exact + contraexemplele (unitățile văzute revendicate nou nu au
//             voie să fie prezise mai prost) + validarea, dacă există. Exemplu de contraexemplu: „orice deplasare”
//             ca distractor revendică și povestea în care aceeași persoană se mută din nou.
import { total } from '../memory/size.mjs';
import { classIndex } from '../memory/meaning.mjs';
import { judgeGeneralization, patternsUsing } from './generalize.mjs';

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

export function typePass(mem, cfg, { validate } = {}) {
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
      const J = judgeGeneralization(mem, k, cfg, { patterns: patternsUsing(mem, { choice: c }), validate, before });
      tried.push({ choice: c, kind, gain: +J.gain.toFixed(3), claimed: J.claimed, predDelta: +J.predDelta.toFixed(3), valDelta: +J.valDelta.toFixed(4), types: members.filter(([m]) => ['PATTERN', 'PCLASS'].includes(mem.atoms[m].def?.type)).length });
      if (J.accept && (!best || J.gain > best.gain + EPS)) best = { pkg, gain: J.gain, kind };
    }
    if (best) {
      mem.beginPass();
      mem.commit(best.pkg);
      changed++;
    }
  }
  return { changed: changed > 0, retyped: changed, tried };
}
