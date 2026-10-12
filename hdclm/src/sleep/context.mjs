// Contextul unei treceri de somn: memoria (înghețată) plus propunerile adunate până acum.
// Id-urile negative sunt atomi propuși (alegeri, tipare, locuri), care există doar în pachet.
import { ExactSim } from '../memory/similarity.mjs';

export class PassContext {
  constructor(mem, cfg) {
    this.mem = mem;
    this.cfg = cfg;
    this.nextRef = -1;
    this.choices = new Map(); // ref negativ -> { ref, level, current: Map(valoare -> pondere) }
    this.patterns = new Map(); // ref negativ -> { ref, level, items, slots, structs: [{tmp, accepts}] }
    this.structs = new Map(); // ref negativ -> accepts
    this.proposals = new Map(); // ref tipar -> { pattern, isNew, level, units: Map(u -> fills), deps: Set, order }
    this.rewriteOf = new Map(); // unitate -> ref tipar
    this.alternatives = new Map();
    this.seen = {};
    this.extraMembers = new Map(); // memorie neînghețată (A4): membri noi vizibili imediat
    this.extraChoices = new Map();
    this.sim = new ExactSim(ExactSim.memorySource(mem, cfg.freeze === false ? this.extraChoices : null), cfg.w);
    this.memChoiceAdds = new Map(); // alegere din memorie -> Map(valoare -> pondere) propuse
    this.shadows = {}; // nivel -> toate grupurile valide (și cele pierdute la atribuirea lacomă)
    this.locked = new Set(); // unități ridicate deja într-un tipar de deasupra: nu mai trec la altul
    this.switched = 0;
  }
  ref() {
    return this.nextRef--;
  }
  pattern(pid) {
    return pid < 0 ? this.patterns.get(pid) : this.mem.atoms[pid].def;
  }
  accepts(s) {
    return s < 0 ? this.structs.get(s) : this.mem.atoms[s].accepts;
  }
  // membrii unei alegeri pentru recunoaștere: cei din memorie (înghețată)
  isMember(c, v) {
    if (c < 0) return this.choices.get(c).current.has(v);
    if (this.mem.atoms[c].def.members.has(v)) return true;
    return this.cfg.freeze === false && !!this.extraMembers.get(c)?.has(v);
  }
  memberList(c) {
    if (c < 0) return [...this.choices.get(c).current.keys()];
    const base = [...this.mem.atoms[c].def.members.keys()];
    if (this.cfg.freeze === false && this.extraMembers.get(c)) return [...new Set([...base, ...this.extraMembers.get(c)])];
    return base;
  }
  similar(c, v) {
    const ms = this.memberList(c);
    if (!ms.length) return 0;
    let s = 0;
    for (const m of ms) s += this.sim.simC(m, v); // alegerile se judecă pe comp / simC (greșeala 3)
    return s / ms.length;
  }
  // valoarea v ca aplicare: rescrierea propusă în această trecere sau definiția din memorie
  interp(v) {
    const r = this.rewriteOf.get(v);
    if (r !== undefined) return { pattern: r, fills: this.proposals.get(r).units.get(v) };
    const d = this.mem.atoms[v]?.def;
    return d?.type === 'APP' ? { pattern: d.pattern, fills: d.fills } : null;
  }
  env() {
    return {
      pattern: (p) => this.pattern(p),
      accepts: (s) => this.accepts(s),
      isMember: (c, v) => this.isMember(c, v),
      similar: (c, v) => this.similar(c, v),
      interp: (v) => this.interp(v),
      thetaAccept: this.cfg.theta_accept,
    };
  }
  // membrii curenți ai unei alegeri (memorie + tot ce s-a propus), pentru decizia de contopire
  currentMembers(c) {
    if (c < 0) return this.choices.get(c).current;
    const m = new Map(this.mem.atoms[c].def.members);
    for (const [v, w] of this.memChoiceAdds.get(c) ?? []) m.set(v, (m.get(v) ?? 0) + w);
    return m;
  }
  addToChoice(c, v, w = 1) {
    if (c < 0) {
      const cur = this.choices.get(c).current;
      cur.set(v, (cur.get(v) ?? 0) + w);
    } else {
      let m = this.memChoiceAdds.get(c);
      if (!m) this.memChoiceAdds.set(c, (m = new Map()));
      m.set(v, (m.get(v) ?? 0) + w);
      if (this.cfg.freeze === false && !this.mem.atoms[c].def.members.has(v)) {
        let e = this.extraMembers.get(c);
        if (!e) this.extraMembers.set(c, (e = new Set()));
        e.add(v);
        let ec = this.extraChoices.get(v);
        if (!ec) this.extraChoices.set(v, (ec = []));
        if (!ec.includes(c)) {
          ec.push(c);
          this.sim.cC.clear(); // memoria „neînghețată”: asemănările se schimbă în timpul trecerii
          this.sim.cE.clear();
        }
      }
    }
  }
  proposal(pid, isNew, level) {
    let p = this.proposals.get(pid);
    if (!p) this.proposals.set(pid, (p = { pattern: pid, isNew, level, units: new Map(), deps: new Set(), order: this.proposals.size }));
    return p;
  }
  addRewrite(pid, unit, fills, deps = []) {
    const pr = this.proposals.get(pid);
    pr.units.set(unit, fills);
    for (const d of deps) if (d !== pid) pr.deps.add(d);
    this.rewriteOf.set(unit, pid);
    const pat = this.pattern(pid);
    pat.slots.forEach((s, i) => this.addToChoice(this.accepts(s), fills[i]));
  }
}
