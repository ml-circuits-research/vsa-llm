// Somnul adânc: înlocuirea rescrierii principale cu o alternativă, dacă totalul scade (secțiunea 6, 10).
// Se grupează din nou toate unitățile de pe un nivel, inclusiv cele deja rescrise. Fiecare grup se judecă
// singur, peste memoria de acum; se păstrează cel cu cel mai mare câștig, dacă este > 0.
// Nu se mută unitățile cuibărite într-o regulă (copii pe o poziție `sub` a unei aplicări).
import { PassContext } from './context.mjs';
import { candidateGroups } from './group.mjs';
import { propose } from './propose.mjs';
import { Judge } from './package.mjs';
import { total } from '../memory/size.mjs';
import { fail } from '../core/invariants.mjs';
import { LEVELS } from '../memory/store.mjs';
import { sleepPass } from './pass.mjs';

function nested(mem, u) {
  return mem.parents(u).some(([p, pos]) => {
    const d = mem.atoms[p].def;
    return d.type === 'APP' && mem.atoms[d.pattern].def.items[pos].sub !== undefined;
  });
}

// grupul doar reface tiparul pe care unitățile îl au deja
function reproduces(mem, g) {
  const d0 = mem.atoms[g.units[0]].def;
  if (d0.type !== 'APP') return false;
  if (!g.units.every((u) => mem.atoms[u].def.type === 'APP' && mem.atoms[u].def.pattern === d0.pattern)) return false;
  const items = mem.atoms[d0.pattern].def.items;
  const free = items.map((it, i) => (it.fixed === undefined ? i : -1)).filter((i) => i >= 0);
  return free.length === g.F.length && free.every((x, i) => x === g.F[i]);
}

export function alternativePass(mem, cfg) {
  const measure = cfg.measure ?? 'terms';
  const before = total(mem, measure);
  mem.beginPass();
  let best = null;
  const tried = [];
  for (let level = 1; level <= LEVELS; level++) {
    const bl = mem.byLevel(level);
    const units = [...bl.SEQ, ...bl.APP].filter((u) => !nested(mem, u)).sort((a, b) => a - b);
    if (units.length < 2) continue;
    const probe = new PassContext(mem, cfg);
    const cands = candidateGroups(probe, units, level)
      .filter((g) => !reproduces(mem, g) && g.units.some((u) => mem.atoms[u].def.type === 'APP'))
      .slice(0, cfg.altCandidates ?? 200);
    for (const g of cands) {
      const ctx = new PassContext(mem, cfg);
      ctx.seen = {};
      propose(ctx, [g], level);
      if (!ctx.proposals.size) continue;
      const judge = new Judge(ctx);
      // nu se filtrează după estimarea judecății (în biți nu e exactă): decide totalul real, mai jos
      const accepted = new Set(judge.props.map((p) => p.pattern));
      // câștigul real, pe forma exactă: o copie a memoriei, cu pachetul aplicat
      const pkg = judge.build(new Set(accepted));
      if (!pkg.rewrites.length) continue;
      const m = mem.clone();
      m.frozen = true;
      m.commit(pkg, { check: false });
      // cu privire înainte: o trecere obișnuită pe copie arată ce se mai formează deasupra
      if (cfg.altLookahead) sleepPass(m, cfg);
      const gain = before - total(m, measure);
      tried.push({ level, key: g.key, size: g.units.length, gain });
      if (gain > 1e-9 && (!best || gain > best.gain + 1e-9)) best = { gain, pkg, key: g.key, level };
    }
  }
  if (!best) {
    mem.frozen = false;
    return { before, after: before, changed: false, tried: tried.length };
  }
  if (cfg.altLookahead) {
    // se aplică pachetul, apoi trecerea pe care a văzut-o privirea înainte
    mem.commit(best.pkg);
    sleepPass(mem, cfg);
  } else mem.commit(best.pkg);
  const after = total(mem, measure);
  if (after > before + 1e-9) fail('I8', `totalul a crescut: ${before} -> ${after}`);
  return { before, after, changed: true, key: best.key, level: best.level, gain: best.gain, tried: tried.length };
}
