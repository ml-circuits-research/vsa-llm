// O trecere de somn: memorie + tampon -> pachet -> commit. Cât durează trecerea, memoria doar se citește.
import { PassContext } from './context.mjs';
import { recognize } from './recognize.mjs';
import { group } from './group.mjs';
import { propose } from './propose.mjs';
import { Judge } from './package.mjs';
import { total } from '../memory/size.mjs';
import { fail } from '../core/invariants.mjs';
import { LEVELS } from '../memory/store.mjs';

// opts.validate(mem) -> eroarea de predicție pe textul de validare (opțional)
export function sleepPass(mem, cfg, opts = {}) {
  const measure = cfg.measure ?? 'terms';
  const before = total(mem, measure);
  mem.beginPass();
  const ctx = new PassContext(mem, cfg);
  // opts.maxLevel: somnul doar pe nivelurile de jos (curriculumul pe niveluri, D17)
  for (let level = 1; level <= (opts.maxLevel ?? LEVELS); level++) {
    const units = [...new Set([...mem.buffer[level], ...mem.residue[level]])].filter((u) => mem.atoms[u].def.type === 'SEQ').sort((a, b) => a - b);
    ctx.seen[level] = units;
    if (!units.length) continue;
    const { rest } = recognize(ctx, units, level);
    const groups = group(ctx, rest, level);
    propose(ctx, groups, level);
  }
  const judge = new Judge(ctx);
  let { accepted, trace } = cfg.packageJudge === false ? judge.judgeOneByOne() : judge.judgePackage();
  let validation = null;
  if (opts.validate && cfg.validate !== false && accepted.size) {
    const res = validateSplit(mem, judge, accepted, opts.validate);
    accepted = res.accepted;
    validation = res.info;
  }
  // verificarea exactă (D5): estimarea judecății nu vede efectele globale ale măsurii în biți.
  // Pachetul se aplică pe o copie; dacă totalul real crește, iese propunerea cu cel mai mic câștig.
  let pkg = judge.build(accepted);
  let exactChecks = 0, removed = 0;
  for (;;) {
    if (!pkg.rewrites.length) break;
    const m = mem.clone();
    m.frozen = true;
    m.commit(pkg, { check: false });
    exactChecks++;
    if (total(m, measure) <= before + 1e-9) break;
    let worst = null, wg = Infinity;
    for (const p of judge.props) {
      if (!accepted.has(p.pattern)) continue;
      const g = judge.gain(p.pattern, accepted);
      if (g < wg - 1e-9) [wg, worst] = [g, p.pattern];
    }
    for (const x of judge.closure(worst, accepted)) accepted.delete(x);
    removed++;
    pkg = judge.build(accepted);
  }
  mem.commit(pkg);
  const after = total(mem, measure);
  if (after > before + 1e-9) fail('I8', `totalul a crescut: ${before} -> ${after}`);
  return {
    before,
    after,
    proposed: judge.props.length,
    accepted: accepted.size,
    newPatterns: pkg.newPatterns.length,
    newChoices: pkg.newChoices.length,
    rewrites: pkg.rewrites.length,
    trace,
    validation,
    exactChecks,
    removedByExactCheck: removed,
  };
}

// eroarea cu pachetul nu are voie să fie mai mare decât fără el; altfel pachetul se împarte în două
function validateSplit(mem, judge, accepted, validate) {
  const errOf = (A) => {
    const m = mem.clone();
    m.frozen = true;
    m.commit(judge.build(new Set(A)), { check: false });
    return validate(m);
  };
  const base = validate(mem);
  const info = { base, steps: [] };
  const closed = (list, kept) => {
    const s = new Set([...kept, ...list]);
    return list.filter((pid) => [...judge.byPid.get(pid).deps].every((d) => s.has(d)));
  };
  let kept = [];
  let keptErr = base;
  const tryAccept = (list) => {
    list = closed(list, kept);
    if (!list.length) return;
    const e = errOf([...kept, ...list]);
    info.steps.push({ size: list.length, err: e, ref: keptErr });
    if (e <= keptErr + 1e-12) {
      kept = [...kept, ...list];
      keptErr = e;
      return;
    }
    if (list.length === 1) return;
    const h = Math.ceil(list.length / 2);
    tryAccept(list.slice(0, h));
    tryAccept(list.slice(h));
  };
  tryAccept([...accepted].sort((a, b) => judge.byPid.get(a).order - judge.byPid.get(b).order));
  // după împărțire, câștigurile se rejudecă
  const { accepted: final } = judge.judgePackage(new Set(kept));
  info.final = keptErr;
  return { accepted: final, info };
}
