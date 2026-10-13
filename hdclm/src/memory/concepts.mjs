// Concepte din comportament (analiza formală a conceptelor). Doar citește memoria.
//
// Obiecte: tiparele vii de pe un nivel (formele: „S moved to the S .”, „S has the S .” …).
// Atribute (intensiunea), două feluri:
//   tip      pe locul j apar valori dintr-o anumită categorie: „T0:Cnume”, „T1:Cloc”
//   funcție  tiparul apare (direct sau printr-o clasă) în regula R pe poziția i, iar locul j este legat
//            de altceva din R (de exemplu de răspuns): „F:R@i:j”. Locurile nelegate nu dau atribute.
// Conceptele sunt perechile (extensiune, intensiune) închise: intensiunea = atributele comune tuturor
// obiectelor din extensiune; extensiunea = toate obiectele care au acea intensiune.
//   aceeași intensiune completă      -> candidați la unificare (același sens)
//   o intensiune inclusă în alta      -> ierarhie (concept mai general / subconcept)
//   intensiuni care se suprapun      -> frați sub conceptul mai general

// categoria unei mulțimi de valori: alegerea vie care o acoperă cel mai bine (≥ 50%)
function categoryOf(mem, vals, choices) {
  let best = null, bo = 0;
  for (const c of choices) {
    const ms = mem.atoms[c].def.members;
    let k = 0;
    for (const v of vals) if (ms.has(v)) k++;
    const o = k / vals.size;
    if (o > bo + 1e-9 || (Math.abs(o - bo) <= 1e-9 && best !== null && ms.size > mem.atoms[best].def.members.size)) [bo, best] = [o, c];
  }
  return bo >= 0.5 ? `C${best}` : 'amestec';
}

export function patternProfiles(mem, level = 3) {
  const live = (t) => mem.allOfType(t).filter((x) => mem.isLive(x));
  const choices = live('CHOICE');
  const pats = live('PATTERN').filter((p) => mem.atoms[p].level === level);
  const usage = new Map(pats.map((p) => [p, mem.atoms[p].def.slots.map(() => new Set())]));
  for (const u of mem.allOfType('APP')) {
    const d = mem.atoms[u].def;
    if (usage.has(d.pattern)) d.fills.forEach((v, j) => usage.get(d.pattern)[j].add(v));
  }
  const prof = new Map(pats.map((p) => [p, new Set()]));
  for (const p of pats) usage.get(p).forEach((vals, j) => vals.size && prof.get(p).add(`T${j}:${categoryOf(mem, vals, choices)}`));
  // funcție: regulile care cuibăresc tiparul (direct sau printr-o clasă) și locurile legate
  for (const R of live('PATTERN')) {
    const items = mem.atoms[R].def.items;
    const uses = new Map();
    for (const it of items) for (const s of it.slot !== undefined ? [it.slot] : [...(it.args ?? [])]) uses.set(s, (uses.get(s) ?? 0) + 1);
    items.forEach((it, i) => {
      if (it.sub === undefined) return;
      const q = mem.atoms[it.sub].def;
      const members = q.type === 'PCLASS' ? q.members : [it.sub];
      for (const m of members) {
        if (!prof.has(m)) continue;
        const md = mem.atoms[m].def;
        md.slots.forEach((_, j) => {
          const arg = q.type === 'PCLASS' ? it.args[q.align[m][j]] : it.args[j];
          if ((uses.get(arg) ?? 0) > 1) prof.get(m).add(`F:R${R}@${i}:${j}`);
        });
      }
    });
  }
  return { pats, prof };
}

