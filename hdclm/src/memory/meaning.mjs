// Sens și formă (P1 din ANALIZA_PARAFRAZE.md). Doar citește memoria.
//
// Un loc s al tiparului q POARTĂ SENS dacă un tipar viu R îl cuibărește (item { sub: q, args }) și îl leagă:
// argumentul lui R pentru s mai apare în R (alt copil cuibărit sau un loc liber), adică valoarea lui s este
// cerută și în altă parte (de exemplu persoana din fapt este cea din întrebare). Altfel locul este INERT:
// valoarea lui nu contează pentru nicio regulă, deci ține de formă.
//
// Ecuația canonică a unei aplicări = (clasa tiparului, valorile locurilor care poartă sens). Două unități cu
// aceeași ecuație canonică spun „același lucru” pentru tot ce a învățat sistemul. Clasa tiparului este
// tiparul însuși până când există clase de tipare (P3).

export function bearingSlots(mem) {
  const bearing = new Map(); // tipar -> Set(locuri care poartă sens)
  for (const R of mem.allOfType('PATTERN')) {
    if (!mem.isLive(R)) continue;
    const items = mem.atoms[R].def.items;
    const uses = new Map(); // locul lui R -> de câte ori apare
    for (const it of items) for (const s of it.slot !== undefined ? [it.slot] : it.args ?? []) uses.set(s, (uses.get(s) ?? 0) + 1);
    const mark = (p, s) => {
      if (!bearing.has(p)) bearing.set(p, new Set());
      bearing.get(p).add(s);
    };
    for (const it of items) {
      if (it.sub === undefined) continue;
      const q = mem.atoms[it.sub].def;
      it.args.forEach((a, j) => {
        if ((uses.get(a) ?? 0) <= 1) return;
        if (q.type === 'PCLASS') {
          // rolul j al clasei poartă sens, deci și locurile membrilor aliniate la el
          mark(it.sub, q.roles[j]);
          for (const m of q.members) mem.atoms[m].def.slots.forEach((s, k) => q.align[m][k] === j && mark(m, s));
        } else mark(it.sub, q.slots[j]);
      });
    }
  }
  return bearing;
}

// clasa vie din care face parte un tipar (prima, după id), sau null
export function classIndex(mem) {
  const idx = new Map();
  for (const c of mem.allOfType('PCLASS')) if (mem.isLive(c)) for (const m of mem.atoms[c].def.members) if (!idx.has(m)) idx.set(m, c);
  return idx;
}

// ecuația canonică: (clasa, valorile rolurilor care poartă sens) sau (tiparul, valorile locurilor care poartă sens)
export function canon(mem, u, bearing = bearingSlots(mem), classes = classIndex(mem)) {
  const d = mem.atoms[u].def;
  if (d.type !== 'APP') return null;
  const q = mem.atoms[d.pattern].def;
  const M = classes.get(d.pattern);
  if (M !== undefined) {
    const c = mem.atoms[M].def;
    const roles = new Array(c.roles.length).fill(null);
    c.align[d.pattern].forEach((r, j) => (roles[r] = d.fills[j]));
    const b = bearing.get(M) ?? new Set();
    return `M${M}(${roles.map((v, r) => (b.has(c.roles[r]) ? v : '_')).join(',')})`;
  }
  const b = bearing.get(d.pattern) ?? new Set();
  return `P${d.pattern}(${q.slots.map((s, i) => (b.has(s) ? d.fills[i] : '_')).join(',')})`;
}

// rezumat: câte locuri poartă sens, câte sunt inerte, pe tipare
export function meaningSummary(mem) {
  const bearing = bearingSlots(mem);
  let total = 0, bear = 0;
  for (const p of mem.allOfType('PATTERN')) {
    if (!mem.isLive(p)) continue;
    const slots = mem.atoms[p].def.slots;
    total += slots.length;
    bear += slots.filter((s) => bearing.get(p)?.has(s)).length;
  }
  return { slots: total, bearing: bear, inert: total - bear };
}
