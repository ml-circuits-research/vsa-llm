// Asemănarea exactă (secțiunea 7): referința pentru orice strategie cu vectori.
//   simC(x, y): asemănarea compozițiilor;  simE(x, y): asemănarea valorilor îmbogățite.
// Rezultatele se țin minte după pereche; o instanță aparține unei singure versiuni a memoriei.
// src = { isToken(id), children(id), choicesOf(id) }  (permite și unități temporare, la predicție)

export class ExactSim {
  constructor(src, w) {
    this.src = src;
    this.w2 = w * w;
    this.cC = new Map();
    this.cE = new Map();
  }
  static memorySource(mem, extraChoices = null) {
    return {
      isToken: (id) => mem.isToken(id),
      children: (id) => mem.children(id),
      choicesOf: (id) => {
        const base = mem.atoms[id]?.choices ?? [];
        const extra = extraChoices?.get(id);
        return extra ? [...new Set([...base, ...extra])] : base;
      },
    };
  }
  key(x, y) {
    return x < y ? `${x},${y}` : `${y},${x}`;
  }
  simC(x, y) {
    if (x === y) return 1;
    const k = this.key(x, y);
    let v = this.cC.get(k);
    if (v !== undefined) return v;
    const s = this.src;
    if (s.isToken(x) || s.isToken(y)) v = 0;
    else {
      const cx = s.children(x), cy = s.children(y);
      if (!cx || !cy) v = 0;
      else {
        const n = Math.min(cx.length, cy.length);
        let sum = 0;
        for (let i = 0; i < n; i++) sum += this.simE(cx[i], cy[i]);
        v = sum / Math.sqrt(cx.length * cy.length);
      }
    }
    this.cC.set(k, v);
    return v;
  }
  simE(x, y) {
    if (x === y) return 1;
    const k = this.key(x, y);
    let v = this.cE.get(k);
    if (v !== undefined) return v;
    const Cx = this.src.choicesOf(x), Cy = this.src.choicesOf(y);
    let common = 0;
    if (Cx.length && Cy.length) {
      const sy = new Set(Cy);
      for (const c of Cx) if (sy.has(c)) common++;
    }
    const w2 = this.w2;
    v = (this.simC(x, y) + w2 * common) / Math.sqrt((1 + w2 * Cx.length) * (1 + w2 * Cy.length));
    this.cE.set(k, v);
    return v;
  }
}