// rețeaua de concepte: toate intersecțiile de intensiuni (închise), cu extensiunile lor
export function conceptLattice(objects, prof) {
  const key = (s) => [...s].sort().join('|');
  const intents = new Map();
  const add = (s) => {
    const k = key(s);
    if (!intents.has(k)) intents.set(k, s);
    return k;
  };
  for (const o of objects) if (prof.get(o).size) add(prof.get(o));
  for (let changed = true; changed; ) {
    changed = false;
    const list = [...intents.values()];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const x = new Set([...list[i]].filter((a) => list[j].has(a)));
        if (x.size && !intents.has(key(x))) {
          add(x);
          changed = true;
        }
      }
  }
  const concepts = [...intents.values()].map((intent) => ({ intent, extent: objects.filter((o) => [...intent].every((a) => prof.get(o).has(a))) }));
  // părinții direcți: conceptele cu intensiune strict inclusă, maximă
  for (const c of concepts) {
    const sup = concepts.filter((d) => d !== c && d.intent.size < c.intent.size && [...d.intent].every((a) => c.intent.has(a)));
    c.parents = sup.filter((d) => !sup.some((e) => e !== d && e.intent.size > d.intent.size && [...d.intent].every((a) => e.intent.has(a))));
  }
  return concepts.sort((a, b) => b.extent.length - a.extent.length || a.intent.size - b.intent.size);
}

// Concepte pentru valori, din comportament: o valoare (token sau unitate) are ca atribute locurile (tipar, j)
// în care apare. Valorile care apar în aceleași locuri sunt de același fel. Gruparea: Jaccard ≥ θ între
// mulțimile de atribute, cu legătură medie (nu în lanț), ca să nu se unească prin câte o punte.
export function valueConcepts(mem, level = 3, theta = 0.5) {
  const pats = mem.allOfType('PATTERN').filter((p) => mem.isLive(p) && mem.atoms[p].level === level);
  const pset = new Set(pats);
  const attrs = new Map();
  for (const u of mem.allOfType('APP')) {
    const d = mem.atoms[u].def;
    if (!pset.has(d.pattern)) continue;
    d.fills.forEach((v, j) => {
      if (!attrs.has(v)) attrs.set(v, new Set());
      attrs.get(v).add(`${d.pattern}:${j}`);
    });
  }
  const jac = (a, b) => {
    let k = 0;
    for (const x of a) if (b.has(x)) k++;
    return k / (a.size + b.size - k);
  };
  // grupare aglomerativă cu legătură medie
  let groups = [...attrs.keys()].sort((a, b) => a - b).map((v) => [v]);
  const avg = (g, h) => {
    let s = 0;
    for (const a of g) for (const b of h) s += jac(attrs.get(a), attrs.get(b));
    return s / (g.length * h.length);
  };
  for (;;) {
    let best = null, bs = theta - 1e-12;
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const s = avg(groups[i], groups[j]);
        if (s > bs) [bs, best] = [s, [i, j]];
      }
    if (!best) break;
    const [i, j] = best;
    groups[i] = [...groups[i], ...groups[j]].sort((a, b) => a - b);
    groups.splice(j, 1);
  }
  const of = new Map();
  groups.forEach((g, k) => g.forEach((v) => of.set(v, k)));
  return { groups, of, attrs };
}

// profilurile tiparelor, cu tipurile locurilor date de conceptele de valori (nu de alegerile acceptate)
export function patternProfilesByValues(mem, level = 3, vc = valueConcepts(mem, level)) {
  const { pats, prof } = patternProfiles(mem, level);
  for (const p of pats) {
    for (const a of [...prof.get(p)]) if (a.startsWith('T')) prof.get(p).delete(a);
    const counts = mem.atoms[p].def.slots.map(() => new Map());
    for (const u of mem.allOfType('APP')) {
      const d = mem.atoms[u].def;
      if (d.pattern !== p) continue;
      d.fills.forEach((v, j) => {
        const g = vc.of.get(v);
        counts[j].set(g, (counts[j].get(g) ?? 0) + 1);
      });
    }
    counts.forEach((m, j) => {
      const tot = [...m.values()].reduce((a, b) => a + b, 0);
      const [g, c] = [...m].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (tot) prof.get(p).add(c / tot >= 0.5 ? `T${j}:V${g}` : `T${j}:amestec`);
    });
  }
  return { pats, prof, vc };
}
