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

  // copiii unei aplicări: tiparul cu locurile înlocuite de valori; un tipar cuibărit dă aplicarea lui.
  appChildren(patternId, fills, resolve = (items) => this.lookup(items)) {
    const p = this.atoms[patternId].def;
    const bind = new Map(p.slots.map((s, i) => [s, fills[i]]));
    return p.items.map((it) => {
      if (it.fixed !== undefined) return it.fixed;
      if (it.slot !== undefined) return bind.get(it.slot);
      const sub = this.appChildren(it.sub, it.args.map((s) => bind.get(s)), resolve);
      const id = resolve(sub);
      if (id === undefined) fail('I2', `copilul cuibărit al tiparului ${patternId} nu există ca atom`);
      return id;
    });
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
      this._byLevel = levels(() => ({ SEQ: [], APP: [], PATTERN: [], CHOICE: [] }));
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
      while (stack.length)
        for (const it of this.atoms[stack.pop()].def.items)
          if (it.sub !== undefined && !live.has(it.sub)) {
            live.add(it.sub);
            stack.push(it.sub);
          }
      this._live = live;
    }
    return this._live;
  }
  // o alegere este vie dacă o acceptă un loc al unui tipar viu
  isLive(id) {
    const d = this.atoms[id].def;
    if (d?.type === 'PATTERN') return this.liveSet().has(id);
    if (d?.type === 'CHOICE') return (this.choiceUsers().get(id) ?? []).some((p) => this.liveSet().has(p));
    return true;
  }
  // alegere -> tiparele care o folosesc
  choiceUsers() {
    if (!this._choiceUsers) {
      this._choiceUsers = new Map();
      for (let id = 1; id < this.atoms.length; id++) {
        const d = this.atoms[id].def;
        if (d?.type !== 'PATTERN') continue;
        for (const s of d.slots) {
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
    const touchedChoices = new Set();
    for (const c of pkg.newChoices ?? []) {
      const id = R(c.tmp);
      for (const [m, w] of c.members) this.atoms[id].def.members.set(m, w);
      touchedChoices.add(id);
    }
    for (const a of pkg.addMembers ?? []) {
      const ms = this.atoms[a.choice].def.members;
      for (const [m, w] of a.members) ms.set(m, (ms.get(m) ?? 0) + w);
      touchedChoices.add(a.choice);
    }
    for (const p of pkg.newPatterns ?? []) {
      for (const s of p.structs) this.atoms[R(s.tmp)].accepts = R(s.accepts);
      this.atoms[R(p.tmp)].def = {
        type: 'PATTERN',
        items: p.items.map((it) =>
          it.fixed !== undefined ? { fixed: it.fixed } : it.slot !== undefined ? { slot: R(it.slot) } : { sub: R(it.sub), args: it.args.map(R) },
        ),
        slots: p.slots.map(R),
      };
    }
    // 2. rescrierile: același id, aceiași copii
    this._clearCaches();
    for (const r of pkg.rewrites ?? []) this.atoms[r.unit].def = { type: 'APP', pattern: R(r.pattern), fills: r.fills.slice() };
    for (const u of pkg.reverts ?? []) this.atoms[u].def = { type: 'SEQ', items: before.get(u).children.slice() };
    this._clearCaches();
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
    const d = a.def.type === 'CHOICE' ? { type: 'CHOICE', members: [...a.def.members] } : a.def;
    return { id: a.id, kind: a.kind, level: a.level, def: d, count: a.count, choices: a.choices };
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
        if (a.def.type === 'CHOICE') c.def = { type: 'CHOICE', members: new Map(a.def.members) };
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
