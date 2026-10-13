import { liveClassIndex } from '../memory/meaning.mjs';
import { strategyFor, VectorView } from '../memory/vectors.mjs';
import { findLift } from './propose.mjs';
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
    const rowOthers = ctx.cfg.patternClasses ? units.map((u) => new Set(ctx.mem.children(u).flatMap((x, k) => (k === f ? [] : ctx.mem.unfold(x))))) : null;
    const lift = ctx.cfg.d_max >= 1 ? findLift(ctx, col, { probe: true, rowOthers }) : null;
    if (lift?.probe) for (let k = 0; k < lift.probe; k++) add(col.map((v) => `${v}#${k}`)); // tipar care s-ar crea
    else if (lift?.cls) {
      const k = lift.q === null ? lift.k : ctx.pattern(lift.q).roles.length;
      for (let j = 0; j < k; j++) add(lift.fills.map((f) => f[j]));
      add(lift.form);
    } else if (lift) ctx.pattern(lift.q).slots.forEach((_, j) => add(lift.fills.map((f) => f[j])));
    else add(col);
  }
  return cols.length;
}

// toate grupurile valide, în ordinea de luare (fără atribuirea lacomă a unităților)
export function candidateGroups(ctx, units, level) {
  const { mem, cfg } = ctx;
  // D20: doar clasele judecate (vii, adică folosite de reguli acceptate); ipotezele nejudecate nu grupează
  const conceptOf = cfg.concepts ? liveClassIndex(mem) : null;
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
    // gruparea abstractă: copii care sunt aplicări ale acelorași tipare (valorile pot diferi peste tot)
    if (cfg.abstractGroups) {
      // forma copiilor: o unitate contează prin nivelul și lungimea ei, un token prin el însuși
      // forma copiilor; cu concepte (D17): forma conceptuală, adică clasa cea mai specifică a copilului
      // (concept sau clasă vie) dacă tiparul lui principal e într-una, altfel nivelul
      const shape = (c) => {
        if (!mem.isUnit(c)) return `a${c}`;
        if (cfg.concepts) {
          const x = ctx.interp(c);
          if (x && conceptOf.has(x.pattern)) return `k${conceptOf.get(x.pattern)}`;
        }
        return cfg.abstractShape === 'level' ? `u${mem.level(c)}` : `u${mem.level(c)}:${mem.children(c).length}`;
      };
      const sig = ch.map(shape);
      if (sig.some((x) => x[0] === 'u' || x[0] === 'k')) {
        // structura repetițiilor: care valori (ale locurilor copiilor, sau copiii-token) se repetă, și unde.
        // Unități cu aceeași formă dar cu alte legături nu intră în același grup.
        const vals = ch.flatMap((c) => ctx.interp(c)?.fills ?? [c]);
        const first = new Map();
        const eq = vals.map((v, i) => (first.has(v) ? first.get(v) : (first.set(v, i), i)));
        const key = `${level}|${n}|A|${sig.join(',')}|${eq.join(',')}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = { key, n, F: null, abstract: true, units: [] }));
        b.units.push(u);
      }
    }
  }
  // D23: despărțirea grupurilor abstracte după tiparul (sau clasa vie) unei coloane. Un grup abstract poate
  // amesteca sensuri cu aceeași structură a repetițiilor (de exemplu întrebări despre loc și despre obiect);
  // atunci coloana faptului nu se poate ridica. Subgrupurile, câte unul pe valoarea coloanei j, se propun
  // alături de grupul întreg; alege judecata (câștigul exact). Fără prag: un subgrup cere doar m_min unități.
  if (cfg.splitAbstract) {
    const liveCls = liveClassIndex(mem);
    const typeOf = (c) => {
      const x = mem.isUnit(c) ? ctx.interp(c) : null;
      return x ? liveCls.get(x.pattern) ?? x.pattern : null;
    };
    for (const b of [...buckets.values()]) {
      if (!b.abstract) continue;
      for (let j = 0; j < b.n; j++) {
        const parts = new Map();
        for (const u of b.units) {
          const t = typeOf(mem.children(u)[j]);
          if (t === null) continue;
          if (!parts.has(t)) parts.set(t, []);
          parts.get(t).push(u);
        }
        if (parts.size < 2) continue;
        for (const [t, us] of parts) {
          if (us.length < (cfg.m_min ?? 2)) continue;
          const key = `${b.key}|j${j}=${t}`;
          if (!buckets.has(key)) buckets.set(key, { key, n: b.n, F: null, abstract: true, units: us });
        }
      }
    }
  }
  for (const b of buckets.values())
    if (b.abstract) {
      const chs = b.units.map((u) => mem.children(u));
      b.F = [...Array(b.n).keys()].filter((i) => chs.some((c) => c[i] !== chs[0][i]));
    }
  // cu o strategie cu vectori: o unitate rămâne într-un grup doar dacă are printre vecinii ei apropiați
  // (nearest peste comp, asemănare >= θ_group) un alt membru al grupului; grupul se verifică apoi exact.
  // Grupurile abstracte (după formă) nu trec prin acest filtru: forma nu e codată în comp.
  const S = strategyFor(cfg);
  if (S) {
    const near = nearSets(mem, cfg, S, units);
    for (const b of buckets.values()) if (!b.abstract) b.units = b.units.filter((u) => b.units.some((v) => v !== u && near.get(u).has(v)));
  }
  const cand = [...buckets.values()].filter((g) => g.F.length > 0 && valid(mem, g.units, g.F, cfg.m_min));
  for (const g of cand) g.slots = slotsAfter(ctx, g.units, g.F);
  // ordinea de luare: specificația cere întâi grupurile cu mai puține poziții libere, apoi cele mai mari
  // (groupOrder 'free'); varianta 'size' ia întâi grupurile mai mari (mai generale), apoi pe cele cu mai puține
  // poziții libere
  const bySize = cfg.groupOrder === 'size';
  cand.sort((a, b) =>
    (bySize ? b.units.length - a.units.length || a.F.length - b.F.length : a.F.length - b.F.length || b.units.length - a.units.length) ||
    a.slots - b.slots ||
    (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  return cand;
}

export function group(ctx, units, level) {
  const cand = candidateGroups(ctx, units, level);
  const { mem, cfg } = ctx;
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

function nearSets(mem, cfg, S, units) {
  const view = new VectorView(VectorView.memorySource(mem), S, { seed: cfg.seed, w: cfg.w });
  const cands = units.map((id) => ({ id, v: view.comp(id) }));
  const theta = cfg.theta_group ?? 0.2;
  const k = cfg.nearK ?? 32;
  const out = new Map();
  for (const u of units) out.set(u, new Set(S.nearest(view.comp(u), cands, k + 1).filter((x) => x.id !== u && x.sim >= theta).map((x) => x.id)));
  return out;
}
