// Când rulează somnul: ușor (tamponul are W unități), adânc (după N_deep somnuri ușoare, sau la cerere).
// Firele de execuție nu sunt implementate încă (pasul 8).
import { sleepPass } from './pass.mjs';
import { alternativePass } from './alternatives.mjs';
import { conceptPass } from './concepts.mjs';
import { typePass } from './types.mjs';
import { inductionPass } from './induction.mjs';
import { stats } from '../memory/size.mjs';
import { LEVELS } from '../memory/store.mjs';

export function deepSleep(mem, cfg, opts = {}) {
  const passes = [];
  const max = cfg.maxDeepPasses ?? 20;
  let conceptsDone = false;
  let conceptRounds = 0;
  let typeRounds = 0;
  let inductionDone = 0;
  // curriculumul pe niveluri (D17): întâi propozițiile (nivelurile ≤ 3), apoi conceptele din ele, apoi restul
  if (cfg.concepts && cfg.conceptsFirst) {
    for (let i = 0; i < max; i++) {
      const r = sleepPass(mem, cfg, { ...opts, maxLevel: 3 });
      const rec = { pass: i + 1, kind: 'deep≤3', ...stats(mem, cfg.measure), before: r.before };
      passes.push(rec);
      opts.log?.(rec);
      if (r.after < r.before - 1e-9) continue;
      // formele generale (mai multe locuri) apar prin alternative, înaintea conceptelor
      if (!cfg.alternatives) break;
      const a = alternativePass(mem, cfg, { maxLevel: 3 });
      passes.push({ pass: i + 1, kind: 'alternative≤3', ...stats(mem, cfg.measure), changed: a.changed, gain: a.gain ?? 0 });
      if (!a.changed) break;
    }
    conceptsDone = true;
    const c = conceptPass(mem, cfg);
    const crec = { pass: 0, kind: 'concepts', ...stats(mem, cfg.measure), ...c };
    passes.push(crec);
    opts.log?.(crec);
  }
  for (let i = 0; i < max; i++) {
    // V3 (D16): validarea rulează în toate trecerile ('all'), doar în prima trecere a somnului adânc ('first')
    // sau deloc ('none')
    const mode = cfg.validateMode ?? 'all';
    const useVal = mode === 'all' || (mode === 'first' && i === 0);
    const r = sleepPass(mem, cfg, useVal ? opts : { ...opts, validate: undefined });
    const st = stats(mem, cfg.measure);
    const rec = { pass: i + 1, kind: 'deep', ...st, before: r.before, proposed: r.proposed, accepted: r.accepted, newPatterns: r.newPatterns, rewrites: r.rewrites };
    if (r.validation) rec.validation = { base: r.validation.base, final: r.validation.final };
    passes.push(rec);
    opts.log?.(rec);
    if (r.after < r.before - 1e-9) continue;
    // trecerile obișnuite nu mai scad totalul: se încearcă interpretările alternative
    if (!cfg.alternatives) break;
    const a = alternativePass(mem, cfg);
    const arec = { pass: i + 1, kind: 'alternative', ...stats(mem, cfg.measure), before: a.before, changed: a.changed, group: a.key ?? null, gain: a.gain ?? 0, tried: a.tried };
    passes.push(arec);
    opts.log?.(arec);
    if (a.changed) continue;
    // nici alternativele nu mai schimbă nimic: trecerea de concepte (D17), de cel mult cfg.conceptRounds ori;
    // dacă a creat ceva, somnul continuă, ca regulile să poată folosi conceptele noi
    if (cfg.concepts && conceptRounds < (cfg.conceptRounds ?? 2)) {
      conceptRounds++;
      const c = conceptPass(mem, cfg);
      const crec = { pass: i + 1, kind: 'concepts', ...stats(mem, cfg.measure), ...c };
      passes.push(crec);
      opts.log?.(crec);
      if (c.changed) continue;
    }
    // inducția (D19): ipotezele care cuprind o clasă confirmată se testează prin consecințe, de cel mult două ori
    if (cfg.concepts && cfg.induction && inductionDone < 2) {
      inductionDone++;
      const t = inductionPass(mem, cfg, { validate: opts.validate });
      const irec = { pass: i + 1, kind: 'induction', ...stats(mem, cfg.measure), changed: t.changed, accepted: t.accepted, tried: t.tried };
      passes.push(irec);
      opts.log?.(irec);
      if (t.changed) continue;
    }
    // apoi tipurile locurilor (D18): alegeri de aplicări -> alegeri tipizate, de cel mult cfg.typeRounds ori
    if (cfg.slotTypes && typeRounds < (cfg.typeRounds ?? 2)) {
      typeRounds++;
      const t = typePass(mem, cfg, { validate: opts.validate });
      const trec = { pass: i + 1, kind: 'types', ...stats(mem, cfg.measure), changed: t.changed, retyped: t.retyped };
      passes.push(trec);
      opts.log?.(trec);
      if (t.changed) continue;
    }
    break;
  }
  return passes;
}

export function bufferSize(mem) {
  let n = 0;
  for (let l = 1; l <= LEVELS; l++) n += mem.buffer[l].length;
  return n;
}

// citește documentele pe rând; somn ușor la W unități noi, adânc după N_deep somnuri ușoare; la sfârșit, adânc
export function learn(mem, cfg, docs, ingestFn, opts = {}) {
  const log = [];
  let light = 0;
  const W = cfg.W === null || cfg.W === 'inf' ? Infinity : cfg.W;
  for (const d of docs) {
    ingestFn(mem, d);
    if (bufferSize(mem) >= W) {
      const r = sleepPass(mem, cfg, opts);
      const rec = { kind: 'light', ...stats(mem, cfg.measure), before: r.before };
      log.push(rec);
      opts.log?.(rec);
      if (++light % cfg.N_deep === 0) log.push(...deepSleep(mem, cfg, opts));
    }
  }
  log.push(...deepSleep(mem, cfg, opts));
  return log;
}
