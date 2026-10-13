// Predicția (secțiunea 11): probabilitatea fiecărui token să urmeze după un început de text. Nu scrie în memorie.
import { ExactSim } from '../memory/similarity.mjs';
import { makeSim } from '../memory/vectors.mjs';
import { matchPattern, bestMatch } from '../memory/match.mjs';
import { segmentPrefix, buildUnit, Segmenter } from '../text/boundaries.mjs';
import { tokenize } from '../text/tokenizer.mjs';
import { byScoreThenId } from '../core/rng.mjs';
import { LEVELS } from '../memory/store.mjs';

export const END = 'END'; // sfârșitul unei unități
export const EOT = 'EOT'; // sfârșitul textului
export const UNK = 'UNK'; // orice token necunoscut memoriei
const TEMP = 0x80000000;

// unități (și tokeni) temporare: există doar cât durează predicția
class TempStore {
  constructor(mem) {
    this.mem = mem;
    this.units = new Map(); // id -> { children, level }
    this.index = new Map();
    this.tokens = new Map(); // id -> text
    this.tokIndex = new Map();
    this.next = TEMP;
  }
  isTemp(id) {
    return typeof id === 'number' && id >= TEMP;
  }
  token(text) {
    const known = this.mem.tokenId(text);
    if (known !== undefined) return known;
    if (!this.tokIndex.has(text)) {
      const id = this.next++;
      this.tokIndex.set(text, id);
      this.tokens.set(id, text);
    }
    return this.tokIndex.get(text);
  }
  make(items, level) {
    const m = items.some((x) => this.isTemp(x)) ? undefined : this.mem.lookup(items);
    if (m !== undefined) return m;
    const key = items.join(',');
    if (!this.index.has(key)) {
      const id = this.next++;
      this.index.set(key, id);
      this.units.set(id, { children: items.slice(), level });
    }
    return this.index.get(key);
  }
  children(id) {
    return this.isTemp(id) ? this.units.get(id)?.children ?? null : this.mem.children(id);
  }
  level(id) {
    if (!this.isTemp(id)) return this.mem.level(id);
    return this.units.get(id)?.level ?? 0;
  }
  isToken(id) {
    return this.isTemp(id) ? this.tokens.has(id) : this.mem.isToken(id);
  }
}

const addTo = (m, k, v) => m.set(k, (m.get(k) ?? 0) + v);

