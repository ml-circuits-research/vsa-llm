// Pasul 3: din grup în tipar. Coloane -> ridicare -> legare -> alegeri -> tipar și aplicări.
import { interpretAs } from '../memory/match.mjs';

const sameCol = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// alegerea pentru o coloană: una existentă (memorie sau pachet) cu care are în comun >= θ_merge, sau una nouă
function choiceFor(ctx, col, level) {
  const vals = [...new Set(col)];
  const cands = [...ctx.mem.allOfType('CHOICE'), ...ctx.choices.keys()];
  let best = null, bestOv = -1;
  for (const c of cands) {
    const cur = ctx.currentMembers(c);
    let common = 0;
    for (const v of vals) if (cur.has(v)) common++;
    const ov = common / Math.min(vals.length, cur.size);
    if (ov >= ctx.cfg.theta_merge && ov > bestOv + 1e-9) {
      best = c;
      bestOv = ov;
    }
  }
  if (best !== null) return best;
  if (vals.length < 2) return null; // o alegere are cel puțin 2 membri
  const ref = ctx.ref();
  ctx.choices.set(ref, { ref, level: Math.max(...vals.map((v) => ctx.mem.level(v))), current: new Map() });
  return ref;
}

// forma canonică a unui tipar, pentru „există deja un tipar identic”
function signature(ctx, items, slotChoice) {
  const idx = new Map();
  const s = (x) => {
    if (!idx.has(x)) idx.set(x, idx.size);
    return `${idx.get(x)}:${slotChoice(x)}`;
  };
  return items.map((it) => (it.fixed !== undefined ? `f${it.fixed}` : it.slot !== undefined ? `s${s(it.slot)}` : `q${it.sub}(${it.args.map(s).join(';')})`)).join('|');
}

function findIdentical(ctx, level, sig) {
  for (const p of ctx.mem.byLevel(level).PATTERN) {
    const d = ctx.mem.atoms[p].def;
    if (signature(ctx, d.items, (s) => ctx.accepts(s)) === sig) return p;
  }
  for (const [ref, p] of ctx.patterns) if (p.level === level && p.sig === sig) return ref;
  return null;
}

// o coloană se poate ridica la tiparul q dacă toate valorile ei sunt aplicări ale lui q. Cu multiInterp,
// ajunge ca fiecare valoare să se poată citi ca q (rescrierea ei principală poate fi alt tipar).
export function findLift(ctx, col, { probe = false } = {}) {
  const ints = col.map((v) => ctx.interp(v));
  const q0 = ints[0]?.pattern;
  if (q0 !== undefined && ints.every((x) => x && x.pattern === q0)) return { q: q0, fills: ints.map((x) => x.fills) };
  if (!ctx.cfg.multiInterp || !ctx.mem.isUnit(col[0])) return null;
  const n = ctx.mem.children(col[0]).length;
  const lvl = ctx.mem.level(col[0]);
  // candidați: tiparele principale ale valorilor, cele mai folosite întâi
  const votes = new Map();
  for (const x of ints) if (x) votes.set(x.pattern, (votes.get(x.pattern) ?? 0) + 1);
  const cands = [...ctx.mem.livePatterns(lvl), ...[...ctx.patterns.values()].filter((p) => p.level === lvl).map((p) => p.ref)]
    .filter((q) => ctx.pattern(q).items.length === n)
    .sort((a, b) => (votes.get(b) ?? 0) - (votes.get(a) ?? 0) || a - b);
  const env = ctx.env();
  for (const q of cands) {
    const fills = col.map((v) => interpretAs(env, v, q));
    if (fills.every(Boolean)) return { q, fills, move: true };
  }
  // niciun tipar nu acoperă coloana: se propune unul nou din valorile ei (fără să li se mute rescrierea principală)
  const vals = [...new Set(col)].sort((a, b) => a - b);
  if (vals.length < ctx.cfg.m_min || !vals.every((v) => ctx.mem.isUnit(v) && ctx.mem.children(v).length === n)) return null;
  const chs = vals.map((v) => ctx.mem.children(v));
  const F = [...Array(n).keys()].filter((i) => chs.some((c) => c[i] !== chs[0][i]));
  if (!F.length || F.length >= n || F.length > ctx.cfg.f_max) return null;
  if (!probe) for (const v of vals) detach(ctx, v);
  const q = probe ? null : proposeGroup(ctx, { n, F, units: vals, key: `lift|${vals.join(',')}` }, lvl);
  if (probe) return { q: null, probe: F.length };
  if (q === null) return null;
  const fills = col.map((v) => interpretAs(ctx.env(), v, q));
  return fills.every(Boolean) ? { q, fills, move: false } : null;
}

// scoate unitatea din propunerea în care era rescrisă în această trecere
function detach(ctx, v) {
  const r = ctx.rewriteOf.get(v);
  if (r === undefined) return;
  ctx.proposals.get(r).units.delete(v);
  ctx.rewriteOf.delete(v);
}

