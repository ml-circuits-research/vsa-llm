// S1 (scalare, doar măsurătoare): cât durează fiecare parte pe TinyStories, la mărimi crescătoare,
// și ce exponent are creșterea (timp ~ N^a). Timpii nu intră în nicio decizie a sistemului.
import { runDir, writeResult } from '../run.mjs';
import { loadConfig } from '../../core/config.mjs';
import { Memory } from '../../memory/store.mjs';
import { ingest } from '../../wake/ingest.mjs';
import { tinySet } from '../../data/tinystories.mjs';
import { deepSleep } from '../../sleep/scheduler.mjs';
import { predError } from '../metrics.mjs';
import { stats } from '../../memory/size.mjs';

const now = () => performance.now();

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('S1');
  const sizes = base.sizes ? String(base.sizes).split('+').map(Number) : [1000, 3000, 10000];
  const variants = [
    ['somn fără validare, fără alternative', { alternatives: false }, false],
    ['somn complet (validare + alternative)', {}, true],
  ];
  const rows = [];
  for (const N of sizes) {
    const data = tinySet(N, { seed });
    for (const [label, over, validate] of variants) {
      const cfg = loadConfig({ seed, ...base, ...over });
      const mem = new Memory(cfg);
      let t = now();
      for (const d of data.train) ingest(mem, d.text, { mode: 'gpt2', docName: d.id });
      const tIngest = now() - t;
      const valDocs = data.val;
      t = now();
      const errBefore = predError(mem, cfg, valDocs);
      const tPredict = now() - t;
      t = now();
      const passes = deepSleep(mem, cfg, { validate: validate ? (m) => predError(m, cfg, valDocs) : undefined });
      const tSleep = now() - t;
      t = now();
      const errAfter = predError(mem, cfg, valDocs);
      const st = stats(mem, cfg.measure);
      rows.push({
        N: data.tokens, variant: label, trainDocs: data.train.length, valDocs: valDocs.length,
        valTokens: valDocs.reduce((s, d) => s + d.meta.tokens, 0),
        units: mem.unitCount(), patterns: st.patterns, choices: st.choices, passes: passes.length,
        seconds: { ingest: +(tIngest / 1000).toFixed(2), predictVal: +(tPredict / 1000).toFixed(2), sleep: +(tSleep / 1000).toFixed(2) },
        errBefore: +errBefore.toFixed(3), errAfter: +errAfter.toFixed(3),
      });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }
  // exponentul de creștere între cele mai mari două mărimi și extrapolarea la 100.000
  const fit = {};
  for (const [label] of variants) {
    const r = rows.filter((x) => x.variant === label);
    if (r.length < 2) continue;
    const [a, b] = r.slice(-2);
    fit[label] = {};
    for (const part of ['ingest', 'predictVal', 'sleep']) {
      const e = Math.log(b.seconds[part] / Math.max(1e-3, a.seconds[part])) / Math.log(b.N / a.N);
      fit[label][part] = { exponent: +e.toFixed(2), at100k: +(b.seconds[part] * Math.pow(100000 / b.N, e)).toFixed(0) };
    }
  }
  return writeResult(dir, {
    experiment: 'S1',
    question: 'Cât costă pe text adevărat, la mărimi crescătoare? (doar măsurătoare)',
    seed, rows, fit,
    note: 'timpii depind de mașină; extrapolarea folosește exponentul dintre ultimele două mărimi',
    decision: Object.entries(fit).map(([k, v]) => `${k}: la 100k ≈ citire ${v.ingest.at100k} s, predicție pe validare ${v.predictVal.at100k} s, somn ${v.sleep.at100k} s (exponenți ${v.ingest.exponent}/${v.predictVal.exponent}/${v.sleep.exponent})`).join('; '),
  });
}
