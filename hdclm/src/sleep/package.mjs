// Pasul 4: judecata pachetului. Un tipar rămâne numai dacă scurtează memoria (câștig > 0),
// socotit împreună cu tot pachetul; scoaterea unui tipar scoate și tot ce depinde de el.
import { defSize, bitsContext, parseMix } from '../memory/size.mjs';
import { slotValues } from './context.mjs';

const EPS = 1e-9;

export class Judge {
  constructor(ctx) {
    this.ctx = ctx;
    this.mem = ctx.mem;
    this.measure = ctx.cfg.measure ?? 'terms';
    this.props = [...ctx.proposals.values()].sort((a, b) => a.order - b.order);
    this.byPid = new Map(this.props.map((p) => [p.pattern, p]));
    // cine depinde de cine
    this.dependents = new Map(this.props.map((p) => [p.pattern, new Set()]));
    for (const p of this.props) for (const d of p.deps) this.dependents.get(d)?.add(p.pattern);
    // contribuțiile fiecărei propuneri la alegeri
    this.contrib = new Map();
    for (const p of this.props) {
      const m = new Map();
      for (const fills of p.units.values())
        for (const [c, v] of slotValues(ctx, p.pattern, fills)) {
          if (!m.has(c)) m.set(c, new Map());
          const cm = m.get(c);
          cm.set(v, (cm.get(v) ?? 0) + 1);
        }
      this.contrib.set(p.pattern, m);
    }
    this.bctx = this.measure !== 'terms' ? bitsContext(this.mem, { atoms: 0, patterns: ctx.patterns.size }) : null;
  }

  closure(pid, within) {
    const out = new Set([pid]);
    const stack = [pid];
    while (stack.length) for (const d of this.dependents.get(stack.pop()) ?? []) if (within.has(d) && !out.has(d)) {
      out.add(d);
      stack.push(d);
    }
    return out;
  }

  members(c, A) {
    const base = c < 0 ? new Map() : this.mem.atoms[c].def.members;
    const out = new Map(base);
    for (const pid of A) for (const [v, w] of this.contrib.get(pid).get(c) ?? []) out.set(v, (out.get(v) ?? 0) + w);
    return out;
  }

  view(A) {
    const ctx = this.ctx, mem = this.mem;
    const memo = new Map();
    const v = {
      def: (id) => {
        const r = ctx.rewriteOf.get(id);
        if (r !== undefined && A.has(r)) return { type: 'APP', pattern: r, fills: this.byPid.get(r).units.get(id) };
        return mem.atoms[id].def;
      },
      atom: (id) => (id < 0 ? { accepts: ctx.structs.get(id) } : mem.atoms[id]),
      parents: (id) => mem.parents(id),
      isRoot: (id) => mem.roots.has(id),
      members: (c) => {
        if (!memo.has(c)) memo.set(c, this.members(c, A));
        return memo.get(c);
      },
      // alegere tipizată (D18): valorile acoperite de tipuri, plus membrii direcți adăugați
      card: (c) => {
        if (!(c > 0 && mem.atoms[c].def.typed)) return v.members(c).size;
        return mem.choiceCard(c) + v.members(c).size - mem.atoms[c].def.members.size;
      },
      pattern: (p) => ctx.pattern(p),
    };
    return v;
  }

  region(R) {
    const units = new Set(), choices = new Set(), old = new Set();
    for (const pid of R) {
      const p = this.byPid.get(pid);
      for (const u of p.units.keys()) {
        units.add(u);
        for (const c of this.mem.children(u)) if (this.mem.isUnit(c)) units.add(c);
        // o unitate deja rescrisă care trece la alt tipar: tiparul ei vechi poate rămâne fără aplicări
        const d = this.mem.atoms[u].def;
        if (d.type === 'APP' && d.pattern !== pid) {
          old.add(d.pattern);
          for (const st of this.mem.atoms[d.pattern].def.slots) choices.add(this.mem.atoms[st].accepts);
        }
      }
      for (const c of this.contrib.get(pid).keys()) choices.add(c);
    }
    // clasele de tipare cuibărite de tiparele din R (noi sau din memorie cu membri adăugați)
    const classes = new Set();
    for (const pid of R) for (const it of this.ctx.pattern(pid).items) if (it.sub !== undefined && this.ctx.pattern(it.sub).type === 'PCLASS') classes.add(it.sub);
    return { units, choices, patterns: [...R].filter((pid) => this.byPid.get(pid).isNew), old: [...old], classes: [...classes] };
  }

