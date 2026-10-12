// Predicția (secțiunea 11): probabilitatea fiecărui token să urmeze după un început de text. Nu scrie în memorie.
import { ExactSim } from '../memory/similarity.mjs';
import { matchPattern, bestMatch } from '../memory/match.mjs';
import { segmentPrefix, buildUnit } from '../text/boundaries.mjs';
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
    this.sim = new ExactSim(
      { isToken: (id) => t.isToken(id), children: (id) => t.children(id), choicesOf: (id) => (t.isTemp(id) ? [] : mem.atoms[id].choices ?? []) },
      cfg.w,
    );
    this.voters = [];
    this.patterns = [];
    for (let l = 0; l <= LEVELS; l++) {
      const bl = mem.byLevel(l);
      const v = [...bl.SEQ, ...bl.APP].sort((a, b) => a - b).map((id) => ({ id, children: mem.children(id), count: mem.atoms[id].count || 1 }));
      for (const [x, n] of [...mem.single[l]].sort((a, b) => a[0] - b[0])) v.push({ id: `s${x}`, children: [x], count: n });
      this.voters[l] = v;
      this.patterns[l] = bl.PATTERN.slice().sort((a, b) => a - b);
    }
    this.vocab = [];
    for (let id = 1; id < mem.atoms.length; id++) if (mem.atoms[id].kind === 'TOKEN') this.vocab.push(id);
    this.interpCache = new Map();
    this.env = {
      pattern: (p) => mem.atoms[p].def,
      accepts: (s) => mem.atoms[s].accepts,
      isMember: (c, v) => mem.atoms[c].def.members.has(v),
      similar: (c, v) => {
        let s = 0, n = 0;
        for (const m of mem.atoms[c].def.members.keys()) {
          s += this.sim.simC(m, v);
          n++;
        }
        return n ? s / n : 0;
      },
      interp: (v) => this.interp(v),
      thetaAccept: cfg.theta_accept,
    };
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
  childDistribution(levels, prefix) {
    const { mem, cfg } = this;
    const s1 = new Map(), s2 = new Map(), s3 = new Map(), s4 = new Map();
    const n = prefix.length;
    // sursa 2: votul unităților
    const cands = [];
    for (const l of levels)
      for (const v of this.voters[l]) {
        const c = v.children;
        if (c.length < n) continue;
        let s = 1;
        if (n) {
          s = 0;
          for (let i = 0; i < n; i++) s += this.sim.simE(prefix[i], c[i]);
          s /= n;
        }
        cands.push({ id: v.id, score: v.count * Math.exp(cfg.beta * (s - 1)), next: c.length === n ? END : c[n] });
      }
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
            const ms = mem.atoms[mem.atoms[it.slot].accepts].def.members;
            let tot = 0;
            for (const x of ms.values()) tot += x;
            for (const [x, wt] of ms) addTo(s3, x, (w * wt) / tot);
          }
        } else if (it.args.every((s) => m.bind.has(s))) {
          const items = mem.appChildren(it.sub, it.args.map((s) => m.bind.get(s)), (its) => this.temp.make(its, mem.atoms[it.sub].level));
          addTo(s1, this.temp.make(items, mem.atoms[it.sub].level), w);
        }
      }
    // sursa 4: frecvența, plus o parte egală pentru fiecare token din vocabular
    const freq = new Map();
    for (const l of levels) for (const [a, c] of mem.childFreq[l]) addTo(freq, a, c);
    const fn = normalize(freq);
    const sigma = fn ? cfg.smooth : 1;
    if (fn) for (const [a, p] of fn) addTo(s4, a, (1 - sigma) * p);
    const share = sigma / (this.vocab.length + 2);
    for (const t of this.vocab) addTo(s4, t, share);
    addTo(s4, UNK, share);
    addTo(s4, END, share);
    // amestecul
    const srcs = [s1, s2, s3, s4].map(normalize);
    const lam = cfg.lambda;
    let L = 0;
    srcs.forEach((s, i) => s && (L += lam[i]));
    const D = new Map();
    srcs.forEach((s, i) => {
      if (s) for (const [k, p] of s) addTo(D, k, (lam[i] / L) * p);
    });
    return D;
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
    const hooks = { unit: (its, lv) => this.temp.make(its, lv) };
    return st.map((e) => ({ ...e, prefix: e.items.map((node) => buildUnit(node, hooks, this.mem.K)) }));
  }

  // tokens: [{ text, spaceBefore, newlineBefore }]; întoarce Map(token id | UNK | EOT -> probabilitate)
  nextToken(tokens) {
    const st = this.stackFor(tokens);
    let i = st.findIndex((e) => e.prefix.length > 0);
    if (i < 0) i = st.length - 1;
    return this.P(st, i);
  }

  nextFromText(text, mode = 'word') {
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
