// Vectorii din forma exactă (secțiunea 7). Nu se salvează și nu se modifică direct (I14): se calculează
// din definiții, cu o strategie din hdc/, și se țin minte doar cât trăiește instanța (o versiune a memoriei).
//
//   comp(unitate)  = normalize( Σ_k order( embed( enr(copil_k) ), k ) )
//   enr(x)         = normalize( comp(x) + w · Σ etichetele alegerilor lui x )
//   comp(token)    = eticheta tokenului
//   comp(alegere)  = normalize( Σ pondere · comp(membru) )
//   detect(tipar)  = ca la comp(unitate), cu: fix -> enr(copil); loc -> comp(alegerea acceptată);
//                    cuibărit -> detect(tiparul cuibărit)
//   deep(aplicare) = normalize( eticheta tiparului + Σ_locuri bind( eticheta locului, embed( enr(valoare) ) ) )
import { rng } from '../core/rng.mjs';

export class VectorView {
  // src = { isToken(id), children(id), choicesOf(id), def(id), accepts(structId), members(choiceId) }
  constructor(src, strategy, { seed = 1, w = 0.5 } = {}) {
    this.src = src;
    this.S = strategy;
    this.seed = seed >>> 0;
    this.w = w;
    this.tags = new Map();
    this.cComp = new Map();
    this.cEnr = new Map();
    this.cDetect = new Map();
  }
  static memorySource(mem, extra = {}) {
    return {
      isToken: (id) => mem.isToken(id),
      children: (id) => mem.children(id),
      choicesOf: (id) => mem.atoms[id]?.choices ?? [],
      def: (id) => mem.atoms[id]?.def,
      accepts: (s) => mem.atoms[s].accepts,
      members: (c) => mem.atoms[c].def.members,
      ...extra,
    };
  }
  // eticheta unui atom: fixată de sămânță și de id
  tag(id) {
    let v = this.tags.get(id);
    if (!v) {
      v = this.S.normalize(this.S.newAtom(rng((Math.imul(this.seed, 2654435761) + Math.imul(id >>> 0, 40503) + 0x9e3779b9) >>> 0)));
      this.tags.set(id, v);
    }
    return v;
  }
  comp(id) {
    let v = this.cComp.get(id);
    if (v) return v;
    const src = this.src;
    if (src.isToken(id)) v = this.tag(id);
    else {
      const d = src.def(id);
      if (d?.type === 'CHOICE') {
        const ms = [...d.members].sort((a, b) => a[0] - b[0]);
        v = this.S.normalize(this.S.bundle(ms.map(([m]) => this.comp(m)), ms.map(([, w]) => w)));
      } else {
        const ch = src.children(id);
        if (!ch) throw new Error(`comp: atomul ${id} nu are copii`);
        v = this.S.normalize(this.S.bundle(ch.map((c, k) => this.S.order(this.S.embed(this.enr(c)), k + 1))));
      }
    }
    this.cComp.set(id, v);
    return v;
  }
  enr(id) {
    let v = this.cEnr.get(id);
    if (v) return v;
    const C = this.src.choicesOf(id);
    if (!C.length || this.w === 0) v = this.comp(id);
    else v = this.S.normalize(this.S.bundle([this.comp(id), ...C.map((c) => this.tag(c))], [1, ...C.map(() => this.w)]));
    this.cEnr.set(id, v);
    return v;
  }
  detect(pid) {
    let v = this.cDetect.get(pid);
    if (v) return v;
    const d = this.src.def(pid);
    const parts = d.items.map((it, k) => {
      const x = it.fixed !== undefined ? this.enr(it.fixed) : it.slot !== undefined ? this.comp(this.src.accepts(it.slot)) : this.detect(it.sub);
      return this.S.order(this.S.embed(x), k + 1);
    });
    v = this.S.normalize(this.S.bundle(parts));
    this.cDetect.set(pid, v);
    return v;
  }
  deep(appId) {
    const d = this.src.def(appId);
    const p = this.src.def(d.pattern);
    const parts = [this.tag(d.pattern), ...p.slots.map((s, i) => this.S.bind(this.tag(s), this.S.embed(this.enr(d.fills[i]))))];
    return this.S.normalize(this.S.bundle(parts));
  }
  // valoarea unui loc, scoasă din deep prin unbind și comparată cu candidații
  readSlot(deepVec, slotId, candidates, n = 1) {
    const raw = this.S.unembed(this.S.unbind(this.tag(slotId), deepVec));
    return this.S.nearest(raw, candidates.map((id) => ({ id, v: this.enr(id) })), n);
  }
}

// Asemănarea cu vectori, cu aceeași interfață ca ExactSim (simC pe comp, simE pe enr)
export class VectorSim {
  constructor(view) {
    this.view = view;
    this.cC = new Map();
    this.cE = new Map();
  }
  simC(x, y) {
    if (x === y) return 1;
    return this.view.S.similarity(this.view.comp(x), this.view.comp(y));
  }
  simE(x, y) {
    if (x === y) return 1;
    return this.view.S.similarity(this.view.enr(x), this.view.enr(y));
  }
}

// Strategia din configurare. I13: o strategie cu vectori se folosește numai după ce trece H1–H8.
// Verificarea e o funcție pură de (nume, D, sămânță), deci rezultatul ei se ține minte.
import { makeStrategy } from '../hdc/strategy.mjs';
import { checkStrategy } from '../hdc/check.mjs';
import { fail } from '../core/invariants.mjs';
const checked = new Map();

export function strategyFor(cfg) {
  if (!cfg.strategy || cfg.strategy === 'exact') return null;
  const key = `${cfg.strategy}|${cfg.D}|${cfg.seed}`;
  if (!checked.has(key)) {
    const S = makeStrategy(cfg.strategy, { D: cfg.D, seed: cfg.seed });
    const res = checkStrategy(S, { trials: cfg.checkTrials ?? 500, seed: cfg.seed });
    if (!res.pass) fail('I13', `strategia ${cfg.strategy} (D=${cfg.D}) nu trece H1–H8: ${Object.entries(res.props).filter(([, p]) => !p.pass).map(([k]) => k).join(',')}`);
    checked.set(key, S);
  }
  return checked.get(key);
}

// asemănarea folosită de somn și de predicție: exactă sau pe vectori
export function makeSim(cfg, exactFactory, vectorSource) {
  const S = strategyFor(cfg);
  if (!S) return exactFactory();
  return new VectorSim(new VectorView(vectorSource, S, { seed: cfg.seed, w: cfg.w }));
}
