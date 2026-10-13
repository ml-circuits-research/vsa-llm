// Pasul 1: potrivirea unităților cu tiparele cunoscute de pe nivelul lor, cu același număr de copii.
import { matchPattern, bestMatch } from '../memory/match.mjs';

export function recognize(ctx, units, level) {
  const mem = ctx.mem;
  const pats = mem.livePatterns(level);
  const byLen = new Map();
  for (const p of pats) {
    const n = mem.atoms[p].def.items.length;
    if (!byLen.has(n)) byLen.set(n, []);
    byLen.get(n).push(p);
  }
  const env = ctx.env();
  const matched = [], rest = [];
  for (const u of units) {
    const ch = mem.children(u);
    const ms = [];
    for (const p of byLen.get(ch.length) ?? []) {
      const m = matchPattern(env, p, ch);
      if (m) ms.push(m);
    }
    if (!ms.length) {
      rest.push(u);
      continue;
    }
    const [best, ...others] = bestMatch(ms);
    ctx.proposal(best.pattern, false, level);
    const deps = [];
    mem.atoms[best.pattern].def.items.forEach((it, i) => {
      if (it.sub !== undefined && ctx.rewriteOf.has(ch[i])) deps.push(ctx.rewriteOf.get(ch[i]));
    });
    ctx.addRewrite(best.pattern, u, best.fills, deps);
    if (others.length) ctx.alternatives.set(u, others.map((m) => ({ pattern: m.pattern, fills: m.fills })));
    matched.push(u);
  }
  return { matched, rest };
}