function mapSum(m) {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

function normalize(m) {
  let s = 0;
  for (const v of m.values()) s += v;
  if (!(s > 0)) return null;
  const out = new Map();
  for (const [k, v] of m) out.set(k, v / s);
  return out;
}

export class Predictor {
  constructor(mem, cfg) {
    this.mem = mem;
    this.cfg = cfg;
    this.temp = new TempStore(mem);
    const t = this.temp;
    const tsrc = { isToken: (id) => t.isToken(id), children: (id) => t.children(id), choicesOf: (id) => (t.isTemp(id) ? [] : mem.choicesOf(id)) };
    this.sim = makeSim(cfg, () => new ExactSim(
      { isToken: (id) => t.isToken(id), children: (id) => t.children(id), choicesOf: (id) => (t.isTemp(id) ? [] : mem.choicesOf(id)) },
      cfg.w,
    ), {
      ...tsrc,
      def: (id) => (t.isTemp(id) ? (t.isToken(id) ? undefined : { type: 'SEQ' }) : mem.atoms[id].def),
      accepts: (s) => mem.atoms[s].accepts,
      members: (c) => mem.atoms[c].def.members,
    });
    this.voters = [];
    this.patterns = [];
    for (let l = 0; l <= LEVELS; l++) {
      const bl = mem.byLevel(l);
      const v = [...bl.SEQ, ...bl.APP].sort((a, b) => a - b).map((id) => ({ id, children: mem.children(id), count: mem.atoms[id].count || 1 }));
      for (const [x, n] of [...mem.single[l]].sort((a, b) => a[0] - b[0])) v.push({ id: `s${x}`, children: [x], count: n });
      this.voters[l] = v;
      this.patterns[l] = mem.livePatterns(l).slice().sort((a, b) => a - b);
    }
    this.vocab = [];
    for (let id = 1; id < mem.atoms.length; id++) if (mem.atoms[id].kind === 'TOKEN') this.vocab.push(id);
    this.interpCache = new Map();
    this.env = {
      pattern: (p) => mem.atoms[p].def,
      accepts: (s) => mem.atoms[s].accepts,
      isMember: (c, v) => {
        const d = mem.atoms[c].def;
        if (d.members.has(v)) return true;
        if (!d.typed) return false;
        // alegere tipizată (D18): v (și o unitate nouă) se citește ca aplicare; tiparul sau o clasă a lui e membru
        const x = this.interp(v);
        return !!x && (d.members.has(x.pattern) || mem.classesOf(x.pattern).some((M) => d.members.has(M)));
      },
      similar: (c, v) => {
        let s = 0, n = 0;
        const typed = mem.atoms[c].def.typed;
        for (const m of mem.atoms[c].def.members.keys()) {
          if (typed && this.isType(m)) continue;
          s += this.sim.simC(m, v);
          n++;
        }
        return n ? s / n : 0;
      },
      interp: (v) => this.interp(v),
      children: (v) => this.temp.children(v),
      multiInterp: !!cfg.multiInterp,
      thetaAccept: cfg.theta_accept,
    };
  }

  isType(m) {
    const t = this.mem.atoms[m].def?.type;
    return t === 'PATTERN' || t === 'PCLASS';
  }
  // aplicările din memorie ale unui tipar sau ale membrilor unei clase
  appsOfType(T) {
    if (!this.appsIdx) {
      this.appsIdx = new Map();
      for (let id = 1; id < this.mem.atoms.length; id++) {
        const d = this.mem.atoms[id].def;
        if (d?.type !== 'APP') continue;
        if (!this.appsIdx.has(d.pattern)) this.appsIdx.set(d.pattern, []);
        this.appsIdx.get(d.pattern).push(id);
      }
    }
    const d = this.mem.atoms[T].def;
    const ps = d.type === 'PCLASS' ? d.members : [T];
    const out = ps.flatMap((p) => this.appsIdx.get(p) ?? []);
    return out;
  }

  // v ca aplicare: definiția din memorie, sau recunoașterea lui pe tiparele cunoscute
  interp(v) {
    if (!this.temp.isTemp(v)) {
      const d = this.mem.atoms[v]?.def;
      if (d?.type === 'APP') return { pattern: d.pattern, fills: d.fills };
      if (d?.type !== 'SEQ') return null;
    }
    if (this.interpCache.has(v)) return this.interpCache.get(v);
    const ch = this.temp.children(v);
    let res = null;
    if (ch) {
      const ms = [];
      for (const p of this.patterns[this.temp.level(v)] ?? []) {
        const m = matchPattern(this.env, p, ch);
        if (m) ms.push(m);
      }
      if (ms.length) res = { pattern: bestMatch(ms)[0].pattern, fills: bestMatch(ms)[0].fills };
    }
    this.interpCache.set(v, res);
    return res;
  }

  // distribuția peste copiii posibili (și END) ai unei unități deschise
  childDistribution(levels, prefix, opts = {}) {
    const { mem, cfg } = this;
    const s1 = new Map(), s2 = new Map(), s3 = new Map();
    const n = prefix.length;
    // sursa 2: votul unităților
    const cands = this.sim instanceof ExactSim ? this.indexedVoters(levels, prefix) : this.allVoters(levels, prefix);
    cands.sort(byScoreThenId);
    for (const c of cands.slice(0, cfg.n_vote)) addTo(s2, c.next, c.score);
    // sursele 1 și 3: tiparele care se potrivesc cu prefixul
    for (const l of levels)
      for (const pid of this.patterns[l]) {
        const d = mem.atoms[pid].def;
        if (d.items.length < n) continue;
        const m = matchPattern(this.env, pid, prefix, { partial: true });
        if (!m) continue;
        const w = mem.usage(pid) || 1;
        if (d.items.length === n) {
          addTo(s1, END, w);
          continue;
        }
        const it = d.items[n];
        if (it.fixed !== undefined) addTo(s1, it.fixed, w);
        else if (it.slot !== undefined) {
          if (m.bind.has(it.slot)) addTo(s1, m.bind.get(it.slot), w);
          else {
            const cd = mem.atoms[mem.atoms[it.slot].accepts].def;
            const ms = cd.members;
            let tot = 0;
            for (const x of ms.values()) tot += x;
            for (const [x, wt] of ms) {
              // un membru-tip (D18) se împarte egal între aplicările lui din memorie
              const xs = cd.typed && this.isType(x) ? this.appsOfType(x) : [x];
              for (const y of xs) addTo(s3, y, (w * wt) / tot / xs.length);
            }
          }
        } else if (it.args.every((s) => m.bind.has(s))) {
          const q = mem.atoms[it.sub];
          const mk = (its) => this.temp.make(its, q.level);
          if (q.def.type === 'PCLASS') {
            // printr-o clasă: membrul din locul formei, sau fiecare membru posibil, după ponderea lui
            const bind = new Map(m.bind);
            const forms = m.bind.has(it.form) ? [[m.bind.get(it.form), 1]] : [...mem.atoms[mem.atoms[it.form].accepts].def.members];
            const tot = forms.reduce((a, [, x]) => a + x, 0);
            for (const [member, wt] of forms) {
              bind.set(it.form, member);
              addTo(s1, mk(mem.subChildren(it, bind, mk)), (w * wt) / tot);
            }
          } else {
            const items = mem.appChildren(it.sub, it.args.map((s) => m.bind.get(s)), mk);
            addTo(s1, mk(items), w);
          }
        }
      }
    // sursa 4: frecvența, plus o parte egală pentru fiecare token din vocabular.
    // Nu depinde de prefix, deci se calculează o singură dată pe nivel (aceeași Map, aceeași ordine).
    const s4 = this.freqSource(levels);
    // amestecul
    // O4: sursele nu se mai copiază în Map-uri normalizate; se împarte la sumă direct, cu aceleași operații
    const srcs = [s1, s2, s3, s4];
    const tot = srcs.map(mapSum);
    const lam = cfg.lambda;
    let L = 0;
    tot.forEach((t, i) => t > 0 && (L += lam[i]));
    if (opts.split) {
      // sursele 1–3 în D; sursa 4 (constantă pe nivel) rămâne separată, cu factorul ei
      const D = new Map();
      for (let i = 0; i < 3; i++) {
        const t = tot[i];
        if (!(t > 0)) continue;
        const f = lam[i] / L;
        for (const [k, v] of srcs[i]) addTo(D, k, f * (v / t));
      }
      return { D, f4: tot[3] > 0 ? lam[3] / L / tot[3] : 0 };
    }
    const D = new Map();
    srcs.forEach((src, i) => {
      const t = tot[i];
      if (!(t > 0)) return;
      const f = lam[i] / L;
      for (const [k, v] of src) addTo(D, k, f * (v / t));
    });
    return D;
  }

  // sursa 4 agregată pe primul token (fără END), o dată pe nivel: Map(token -> pondere brută)
  s4Agg(levels) {
    const key = levels.join('+');
    this.s4AggCache ??= new Map();
    let a = this.s4AggCache.get(key);
    if (!a) {
      const s4 = this.freqSource(levels);
      const m = new Map();
      for (const [k, v] of s4) if (k !== END) addTo(m, this.firstToken(k), v);
      a = { m, end: s4.get(END) ?? 0 };
      this.s4AggCache.set(key, a);
    }
    return a;
  }

  // P „leneș”: aceeași distribuție ca P, dar sursa 4 rămâne ca termeni c · agregat(nivel).
  // Matematic identică; adunările se fac în altă ordine (diferențe de ordinul 1e-15).
  Plazy(stack, i, c = 1, out = { small: new Map(), parts: [] }) {
    const e = stack[i];
    const { D, f4 } = this.childDistribution(e.levels, e.prefix, { split: true });
    let pe = 0;
    for (const [a, p] of D) {
      if (a === END) pe += p;
      else addTo(out.small, this.firstToken(a), c * p);
    }
    if (f4 > 0) {
      const ag = this.s4Agg(e.levels);
      out.parts.push([c * f4, ag.m]);
      pe += f4 * ag.end;
    }
    if (pe > 0) {
      if (i === stack.length - 1) addTo(out.small, EOT, c * pe);
      else {
        const closed = this.closeUnit(e);
        const st = stack.map((x, j) => (j < i + 1 ? { ...x, prefix: [] } : j === i + 1 ? { ...x, prefix: [...x.prefix, closed] } : x));
        this.Plazy(st, i + 1, c * pe, out);
      }
    }
    return out;
  }
  lazyGet(lz, key) {
    let p = lz.small.get(key) ?? 0;
    for (const [c, m] of lz.parts) p += c * (m.get(key) ?? 0);
    return p;
  }
  // probabilitatea tokenului dat (text) după prefix, fără distribuția completă
  nextProb(tokens, text) {
    const st = this.stackFor(tokens);
    let i = st.findIndex((e) => e.prefix.length > 0);
    if (i < 0) i = st.length - 1;
    const lz = this.Plazy(st, i);
    if (text === EOT) return this.lazyGet(lz, EOT);
    const id = this.mem.tokenId(text);
    return this.lazyGet(lz, id === undefined ? UNK : id);
  }

  // O1: sumele asemănărilor prefix–votant, calculate incremental. Pentru prefixul p cu n copii,
  // sums[j] = Σ_{i<n} simE(p[i], c_j[i]), adunate în aceeași ordine ca înainte (rezultat identic).
  prefixSums(levels, prefix) {
    const lk = levels.join('+');
    let list = this.voterLists?.get(lk);
    if (!list) {
      this.voterLists ??= new Map();
      list = levels.flatMap((l) => this.voters[l]);
      this.voterLists.set(lk, list);
    }
    this.sumCache ??= new Map();
    const key = `${lk}|${prefix.join(',')}`;
    let sums = this.sumCache.get(key);
    if (!sums) {
      const n = prefix.length;
      if (n === 0) sums = new Float64Array(list.length);
      else {
        const prev = this.prefixSums(levels, prefix.slice(0, n - 1)).sums;
        sums = new Float64Array(list.length);
        const x = prefix[n - 1];
        for (let j = 0; j < list.length; j++) {
          const c = list[j].children;
          sums[j] = c.length >= n ? prev[j] + this.sim.simE(x, c[n - 1]) : prev[j];
        }
      }
      if (this.sumCache.size > 20000) this.sumCache.clear();
      this.sumCache.set(key, sums);
    }
    return { list, sums };
  }

  allVoters(levels, prefix) {
    const n = prefix.length;
    const out = [];
    const { list, sums } = this.prefixSums(levels, prefix);
    for (let j = 0; j < list.length; j++) {
      const v = list[j];
      const c = v.children;
      if (c.length < n) continue;
      const s = n ? sums[j] / n : 1;
      out.push({ id: v.id, score: v.count * Math.exp(this.cfg.beta * (s - 1)), next: c.length === n ? END : c[n] });
    }
    return out;
  }

  // Votul cu index, exact (numai cu asemănarea exactă): simE(x, y) > 0 dacă și numai dacă x și y au o
  // trăsătură comună în F, unde F(x) = {x} ∪ alegerile lui x ∪ {(k, f) : f ∈ F(copil_k(x))}.
  // Votanții fără nicio trăsătură comună cu prefixul au s = 0, deci toți aceeași greutate count·e^(−β):
  // dintre ei contează doar primii n_vote, luați dintr-o listă sortată o singură dată. Rezultat identic.
  features(x) {
    this.fCache ??= new Map();
    let f = this.fCache.get(x);
    if (f) return f;
    f = [String(x)];
    if (!this.temp.isTemp(x) && this.mem.atoms[x]) for (const c of this.mem.choicesOf(x)) f.push(`c${c}`);
    if (!this.temp.isToken(x)) {
      const ch = this.temp.children(x);
      if (ch) ch.forEach((c, k) => { for (const g of this.features(c)) f.push(`${k}.${g}`); });
    }
    this.fCache.set(x, f);
    return f;
  }
  voterIndex(levels) {
    const key = levels.join('+');
    this.vIndex ??= new Map();
    let ix = this.vIndex.get(key);
    if (ix) return ix;
    const { list } = this.prefixSums(levels, []);
    const map = new Map();
    list.forEach((v, j) => v.children.forEach((c, i) => {
      for (const f of this.features(c)) {
        const k = `${i}|${f}`;
        let a = map.get(k);
        if (!a) map.set(k, (a = []));
        a.push(j);
      }
    }));
    // ordinea votanților cu s = 0 (și cu s = 1, la prefix gol): după greutate, apoi după id
    const zeroOrder = list.map((v, j) => ({ j, id: v.id, score: v.count })).sort(byScoreThenId).map((x) => x.j);
    ix = { list, map, zeroOrder };
    this.vIndex.set(key, ix);
    return ix;
  }
  indexedVoters(levels, prefix) {
    const n = prefix.length;
    const { beta, n_vote } = this.cfg;
    const { list, map, zeroOrder } = this.voterIndex(levels);
    const entry = (j, s) => {
      const c = list[j].children;
      return { id: list[j].id, score: list[j].count * Math.exp(beta * (s - 1)), next: c.length === n ? END : c[n] };
    };
    if (n === 0) return zeroOrder.slice(0, Math.max(n_vote, 0) + 1).map((j) => entry(j, 1));
    const pos = new Set();
    for (let i = 0; i < n; i++) for (const f of this.features(prefix[i])) for (const j of map.get(`${i}|${f}`) ?? []) pos.add(j);
    const out = [];
    for (const j of pos) {
      const c = list[j].children;
      if (c.length < n) continue;
      let s = 0;
      for (let i = 0; i < n; i++) s += this.sim.simE(prefix[i], c[i]);
      out.push(entry(j, s / n));
    }
    let added = 0;
    for (const j of zeroOrder) {
      if (added > n_vote) break;
      if (pos.has(j) || list[j].children.length < n) continue;
      out.push(entry(j, 0));
      added++;
    }
    return out;
  }

  freqSource(levels) {
    const key = levels.join('+');
    this.s4Cache ??= new Map();
    let s4 = this.s4Cache.get(key);
    if (s4) return s4;
    s4 = new Map();
    const freq = new Map();
    for (const l of levels) for (const [a, c] of this.mem.childFreq[l]) addTo(freq, a, c);
    const fn = normalize(freq);
    const sigma = fn ? this.cfg.smooth : 1;
    if (fn) for (const [a, p] of fn) addTo(s4, a, (1 - sigma) * p);
    const share = sigma / (this.vocab.length + 2);
    for (const t of this.vocab) addTo(s4, t, share);
    addTo(s4, UNK, share);
    addTo(s4, END, share);
    this.s4Cache.set(key, s4);
    return s4;
  }

  firstToken(a) {
    if (a === UNK) return UNK;
    let x = a;
    while (!this.temp.isToken(x)) x = this.temp.children(x)[0];
    return this.temp.isTemp(x) ? UNK : x;
  }

  closeUnit(entry) {
    const ids = entry.prefix;
    if (ids.length === 1) return ids[0];
    return buildUnit({ level: entry.level, children: ids.map((x) => ({ tok: x })), closer: false }, { unit: (its, lv) => this.temp.make(its, lv) }, this.mem.K);
  }

  P(stack, i) {
    const e = stack[i];
    const D = this.childDistribution(e.levels, e.prefix);
    const res = new Map();
    for (const [a, p] of D) if (a !== END) addTo(res, this.firstToken(a), p);
    const pe = D.get(END) ?? 0;
    if (pe > 0) {
      if (i === stack.length - 1) addTo(res, EOT, pe);
      else {
        const closed = this.closeUnit(e);
        const st = stack.map((x, j) => (j < i + 1 ? { ...x, prefix: [] } : j === i + 1 ? { ...x, prefix: [...x.prefix, closed] } : x));
        for (const [t, p] of this.P(st, i + 1)) addTo(res, t, pe * p);
      }
    }
    return res;
  }

  stackFor(tokens) {
    const st = segmentPrefix(tokens.map((t) => ({ ...t, ref: this.temp.token(t.text) })));
    return this.stackFromOpen(st);
  }
  stackFromOpen(st) {
    const hooks = { unit: (its, lv) => this.temp.make(its, lv) };
    // nodurile închise rămân aceleași obiecte de la un pas la altul: id-ul lor se ține minte
    this.nodeIds ??= new WeakMap();
    const idOf = (node) => {
      if (node.tok !== undefined) return node.tok;
      let id = this.nodeIds.get(node);
      if (id === undefined) this.nodeIds.set(node, (id = buildUnit(node, hooks, this.mem.K)));
      return id;
    };
    return st.map((e) => ({ ...e, prefix: e.items.map(idOf) }));
  }
  // probabilitățile fiecărui token al unui document (și ale sfârșitului de text), cu tăierea incrementală:
  // aceleași stive ca segmentPrefix pe fiecare prefix, fără a reface tăierea de la început
  // from: probabilitățile se calculează doar de la tokenul `from` (cele de dinainte doar se citesc)
  docProbs(tokens, { from = 0 } = {}) {
    const seg = new Segmenter();
    const out = [];
    for (let i = 0; i <= tokens.length; i++) {
      if (i < from) {
        seg.push({ ...tokens[i], ref: this.temp.token(tokens[i].text) });
        continue;
      }
      const snap = seg.clone();
      if (snap.pending) snap.resolvePending(true);
      const st = this.stackFromOpen(snap.openStack());
      let k = st.findIndex((e) => e.prefix.length > 0);
      if (k < 0) k = st.length - 1;
      const lz = this.Plazy(st, k);
      const text = i < tokens.length ? tokens[i].text : EOT;
      const id = text === EOT ? EOT : this.mem.tokenId(text);
      out.push(this.lazyGet(lz, id === undefined ? UNK : id));
      if (i < tokens.length) seg.push({ ...tokens[i], ref: this.temp.token(tokens[i].text) });
    }
    return out;
  }

  // tokens: [{ text, spaceBefore, newlineBefore }]; întoarce Map(token id | UNK | EOT -> probabilitate)
  nextToken(tokens) {
    const st = this.stackFor(tokens);
    let i = st.findIndex((e) => e.prefix.length > 0);
    if (i < 0) i = st.length - 1;
    return this.P(st, i);
  }

  nextFromText(text, mode = this.mem.tokenMode ?? 'word') {
    return this.nextToken(tokenize(text, mode));
  }

  // probabilitatea tokenului dat (text) ca următor
  prob(dist, text) {
    if (text === EOT) return dist.get(EOT) ?? 0;
    const id = this.mem.tokenId(text);
    return dist.get(id === undefined ? UNK : id) ?? 0;
  }

  tokenText(k) {
    return typeof k === 'number' ? this.mem.atoms[k].text : k;
  }
}

// cel mai probabil token; la egalitate, id-ul mai mic
export function argmax(dist) {
  let best = null, bp = -1;
  for (const [k, p] of dist) {
    if (p > bp + 1e-12 || (Math.abs(p - bp) <= 1e-12 && String(k) < String(best))) {
      best = k;
      bp = p;
    }
  }
  return best;
}
