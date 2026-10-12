// Potrivirea unei liste de copii cu un tipar, după regulile de la recunoaștere (secțiunea 9, pasul 1).
// Folosită de somn (recunoaștere) și de predicție (prefixe). Doar citește.
//
// env = {
//   pattern(pid)       -> { items, slots }
//   accepts(structId)  -> id-ul alegerii acceptate
//   isMember(c, v)     -> bool
//   similar(c, v)      -> asemănarea medie a lui v cu membrii lui c
//   interp(v)          -> { pattern, fills } | null   (v ca aplicare: rescrierea principală)
//   children(v)        -> copiii lui v, sau null      (opțional; cu el, v se poate citi și ca alt tipar)
//   thetaAccept
// }
// partial: children poate fi mai scurt decât tiparul (prefix).
export function matchPattern(env, pid, children, { partial = false } = {}) {
  const p = env.pattern(pid);
  if (partial ? children.length > p.items.length : children.length !== p.items.length) return null;
  const bind = new Map();
  const newMembers = [];
  let fixed = 0;
  const put = (s, v) => {
    if (bind.has(s)) return bind.get(s) === v;
    const c = env.accepts(s);
    if (!env.isMember(c, v)) {
      if (env.similar(c, v) < env.thetaAccept) return false;
      newMembers.push([s, v]);
    }
    bind.set(s, v);
    return true;
  };
  for (let i = 0; i < children.length; i++) {
    const it = p.items[i], v = children[i];
    if (it.fixed !== undefined) {
      if (v !== it.fixed) return null;
      fixed++;
    } else if (it.slot !== undefined) {
      if (!put(it.slot, v)) return null;
    } else {
      const fills = interpretAs(env, v, it.sub);
      if (!fills) return null;
      for (let j = 0; j < it.args.length; j++) if (!put(it.args[j], fills[j])) return null;
      fixed++;
    }
  }
  return { pattern: pid, bind, fills: p.slots.map((s) => bind.get(s)), newMembers, fixed };
}

// cel mai bun dintre mai multe potriviri: cei mai puțini membri noi, cei mai mulți copii ficși, id mai mic
export function bestMatch(matches) {
  return matches.slice().sort((a, b) => a.newMembers.length - b.newMembers.length || b.fixed - a.fixed || a.pattern - b.pattern);
}

// v citit ca aplicare a tiparului q: rescrierea principală, sau (cu env.children și env.multiInterp)
// potrivirea directă a copiilor lui v cu q. Întoarce valorile locurilor lui q, sau null.
export function interpretAs(env, v, q) {
  const x = env.interp(v);
  if (x && x.pattern === q) return x.fills;
  if (!env.multiInterp || !env.children) return null;
  const ch = env.children(v);
  if (!ch) return null;
  const m = matchPattern(env, q, ch);
  return m ? m.fills : null;
}
