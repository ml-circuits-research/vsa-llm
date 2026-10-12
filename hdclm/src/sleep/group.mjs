// Pasul 2: gruparea unităților care au aceiași copii, în afară de câteva poziții libere F.
// Prima implementare: același număr de copii, aliniate de la început.

function subsets(n, fmax) {
  const out = [];
  const rec = (start, cur) => {
    if (cur.length) out.push(cur.slice());
    if (cur.length === fmax) return;
    for (let i = start; i < n; i++) {
      cur.push(i);
      rec(i + 1, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out.filter((F) => F.length < n);
}

function valid(mem, units, F, mmin) {
  if (units.length < mmin) return false;
  for (const f of F) {
    const vals = new Set(units.map((u) => mem.children(u)[f]));
    if (vals.size < 2) return false;
  }
  return true;
}

// câte locuri rămân după ridicare și legare (departajare între grupuri la egalitate; vezi README)
function slotsAfter(ctx, units, F) {
  const cols = [];
  const add = (col) => {
    if (ctx.cfg.bindSlots === false || !cols.some((c) => c.every((x, i) => x === col[i]))) cols.push(col);
  };
  for (const f of F) {
    const col = units.map((u) => ctx.mem.children(u)[f]);
    const ints = col.map((v) => ctx.interp(v));
    const q = ints[0]?.pattern;
    if (ctx.cfg.d_max >= 1 && q !== undefined && ints.every((x) => x && x.pattern === q))
      ctx.pattern(q).slots.forEach((_, j) => add(ints.map((x) => x.fills[j])));
    else add(col);
  }
  return cols.length;
}

export function group(ctx, units, level) {
  const { mem, cfg } = ctx;
  const buckets = new Map();
  const subsetCache = new Map();
  for (const u of units) {
    const ch = mem.children(u);
    const n = ch.length;
    if (n < 2) continue;
    if (!subsetCache.has(n)) subsetCache.set(n, subsets(n, cfg.f_max));
    for (const F of subsetCache.get(n)) {
      const fixed = ch.filter((_, i) => !F.includes(i));
      const key = `${level}|${n}|${F.join(',')}|${fixed.join(',')}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { key, n, F, units: [] }));
      b.units.push(u);
    }
  }
  const cand = [...buckets.values()].filter((g) => valid(mem, g.units, g.F, cfg.m_min));
  for (const g of cand) g.slots = slotsAfter(ctx, g.units, g.F);
  cand.sort((a, b) => a.F.length - b.F.length || b.units.length - a.units.length || a.slots - b.slots || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const taken = new Set();
  const groups = [];
  for (const g of cand) {
    const free = g.units.filter((u) => !taken.has(u));
    if (free.length < g.units.length) {
      for (const u of g.units) if (taken.has(u)) {
        const alts = ctx.alternatives.get(u) ?? [];
        alts.push({ group: g.key });
        ctx.alternatives.set(u, alts);
      }
    }
    if (!valid(mem, free, g.F, cfg.m_min)) continue;
    for (const u of free) taken.add(u);
    groups.push({ ...g, units: free });
  }
  return groups;
}
