// Când rulează somnul: ușor (tamponul are W unități), adânc (după N_deep somnuri ușoare, sau la cerere).
// Firele de execuție nu sunt implementate încă (pasul 8).
import { sleepPass } from './pass.mjs';
import { alternativePass } from './alternatives.mjs';
import { stats } from '../memory/size.mjs';
import { LEVELS } from '../memory/store.mjs';

export function deepSleep(mem, cfg, opts = {}) {
  const passes = [];
  const max = cfg.maxDeepPasses ?? 20;
  for (let i = 0; i < max; i++) {
    const r = sleepPass(mem, cfg, opts);
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
    if (!a.changed) break;
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
