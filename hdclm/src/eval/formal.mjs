// Calitatea formalizării: cât din text a trecut de la atomi poziționali (înșiruiri brute) la ecuații cu
// atomi de structură și de sens, și cât de puțin redundanți sunt aceștia. Doar măsurătoare.
//
//   acoperire     partea tokenilor de învățare a căror unitate imediat deasupra este o aplicare (un tipar);
//                 acoperireSus: sub cel puțin o aplicare, la orice nivel
//   tipare, roluri  tiparele vii; atomii de structură ai lor; rolurile distincte (după alegerea acceptată)
//   redundanță    atomi de structură / roluri distincte (1 = fiecare rol există o singură dată)
//   duplicate     perechi de alegeri vii care au în comun ≥ 50% din membri (aceeași categorie, doi atomi)
//   aur           (opțional) clasele de sens cunoscute: puritate, completitudine, contopiri false

export function formalQuality(mem, roots, gold = null) {
  const live = (t) => mem.allOfType(t).filter((x) => mem.isLive(x));
  const pats = live('PATTERN');
  const chs = live('CHOICE');
  const structs = new Set();
  for (const p of pats) for (const s of mem.atoms[p].def.slots) structs.add(s);
  const roles = new Set([...structs].map((s) => mem.atoms[s].accepts));
  // cu clase de tipare (D15): locurile membrilor unei clase sunt înlocuite de rolurile comune ale clasei
  const classes = mem.allOfType('PCLASS').filter((c) => mem.isLive(c));
  const inClass = new Set(classes.flatMap((c) => mem.atoms[c].def.members));
  const effective = new Set();
  for (const p of pats) if (!inClass.has(p)) for (const s of mem.atoms[p].def.slots) effective.add(s);
  for (const c of classes) for (const r of mem.atoms[c].def.roles) effective.add(r);
  // acoperirea pe tokeni
  let tok = 0, cov = 0, covUp = 0;
  const walk = (id, under) => {
    const app = mem.atoms[id].def.type === 'APP';
    for (const c of mem.children(id)) {
      if (mem.isToken(c)) {
        tok++;
        if (app) cov++;
        if (under || app) covUp++;
      } else walk(c, under || app);
    }
  };
  for (const r of roots) if (!mem.isToken(r)) walk(r, false);
  // categorii duplicate
  let dup = 0;
  for (let i = 0; i < chs.length; i++)
    for (let j = i + 1; j < chs.length; j++) {
      const a = mem.atoms[chs[i]].def.members, b = mem.atoms[chs[j]].def.members;
      let c = 0;
      for (const k of a.keys()) if (b.has(k)) c++;
      if (c / Math.min(a.size, b.size) >= 0.5) dup++;
    }
  const out = {
    tokenCoverage: tok ? cov / tok : 0,
    tokenCoverageAnyLevel: tok ? covUp / tok : 0,
    unitsRewritten: mem.allOfType('APP').length / Math.max(1, mem.unitCount()),
    patterns: pats.length,
    structAtoms: structs.size,
    distinctRoles: roles.size,
    redundancy: roles.size ? structs.size / roles.size : 0,
    patternClasses: classes.length,
    effectiveStructAtoms: effective.size,
    effectiveRedundancy: roles.size ? effective.size / roles.size : 0,
    choices: chs.length,
    duplicateChoicePairs: dup,
  };
  if (gold) out.gold = goldScore(mem, chs, gold);
  return out;
}

// gold = { meanings: { NUME: [forme de suprafață, ca șiruri de tokeni] } }. O formă este „găsită” într-o
// alegere dacă alegerea are ca membru tokenul ei (forma de un cuvânt) sau unitatea cu exact acel text.
function goldScore(mem, chs, gold) {
  // un membru poate fi un token, o unitate sau (în alegerile de forme ale claselor) un tipar: atunci se citește
  // prin cuvintele lui fixe, fără cuvintele de legătură de la capăt (doar pentru comparația cu aurul)
  const textOf = (m) => {
    if (mem.isToken(m)) return mem.atoms[m].text;
    const d = mem.atoms[m].def;
    if (d.type === 'PCLASS') return `M${m}`; // membru-tip al unei alegeri tipizate (D18)
    if (d.type !== 'PATTERN') return mem.text(m);
    let w = d.items.filter((it) => it.fixed !== undefined && mem.isToken(it.fixed)).map((it) => mem.atoms[it.fixed].text).filter((t) => !/^[^\p{L}]+$/u.test(t));
    while (w.length && ['the', 'to', 'a'].includes(w.at(-1))) w = w.slice(0, -1);
    return w.join(' ');
  };
  const classes = chs.map((c) => [...mem.atoms[c].def.members.keys()].map(textOf));
  const formOf = new Map();
  for (const [meaning, forms] of Object.entries(gold.meanings)) for (const f of forms) formOf.set(f, meaning);
  const perMeaning = {};
  for (const [meaning, forms] of Object.entries(gold.meanings)) {
    let best = { found: 0, purity: 0, members: [] };
    for (const cl of classes) {
      const hits = cl.filter((t) => forms.includes(t));
      if (!hits.length) continue;
      const golded = cl.filter((t) => formOf.has(t));
      const purity = hits.length / golded.length;
      if (hits.length > best.found || (hits.length === best.found && purity > best.purity)) best = { found: hits.length, purity, members: cl.slice(0, 12) };
    }
    perMeaning[meaning] = { forms: forms.length, completeness: best.found / forms.length, purity: best.purity, bestClass: best.members };
  }
  // contopiri false: alegeri care conțin forme din două sensuri diferite
  const falseMerges = classes
    .map((cl) => [...new Set(cl.filter((t) => formOf.has(t)).map((t) => formOf.get(t)))])
    .filter((ms) => ms.length > 1)
    .map((ms) => ms.join('+'));
  return { perMeaning, falseMerges };
}
