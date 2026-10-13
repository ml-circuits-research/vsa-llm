// Memoria: forma exactă. Singurul modul care scrie, prin intern (veghe) și commit (somn).
import { checkInvariants, InvariantError, fail } from '../core/invariants.mjs';

export const LEVELS = 5;
const levels = (f) => Array.from({ length: LEVELS + 1 }, f);

export class Memory {
  constructor(config = {}) {
    this.config = config;
    this.K = config.K ?? 16;
    this.atoms = [null]; // id 0 nu se folosește
    this.tokenIndex = new Map(); // text -> id
    this.internIndex = new Map(); // "c1,c2,..." -> id
    this.parentIndex = new Map(); // id -> [[părinte, poziție], ...]
    this.version = 0;
    this.buffer = levels(() => []);
    this.residue = levels(() => []);
    this.single = levels(() => new Map()); // unități cu un singur copil, care nu se creează: nivel -> copil -> de câte ori
    this.childFreq = levels(() => new Map()); // nivel -> atom -> de câte ori a fost copil pe nivelul acesta
    this.roots = new Map(); // documente: id -> de câte ori
    this.docsRead = [];
    this.alternatives = new Map();
    this.frozen = false;
    this._maxUnits = 0;
    this._clearCaches();
  }

  _clearCaches() {
    this._children = new Map();
    this._unfold = new Map();
    this._byLevel = null;
    this._usage = null;
    this._choiceUsers = null;
    this._live = null;
    this._classesOf = null;
    this._typeUsers = null;
  }

  _write(what) {
    if (this.frozen) throw new InvariantError('I7', `scriere (${what}) în timpul unei treceri de somn`);
  }

  atom(id) {
    const a = this.atoms[id];
    if (!a) throw new Error(`atom necunoscut ${id}`);
    return a;
  }
  has(id) {
    return id > 0 && id < this.atoms.length;
  }
  isToken(id) {
    return this.atoms[id]?.kind === 'TOKEN';
  }
  isUnit(id) {
    const t = this.atoms[id]?.def?.type;
    return t === 'SEQ' || t === 'APP';
  }
  def(id) {
    return this.atoms[id].def;
  }
  level(id) {
    const a = this.atoms[id];
    return a.kind === 'TOKEN' ? 0 : a.level;
  }

  // ---------- veghe ----------
  token(text) {
    let id = this.tokenIndex.get(text);
    if (id !== undefined) return id;
    this._write('token');
    id = this.atoms.length;
    this.atoms.push({ id, kind: 'TOKEN', text, choices: [] });
    this.tokenIndex.set(text, id);
    return id;
  }
  tokenId(text) {
    return this.tokenIndex.get(text);
  }

  lookup(items) {
    return this.internIndex.get(items.join(','));
  }

  // intern({type:'SEQ', items}, level): id-ul unității cu acești copii; o creează doar dacă nu există.
  intern(def, level) {
    if (def.type !== 'SEQ') throw new Error('intern primește doar înșiruiri');
    const items = def.items;
    if (items.length < 1 || items.length > this.K) fail('I4', `înșiruire cu ${items.length} copii`);
    const key = items.join(',');
    const ex = this.internIndex.get(key);
    if (ex !== undefined) return { id: ex, isNew: false };
    this._write('intern');
    for (const c of items) if (!this.has(c)) throw new Error(`copil necunoscut ${c}`);
    const id = this.atoms.length;
    this.atoms.push({ id, kind: 'SENSE', level, def: { type: 'SEQ', items: items.slice() }, count: 0, choices: [] });
    this.internIndex.set(key, id);
    items.forEach((c, pos) => {
      let l = this.parentIndex.get(c);
      if (!l) this.parentIndex.set(c, (l = []));
      l.push([id, pos]);
    });
    this._byLevel = null;
    return { id, isNew: true };
  }