// valorile citite prin q trec principal la q (ceilalți le pot citi în continuare prin interpretări multiple)
function moveTo(ctx, q, col, fills) {
  const lvl = ctx.mem.level(col[0]);
  ctx.proposal(q, q < 0, lvl);
  col.forEach((v, r) => {
    if (ctx.interp(v)?.pattern === q) return;
    detach(ctx, v);
    ctx.addRewrite(q, v, fills[r]);
  });
}

export function propose(ctx, groups, level) {
  for (const g of groups) proposeGroup(ctx, g, level);
}

export function proposeGroup(ctx, g, level, { rewrite = true } = {}) {
  const { mem, cfg } = ctx;
  {
    const U = g.units;
    const ch = U.map((u) => mem.children(u));
    const F = new Set(g.F);
    const cols = []; // coloanele locurilor, după legare
    const colIndex = (col) => {
      if (cfg.bindSlots !== false) {
        const i = cols.findIndex((c) => sameCol(c, col));
        if (i >= 0) return i;
      }
      cols.push(col);
      return cols.length - 1;
    };
    const spec = [];
    const deps = new Set();
    for (let i = 0; i < g.n; i++) {
      if (!F.has(i)) {
        spec.push({ fixed: ch[0][i] });
        continue;
      }
      const col = ch.map((c) => c[i]);
      // ridicare: toate valorile sunt aplicări ale aceluiași tipar q
      const lift = cfg.d_max >= 1 ? findLift(ctx, col) : null;
      if (lift) {
        const q = lift.q;
        if (lift.move) moveTo(ctx, q, col, lift.fills);
        if (ctx.proposals.has(q)) deps.add(q);
        const qd = ctx.pattern(q);
        spec.push({ sub: q, argCols: qd.slots.map((_, j) => lift.fills.map((f) => f[j])) });
        for (const v of col) if (ctx.rewriteOf.has(v)) deps.add(ctx.rewriteOf.get(v));
        if (q < 0) deps.add(q);
      } else spec.push({ col });
    }
    // legare + alegeri
    const proto = spec.map((sp) => (sp.fixed !== undefined ? sp : sp.col ? { slotIdx: colIndex(sp.col) } : { sub: sp.sub, argIdx: sp.argCols.map(colIndex) }));
    const choiceOf = cols.map((c) => choiceFor(ctx, c, level));
    if (choiceOf.some((c) => c === null)) return null; // o coloană constantă fără alegere potrivită
    const items = proto.map((it) => (it.fixed !== undefined ? it : it.slotIdx !== undefined ? { slot: `#${it.slotIdx}` } : { sub: it.sub, args: it.argIdx.map((k) => `#${k}`) }));
    const sig = signature(ctx, items, (s) => choiceOf[Number(s.slice(1))]);
    let pid = findIdentical(ctx, level, sig);
    let slotOrder; // indexul coloanei pentru fiecare loc al tiparului
    if (pid === null) {
      pid = ctx.ref();
      const structRef = cols.map(() => null);
      const firstSeen = [];
      const S = (k) => {
        if (structRef[k] === null) {
          structRef[k] = ctx.ref();
          ctx.structs.set(structRef[k], choiceOf[k]);
          firstSeen.push(k);
        }
        return structRef[k];
      };
      const realItems = proto.map((it) => (it.fixed !== undefined ? { fixed: it.fixed } : it.slotIdx !== undefined ? { slot: S(it.slotIdx) } : { sub: it.sub, args: it.argIdx.map(S) }));
      slotOrder = firstSeen;
      ctx.patterns.set(pid, {
        ref: pid,
        level,
        items: realItems,
        slots: firstSeen.map((k) => structRef[k]),
        structs: firstSeen.map((k) => ({ tmp: structRef[k], accepts: choiceOf[k] })),
        sig,
      });
      ctx.proposal(pid, true, level);
    } else {
      // același tipar: ordinea locurilor este ordinea primei apariții, ca și la noi
      const seen = [];
      for (const it of proto) for (const k of it.slotIdx !== undefined ? [it.slotIdx] : it.argIdx ?? []) if (!seen.includes(k)) seen.push(k);
      slotOrder = seen;
      ctx.proposal(pid, pid < 0 ? true : false, level);
    }
    if (rewrite) U.forEach((u, r) => ctx.addRewrite(pid, u, slotOrder.map((k) => cols[k][r]), [...deps]));
    else {
      // tipar folosit doar cuibărit: valorile lui intră în alegeri, ca să se poată citi prin el
      U.forEach((u, r) => slotOrder.forEach((k, i) => ctx.addToChoice(ctx.accepts(ctx.pattern(pid).slots[i]), cols[k][r])));
      for (const d of deps) ctx.proposals.get(pid).deps.add(d);
    }
    return pid;
  }
}
