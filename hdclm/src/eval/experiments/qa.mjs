// A5–A7: răspunsul la o întrebare, din faptele de alături
import { runDir, trainSimple, writeResult } from '../run.mjs';
import { answerAccuracy, describe, total } from '../metrics.mjs';

export function qa({ base, name, set, question, variants, threshold, seed = 1, groupBy = null }) {
  const dir = runDir(name);
  const res = {};
  for (const [label, overrides, splitOpts = {}] of variants) {
    const noSleep = trainSimple({ base, set, seed, overrides, splitOpts, sleep: false });
    const r = trainSimple({ base, set, seed, overrides, splitOpts, dir: label === variants[0][0] ? dir : null });
    const held = r.split.test.filter((d) => d.heldout);
    const a = answerAccuracy(r.mem, r.cfg, held);
    const a0 = answerAccuracy(noSleep.mem, noSleep.cfg, held);
    const v = answerAccuracy(r.mem, r.cfg, r.split.val.filter((d) => d.heldout));
    const desc = describe(r.mem);
    const entry = {
      overrides,
      splitOpts,
      train: r.split.train.length,
      testHeldout: held.length,
      totalBefore: r.before.total,
      totalAfter: total(r.mem, r.cfg.measure),
      reconstruction: r.recon,
      patternsByLevel: desc.patterns.reduce((m, p) => ((m[p.level] = (m[p.level] ?? 0) + 1), m), {}),
      rules: desc.patterns.filter((p) => p.level >= 4).map((p) => p.text),
      accNoSleep: a0.acc,
      accSleep: a.acc,
      accValSleep: v.acc,
      failures: a.rows.filter((x) => !x.ok).map((x) => ({ id: x.id, answer: x.answer, top: x.top, p: x.p })),
    };
    if (groupBy) {
      entry.byGroup = {};
      for (const row of a.rows) {
        const k = row.meta[groupBy];
        const g = (entry.byGroup[k] ??= { n: 0, ok: 0 });
        g.n++;
        if (row.ok) g.ok++;
      }
      for (const g of Object.values(entry.byGroup)) g.acc = g.ok / g.n;
    }
    res[label] = entry;
  }
  return writeResult(dir, { experiment: name, question, seed, threshold, results: res });
}
