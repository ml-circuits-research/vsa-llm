import { trainSimple } from '../../src/eval/run.mjs';
import { PassContext } from '../../src/sleep/context.mjs';
import { candidateGroups } from '../../src/sleep/group.mjs';
import { proposeGroup } from '../../src/sleep/propose.mjs';
import { Judge } from '../../src/sleep/package.mjs';
import { total } from '../../src/memory/size.mjs';
const r = trainSimple({ set: process.env.SET ?? 'GBLIND', seed: 1, overrides: { levelCurriculum: true, ...JSON.parse(process.env.OV ?? '{}') } });
const m = r.mem, cfg = r.cfg;
const bl = m.byLevel(4);
const units = [...bl.SEQ, ...bl.APP].sort((a, b) => a - b);
console.log('unități L4', units.length, 'SEQ', bl.SEQ.length, 'APP', bl.APP.length, 'exemplu copii', m.children(units[0]).map((c) => m.text(c)).join(' | '));
const ctx0 = new PassContext(m, cfg);
const cands = candidateGroups(ctx0, units, 4);
console.log('grupuri candidate', cands.length);
const nm = (id) => (id < 0 ? 'nou' + id : m.isToken(id) ? m.atoms[id].text : m.atoms[id].def?.type === 'PATTERN' ? 'P' + id : m.atoms[id].def?.type === 'PCLASS' ? 'M' + id : '"' + m.text(id) + '"');
for (const g of cands.filter((g) => g.abstract).sort((a, b) => b.units.length - a.units.length).slice(0, 8)) {
  m.beginPass();
  const ctx = new PassContext(m, cfg);
  const pid = proposeGroup(ctx, g, 4);
  if (pid === null) { console.log(`  ${g.units.length}u abs=${!!g.abstract} F=${g.F}: propunere eșuată`); m.frozen = false; continue; }
  const d = ctx.pattern(pid);
  const J = new Judge(ctx);
  const A = new Set(J.props.map((p) => p.pattern));
  const pkg = J.build(new Set(A));
  const c = m.clone(); c.frozen = true; c.commit(pkg, { check: false });
  console.log(`  ${g.units.length}u abs=${!!g.abstract} F=${g.F}:`, d.items.map((it) => (it.fixed !== undefined ? nm(it.fixed) : it.slot !== undefined ? 'S' + it.slot : nm(it.sub) + `(${it.args.join(',')}${it.form !== undefined ? ';f' : ''})`)).join(' '), 'câștig exact', (total(m, cfg.measure) - total(c, cfg.measure)).toFixed(1), 'estimat', J.gain(pid, A).toFixed(1));
  m.frozen = false;
}