  // aplicările unui tipar din memorie, după ce propunerile din A își iau unitățile
  liveUsage(p, A) {
    let n = this.mem.usage(p);
    for (const pid of A) {
      if (pid === p) continue;
      for (const u of this.byPid.get(pid).units.keys()) if (this.mem.atoms[u].def.type === 'APP' && this.mem.atoms[u].def.pattern === p) n--;
    }
    return n;
  }

  cost(reg, A, measure = this.measure) {
    const alpha = parseMix(measure);
    if (alpha !== null) return alpha * this.cost(reg, A, 'terms') + ((1 - alpha) * this.cost(reg, A, 'bits')) / Math.log2(Math.max(2, this.bctx.V));
    const v = this.view(A);
    let t = 0;
    for (const u of reg.units) t += defSize(v, u, measure, this.bctx);
    for (const pid of reg.patterns) if (A.has(pid)) t += this.patternSize(pid, measure);
    for (const p of reg.old) if (this.liveUsage(p, A) > 0) t += this.patternSize(p, measure);
    for (const c of reg.classes ?? []) if (this.classUsed(c, A)) t += this.classSize(c, measure);
    for (const c of reg.choices) {
      const ms = v.members(c);
      const users = c > 0 ? this.mem.choiceUsers().get(c) ?? [] : [];
      const exists = users.some((p) => this.liveUsage(p, A) > 0) || [...A].some((pid) => this.contrib.get(pid).has(c));
      if (exists) t += measure === 'terms' ? ms.size : ms.size * Math.log2(Math.max(2, this.bctx.V));
    }
    return t;
  }

  // o clasă nouă costă dacă o folosește un tipar acceptat; una din memorie costă doar membrii adăugați
  classUsed(c, A) {
    for (const pid of A) for (const it of this.ctx.pattern(pid).items) if (it.sub === c) return true;
    return false;
  }
  classSize(c, measure = this.measure) {
    const d = this.ctx.pattern(c);
    const n = c < 0 ? d.members.length + d.roles.length : this.ctx.classAdds.get(c)?.size ?? 0;
    return measure === 'terms' ? n : n * Math.log2(Math.max(2, this.bctx.V));
  }

  patternSize(pid, measure = this.measure) {
    const d = this.ctx.pattern(pid);
    const extra = (it) => (it.args ? it.args.length : 0) + (it.form !== undefined ? 1 : 0);
    if (measure === 'terms') return d.items.length + d.items.reduce((s, it) => s + extra(it), 0);
    const lg = (n) => Math.log2(Math.max(2, n));
    return d.items.reduce((s, it) => s + (it.sub !== undefined ? lg(this.bctx.P) + extra(it) * lg(this.bctx.V) : lg(this.bctx.V)), 0);
  }

  gain(pid, A) {
    const R = this.closure(pid, A);
    const reg = this.region(R);
    const without = new Set([...A].filter((x) => !R.has(x)));
    return this.cost(reg, without) - this.cost(reg, A);
  }

  // judecata în pachet: se scoate pe rând tiparul cu cel mai mic câștig, cât timp acesta este <= 0
  judgePackage(A = new Set(this.props.map((p) => p.pattern))) {
    A = new Set(A);
    const trace = [];
    for (;;) {
      let worst = null, wg = Infinity;
      for (const p of this.props) {
        if (!A.has(p.pattern)) continue;
        const g = this.gain(p.pattern, A);
        if (g < wg - EPS) {
          wg = g;
          worst = p.pattern;
        }
      }
      if (worst === null || wg > EPS) break;
      const R = this.closure(worst, A);
      for (const x of R) A.delete(x);
      trace.push({ removed: [...R], gain: wg });
    }
    return { accepted: A, trace };
  }

