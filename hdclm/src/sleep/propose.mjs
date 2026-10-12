// Pasul 3: din grup în tipar. Coloane -> ridicare -> legare -> alegeri -> tipar și aplicări.

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

export function propose(ctx, groups, level) {
  const { mem, cfg } = ctx;
  for (const g of groups) {
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
      const ints = col.map((v) => ctx.interp(v));
      const q = ints[0]?.pattern;
      if (cfg.d_max >= 1 && q !== undefined && ints.every((x) => x && x.pattern === q)) {
        const qd = ctx.pattern(q);
        spec.push({ sub: q, argCols: qd.slots.map((_, j) => ints.map((x) => x.fills[j])) });
        for (const v of col) if (ctx.rewriteOf.has(v)) deps.add(ctx.rewriteOf.get(v));
        if (q < 0) deps.add(q);
      } else spec.push({ col });
    }
    // legare + alegeri
    const proto = spec.map((sp) => (sp.fixed !== undefined ? sp : sp.col ? { slotIdx: colIndex(sp.col) } : { sub: sp.sub, argIdx: sp.argCols.map(colIndex) }));
    const choiceOf = cols.map((c) => choiceFor(ctx, c, level));
    if (choiceOf.some((c) => c === null)) continue; // o coloană constantă fără alegere potrivită
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
    U.forEach((u, r) => ctx.addRewrite(pid, u, slotOrder.map((k) => cols[k][r]), [...deps]));
  }
}