  noteRead(id, level, isNew) {
    this._write('count');
    this.atoms[id].count++;
    if (isNew) this.buffer[level].push(id);
  }
  noteChild(level, id) {
    this._write('childFreq');
    const m = this.childFreq[level];
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  noteSingle(level, id) {
    this._write('single');
    const m = this.single[level];
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  // tokenizerul cu care a fost citită memoria; predicția și măsurătorile trebuie să-l folosească pe același
  noteMode(mode) {
    if (this.tokenMode === undefined) {
      this._write('mode');
      this.tokenMode = mode;
    } else if (this.tokenMode !== mode) throw new Error(`memoria a fost citită cu tokenizerul ${this.tokenMode}, nu ${mode}`);
  }
  noteRoot(id, docName) {
    this._write('root');
    this.roots.set(id, (this.roots.get(id) ?? 0) + 1);
    if (docName !== undefined) this.docsRead.push(docName);
  }

  // ---------- citire ----------
  members(choiceId) {
    return this.atoms[choiceId].def.members;
  }
  // Alegeri tipizate (D18): o alegere cu `typed` poate avea ca membri tipare sau clase de tipare, care
  // înseamnă „orice aplicare a lor” (tipul locului este un concept, nu o listă de valori văzute).
  // v aparține alegerii c: membru direct, sau (alegere tipizată) aplicare a unui tipar membru ori a unui
  // tipar dintr-o clasă membră.
  inChoice(c, v) {
    const d = this.atoms[c].def;
    if (d.members.has(v)) return true;
    return !!d.typed && this.typeCovers(c, v);
  }
  typeCovers(c, v) {
    const dv = this.atoms[v]?.def;
    if (dv?.type !== 'APP') return false;
    const ms = this.atoms[c].def.members;
    if (ms.has(dv.pattern)) return true;
    for (const M of this.classesOf(dv.pattern)) if (ms.has(M)) return true;
    return false;
  }
  pinTyped(touched = new Set()) {
    let any = false;
    for (let id = 1; id < this.atoms.length && !any; id++) any = this.atoms[id].def?.type === 'CHOICE' && !!this.atoms[id].def.typed;
    if (!any) return;
    for (let id = 1; id < this.atoms.length; id++) {
      const d = this.atoms[id].def;
      if (d?.type !== 'APP') continue;
      const p = this.atoms[d.pattern].def;
      d.fills.forEach((v, i) => {
        const c = this.atoms[p.slots[i]].accepts;
        const cd = this.atoms[c].def;
        if (cd.typed && !this.inChoice(c, v)) {
          cd.members.set(v, 1);
          touched.add(c);
        }
      });
    }
    this._clearCaches();
  }
  // clasele care conțin un tipar
  classesOf(p) {
    if (!this._classesOf) {
      this._classesOf = new Map();
      for (let id = 1; id < this.atoms.length; id++) {
        const d = this.atoms[id].def;
        if (d?.type !== 'PCLASS') continue;
        for (const m of d.members) {
          if (!this._classesOf.has(m)) this._classesOf.set(m, []);
          this._classesOf.get(m).push(id);
        }
      }
    }
    return this._classesOf.get(p) ?? [];
  }
  // câte valori distincte poate lua un loc care acceptă c (pentru măsura în biți): membrii direcți, iar
  // pentru un membru-tip, aplicările lui
  choiceCard(c) {
    const d = this.atoms[c].def;
    if (!d.typed) return d.members.size;
    let n = 0;
    for (const m of d.members.keys()) {
      const md = this.atoms[m].def;
      if (md?.type === 'PATTERN') n += Math.max(1, this.usage(m));
      else if (md?.type === 'PCLASS') n += Math.max(1, md.members.reduce((s, q) => s + this.usage(q), 0));
      else n++;
    }
    return n;
  }
  // alegerile unui atom, pentru îmbogățire: cele în care e membru direct și cele tipizate care îl acoperă
  choicesOf(id) {
    const a = this.atoms[id];
    const base = a?.choices ?? [];
    if (a?.def?.type !== 'APP') return base;
    if (!this._typeUsers) {
      this._typeUsers = new Map();
      for (let c = 1; c < this.atoms.length; c++) {
        const d = this.atoms[c].def;
        if (d?.type !== 'CHOICE' || !d.typed) continue;
        for (const m of d.members.keys()) {
          if (!this._typeUsers.has(m)) this._typeUsers.set(m, []);
          this._typeUsers.get(m).push(c);
        }
      }
    }
    if (!this._typeUsers.size) return base;
    const p = a.def.pattern;
    const extra = [...(this._typeUsers.get(p) ?? []), ...this.classesOf(p).flatMap((M) => this._typeUsers.get(M) ?? [])];
    if (!extra.length) return base;
    return [...new Set([...base, ...extra])];
  }

  // copiii unei aplicări: tiparul cu locurile înlocuite de valori; un tipar cuibărit dă aplicarea lui.
  appChildren(patternId, fills, resolve = (items) => this.lookup(items)) {
    const p = this.atoms[patternId].def;
    const bind = new Map(p.slots.map((s, i) => [s, fills[i]]));
    return p.items.map((it) => {
      if (it.fixed !== undefined) return it.fixed;
      if (it.slot !== undefined) return bind.get(it.slot);
      const sub = this.subChildren(it, bind, resolve);
      const id = resolve(sub);
      if (id === undefined) fail('I2', `copilul cuibărit al tiparului ${patternId} nu există ca atom`);
      return id;
    });
  }

  // copiii unui copil cuibărit: tipar (args = locurile lui) sau clasă de tipare (args = rolurile clasei,
  // form = locul care reține membrul folosit; locurile membrului se iau din roluri prin align)
  subChildren(it, bind, resolve = (items) => this.lookup(items)) {
    const q = this.atoms[it.sub].def;
    if (q.type !== 'PCLASS') return this.appChildren(it.sub, it.args.map((s) => bind.get(s)), resolve);
    const member = bind.get(it.form);
    const al = q.align[member];
    if (!al) fail('I6', `membrul ${member} nu este în clasa ${it.sub}`);
    return this.appChildren(member, al.map((r) => bind.get(it.args[r])), resolve);
  }

  children(id) {
    const a = this.atoms[id];
    if (!a || a.kind !== 'SENSE') return null;
    const d = a.def;
    if (d.type === 'SEQ') return d.items;
    if (d.type !== 'APP') return null;
    let c = this._children.get(id);
    if (!c) this._children.set(id, (c = this.appChildren(d.pattern, d.fills)));
    return c;
  }

  unfold(id, { fresh = false } = {}) {
    if (this.isToken(id)) return [id];
    if (!fresh) {
      const c = this._unfold.get(id);
      if (c) return c;
    }
    const out = [];
    const ch = fresh ? this._childrenFresh(id) : this.children(id);
    if (!ch) throw new Error(`atomul ${id} nu este o unitate`);
    for (const c of ch) for (const t of this.unfold(c, { fresh })) out.push(t);
    if (!fresh) this._unfold.set(id, out);
    return out;
  }
  _childrenFresh(id) {
    const d = this.atoms[id].def;
    return d.type === 'SEQ' ? d.items : this.appChildren(d.pattern, d.fills);
  }

  text(id, joiner) {
    const toks = this.unfold(id).map((t) => this.atoms[t].text);
    return joiner ? joiner(toks) : toks.join(' ');
  }

  parents(id) {
    return this.parentIndex.get(id) ?? [];
  }

  byLevel(level) {
    if (!this._byLevel) {
      this._byLevel = levels(() => ({ SEQ: [], APP: [], PATTERN: [], CHOICE: [], PCLASS: [] }));
      for (let id = 1; id < this.atoms.length; id++) {
        const a = this.atoms[id];
        if (a.kind === 'SENSE') this._byLevel[a.level][a.def.type].push(id);
      }
    }
    return this._byLevel[level];
  }

  allOfType(type) {
    const out = [];
    for (let l = 0; l <= LEVELS; l++) out.push(...this.byLevel(l)[type]);
    return out.sort((a, b) => a - b);
  }

  // câte aplicări are fiecare tipar
  usage(patternId) {
    if (!this._usage) {
      this._usage = new Map();
      for (let id = 1; id < this.atoms.length; id++) {
        const d = this.atoms[id].def;
        if (d?.type === 'APP') this._usage.set(d.pattern, (this._usage.get(d.pattern) ?? 0) + 1);
      }
    }
    return this._usage.get(patternId) ?? 0;
  }

  // tipare vii: cu cel puțin o aplicare. Un tipar rămas fără aplicări (după o alternativă) nu mai costă nimic.
  livePatterns(level) {
    return this.byLevel(level).PATTERN.filter((p) => this.liveSet().has(p));
  }
  // tipare vii: cu aplicări, sau cuibărite într-un tipar viu
  liveSet() {
    if (!this._live) {
      const live = new Set();
      const stack = [];
      for (let id = 1; id < this.atoms.length; id++)
        if (this.atoms[id].def?.type === 'PATTERN' && this.usage(id) > 0) {
          live.add(id);
          stack.push(id);
        }
      const mark = (x) => {
        if (live.has(x)) return;
        live.add(x);
        stack.push(x);
      };
      while (stack.length) {
        const d = this.atoms[stack.pop()].def;
        if (d.type === 'PCLASS') d.members.forEach(mark);
        else for (const it of d.items) if (it.sub !== undefined) mark(it.sub);
        // tipurile acceptate de locuri (D18): tiparele și clasele dintr-o alegere tipizată
        for (const st of d.type === 'PCLASS' ? d.roles : d.slots) {
          const cd = this.atoms[this.atoms[st].accepts]?.def;
          if (cd?.typed) for (const m of cd.members.keys()) if (this.atoms[m].def?.type === 'PATTERN' || this.atoms[m].def?.type === 'PCLASS') mark(m);
        }
      }
      this._live = live;
    }
    return this._live;
  }
  // o alegere este vie dacă o acceptă un loc al unui tipar viu
  isLive(id) {
    const d = this.atoms[id].def;
    if (d?.type === 'PATTERN' || d?.type === 'PCLASS') return this.liveSet().has(id);
    if (d?.type === 'CHOICE') return (this.choiceUsers().get(id) ?? []).some((p) => this.liveSet().has(p));
    return true;
  }
  // alegere -> tiparele care o folosesc
  choiceUsers() {
    if (!this._choiceUsers) {
      this._choiceUsers = new Map();
      for (let id = 1; id < this.atoms.length; id++) {
        const d = this.atoms[id].def;
        if (d?.type !== 'PATTERN' && d?.type !== 'PCLASS') continue;
        for (const s of d.type === 'PCLASS' ? d.roles : d.slots) {
          const c = this.atoms[s].accepts;
          if (!this._choiceUsers.has(c)) this._choiceUsers.set(c, []);
          if (!this._choiceUsers.get(c).includes(id)) this._choiceUsers.get(c).push(id);
        }
      }
    }
    return this._choiceUsers;
  }

  unitCount() {
    let n = 0;
    for (let id = 1; id < this.atoms.length; id++) if (this.isUnit(id)) n++;
    return n;
  }

  // ---------- somn ----------
  beginPass() {
    this.frozen = true;
  }

  // commit(pachet): singura cale prin care somnul modifică memoria. Id-urile negative din pachet sunt atomi noi.
  //   pkg.newChoices:  [{ tmp, level, members: [[id, pondere]] }]
  //   pkg.addMembers:  [{ choice, members: [[id, pondere]] }]
  //   pkg.newPatterns: [{ tmp, level, items, slots, structs: [{ tmp, accepts }] }]
  //   pkg.rewrites:    [{ unit, pattern, fills }]
  //   pkg.reverts:     [unit]       aplicări care redevin înșiruiri
  //   pkg.seen:        { nivel: [unități văzute de trecere] }
  commit(pkg, { check = true } = {}) {
    this.frozen = false;
    const touched = new Set([...(pkg.rewrites ?? []).map((r) => r.unit), ...(pkg.reverts ?? [])]);
    const before = new Map();
    for (const id of touched) before.set(id, { children: this.children(id).slice(), unfold: this.unfold(id).slice() });

    const map = new Map();
    const R = (x) => {
      if (x >= 0) return x;
      const r = map.get(x);
      if (r === undefined) throw new Error(`referință nerezolvată ${x}`);
      return r;
    };
    const push = (a) => {
      a.id = this.atoms.length;
      this.atoms.push(a);
      return a.id;
    };
    // 1. atomii noi
    for (const c of pkg.newChoices ?? [])
      map.set(c.tmp, push({ kind: 'SENSE', level: c.level, def: { type: 'CHOICE', members: new Map() }, count: 0, choices: [] }));
    for (const p of pkg.newPatterns ?? []) {
      const pid = push({ kind: 'SENSE', level: p.level, def: null, count: 0, choices: [] });
      map.set(p.tmp, pid);
      for (const s of p.structs) map.set(s.tmp, push({ kind: 'STRUCT', pattern: pid, accepts: null }));
    }
    // clasele de tipare: rolurile sunt atomi de structură ai clasei, comuni tuturor membrilor (D15)
    for (const c of pkg.newClasses ?? []) {
      const cid = push({ kind: 'SENSE', level: c.level, def: null, count: 0, choices: [] });
      map.set(c.tmp, cid);
      for (const r of c.roles) map.set(r.tmp, push({ kind: 'STRUCT', pclass: cid, accepts: null }));
    }
    const touchedChoices = new Set();
    for (const c of pkg.newChoices ?? []) {
      const id = R(c.tmp);
      for (const [m, w] of c.members) this.atoms[id].def.members.set(R(m), w);
      touchedChoices.add(id);
    }
    for (const a of pkg.addMembers ?? []) {
      const ms = this.atoms[a.choice].def.members;
      for (const [m, w] of a.members) ms.set(R(m), (ms.get(R(m)) ?? 0) + w);
      touchedChoices.add(a.choice);
    }
    // alegeri care devin tipizate (D18): membrii lor se înlocuiesc cu tipurile lor
    for (const a of pkg.retype ?? []) {
      const d = this.atoms[a.choice].def;
      d.members = new Map(a.members.map(([m, w]) => [R(m), w]));
      d.typed = true;
    }
    for (const p of pkg.newPatterns ?? []) {
      for (const s of p.structs) this.atoms[R(s.tmp)].accepts = R(s.accepts);
      this.atoms[R(p.tmp)].def = {
        type: 'PATTERN',
        items: p.items.map((it) =>
          it.fixed !== undefined
            ? { fixed: it.fixed }
            : it.slot !== undefined
              ? { slot: R(it.slot) }
              : it.form !== undefined
                ? { sub: R(it.sub), args: it.args.map(R), form: R(it.form) }
                : { sub: R(it.sub), args: it.args.map(R) },
        ),
        slots: p.slots.map(R),
      };
    }
    for (const c of pkg.newClasses ?? []) {
      for (const r of c.roles) this.atoms[R(r.tmp)].accepts = R(r.accepts);
      const align = {};
      for (const [m, al] of c.align) align[R(m)] = al.slice();
      this.atoms[R(c.tmp)].def = { type: 'PCLASS', members: c.members.map(R), roles: c.roles.map((r) => R(r.tmp)), align };
    }
    for (const a of pkg.classAdds ?? []) {
      const d = this.atoms[a.cls].def;
      for (const [m, al] of a.align) {
        const mm = R(m);
        if (!d.align[mm]) {
          d.members.push(mm);
          d.align[mm] = al.slice();
        }
      }
    }
    // 2. rescrierile: același id, aceiași copii
    this._clearCaches();
    for (const r of pkg.rewrites ?? []) this.atoms[r.unit].def = { type: 'APP', pattern: R(r.pattern), fills: r.fills.slice() };
    for (const u of pkg.reverts ?? []) this.atoms[u].def = { type: 'SEQ', items: before.get(u).children.slice() };
    this._clearCaches();
    // alegerile tipizate (D18): o valoare care nu mai e acoperită de tip (unitatea ei a trecut la alt tipar)
    // rămâne membru direct, ca nimic să nu se piardă; costul membrului se vede în măsurarea exactă
    this.pinTyped(touchedChoices);
    // 3. tampon -> rest
    const rewritten = new Set((pkg.rewrites ?? []).map((r) => r.unit));
    for (let l = 0; l <= LEVELS; l++) {
      const seen = new Set(pkg.seen?.[l] ?? []);
      const res = new Set([...this.residue[l], ...this.buffer[l].filter((u) => seen.has(u)), ...(pkg.reverts ?? []).filter((u) => this.atoms[u].level === l)]);
      this.residue[l] = [...res].filter((u) => !rewritten.has(u) && this.atoms[u].def.type === 'SEQ').sort((a, b) => a - b);
      this.buffer[l] = this.buffer[l].filter((u) => !seen.has(u));
    }
    // 4. abia acum: choices la membri
    for (const c of [...touchedChoices].sort((a, b) => a - b))
      for (const m of [...this.atoms[c].def.members.keys()].sort((a, b) => a - b)) {
        const ch = this.atoms[m].choices;
        if (!ch.includes(c)) ch.push(c);
      }
    for (const [u, alts] of pkg.alternatives ?? []) this.alternatives.set(u, alts);
    // metadate de concept (trecerea de concepte): felul conceptului și părinții lui în ierarhie
    for (const x of pkg.meta ?? []) {
      const a = this.atoms[R(x.ref)];
      if (x.concept) a.concept = x.concept;
      if (x.isa) a.isa = x.isa.map(R);
    }
    // 5. versiunea și invarianții
    this.version++;
    // pe copiile de măsurare (judecata exactă) verificarea se sare: commit-ul real o face oricum
    if (check) checkInvariants(this, { before });
    return map;
  }

  // ---------- disc ----------
  atomToJSON(a) {
    if (a.kind === 'TOKEN') return { id: a.id, kind: a.kind, text: a.text, choices: a.choices };
    if (a.kind === 'STRUCT') return { id: a.id, kind: a.kind, pattern: a.pattern, accepts: a.accepts };
    const d = a.def.type === 'CHOICE' ? { type: 'CHOICE', members: [...a.def.members], ...(a.def.typed ? { typed: true } : {}) } : a.def;
    const o = { id: a.id, kind: a.kind, level: a.level, def: d, count: a.count, choices: a.choices };
    if (a.concept) o.concept = a.concept;
    if (a.isa) o.isa = a.isa;
    return o;
  }
  toJSONL() {
    return this.atoms.slice(1).map((a) => JSON.stringify(this.atomToJSON(a))).join('\n') + '\n';
  }

  clone() {
    const m = new Memory(this.config);
    m.atoms = this.atoms.map((a) => {
      if (!a) return a;
      const c = { ...a, choices: a.choices ? a.choices.slice() : a.choices };
      if (a.def) {
        if (a.def.type === 'CHOICE') c.def = { type: 'CHOICE', members: new Map(a.def.members), ...(a.def.typed ? { typed: true } : {}) };
        else c.def = structuredClone(a.def);
      }
      return c;
    });
    m.tokenIndex = new Map(this.tokenIndex);
    m.internIndex = new Map(this.internIndex);
    m.parentIndex = new Map([...this.parentIndex].map(([k, v]) => [k, v.map((x) => x.slice())]));
    m.version = this.version;
    m.buffer = this.buffer.map((b) => b.slice());
    m.residue = this.residue.map((b) => b.slice());
    m.single = this.single.map((x) => new Map(x));
    m.childFreq = this.childFreq.map((x) => new Map(x));
    m.roots = new Map(this.roots);
    m.docsRead = this.docsRead.slice();
    m.tokenMode = this.tokenMode;
    m.alternatives = new Map(this.alternatives);
    m._maxUnits = this._maxUnits;
    return m;
  }
}