  // acceptare una câte una (experimentul A2): fiecare tipar judecat singur, peste ce s-a acceptat deja
  judgeOneByOne() {
    const A = new Set();
    for (const p of this.props) {
      if (![...p.deps].every((d) => A.has(d))) continue;
      const B = new Set([...A, p.pattern]);
      const reg = this.region(new Set([p.pattern]));
      if (this.cost(reg, A) - this.cost(reg, B) > EPS) A.add(p.pattern);
    }
    return { accepted: A, trace: [] };
  }

  // pachetul pentru commit, din propunerile acceptate
  build(A) {
    const ctx = this.ctx;
    // o alegere nouă cu mai puțin de 2 membri nu poate exista: se scot propunerile care o folosesc
    for (;;) {
      let bad = null;
      for (const c of ctx.choices.keys()) {
        const used = [...A].some((pid) => this.contrib.get(pid).has(c));
        if (used && this.members(c, A).size < 2) {
          bad = c;
          break;
        }
      }
      if (bad === null) break;
      for (const pid of [...A]) if (A.has(pid) && this.contrib.get(pid).has(bad)) for (const x of this.closure(pid, A)) A.delete(x);
    }
    const pkg = { newChoices: [], addMembers: [], newPatterns: [], rewrites: [], seen: ctx.seen, alternatives: [...ctx.alternatives] };
    const usedChoices = new Set();
    for (const pid of A) for (const c of this.contrib.get(pid).keys()) usedChoices.add(c);
    for (const c of [...usedChoices].sort((a, b) => b - a)) {
      const ms = new Map();
      for (const pid of A) for (const [v, w] of this.contrib.get(pid).get(c) ?? []) ms.set(v, (ms.get(v) ?? 0) + w);
      if (c < 0) pkg.newChoices.push({ tmp: c, level: ctx.choices.get(c).level, members: [...ms].sort((a, b) => a[0] - b[0]) });
      else pkg.addMembers.push({ choice: c, members: [...ms].sort((a, b) => a[0] - b[0]) });
    }
    pkg.newChoices.sort((a, b) => b.tmp - a.tmp);
    for (const p of this.props) {
      if (!A.has(p.pattern)) continue;
      if (p.isNew) {
        const d = ctx.patterns.get(p.pattern);
        pkg.newPatterns.push({ tmp: d.ref, level: d.level, items: d.items, slots: d.slots, structs: d.structs });
      }
      for (const [u, fills] of [...p.units].sort((a, b) => a[0] - b[0])) pkg.rewrites.push({ unit: u, pattern: p.pattern, fills });
    }
    // tiparele noi în ordinea în care se cuibăresc: un tipar după cele pe care le folosește
    pkg.newPatterns.sort((a, b) => b.tmp - a.tmp);
    // clasele de tipare folosite de tiparele acceptate
    pkg.newClasses = [];
    pkg.classAdds = [];
    const used = new Set();
    for (const p of this.props) if (A.has(p.pattern)) for (const it of ctx.pattern(p.pattern).items) if (it.sub !== undefined && ctx.pattern(it.sub).type === 'PCLASS') used.add(it.sub);
    for (const c of [...used].sort((a, b) => b - a)) {
      const d = ctx.pattern(c);
      if (c < 0)
        pkg.newClasses.push({ tmp: c, level: d.level, members: d.members.slice(), roles: d.roles.map((r) => ({ tmp: r, accepts: ctx.structs.get(r) })), align: Object.entries(d.align).map(([m, al]) => [Number(m), al]) });
      else if (ctx.classAdds.has(c)) pkg.classAdds.push({ cls: c, align: [...ctx.classAdds.get(c)].map(([m, al]) => [m, al]) });
    }
    return pkg;
  }
}
