// Mărimea unei definiții și totalul memoriei (secțiunea 6).
// Lucrează printr-o „vedere”: memoria însăși sau o vedere a pachetului, în care unele definiții sunt înlocuite.

export function memoryView(mem) {
  return {
    def: (id) => mem.atoms[id].def,
    atom: (id) => mem.atoms[id],
    parents: (id) => mem.parents(id),
    isRoot: (id) => mem.roots.has(id),
    members: (c) => mem.atoms[c].def.members,
    card: (c) => mem.choiceCard(c),
    pattern: (p) => mem.atoms[p].def,
  };
}

// Unitate derivată: apare numai ca rezultat al unui tipar cuibărit, deci se reface din părinte.
export function isDerived(view, id) {
  if (view.isRoot(id)) return false;
  const ps = view.parents(id);
  if (ps.length === 0) return false;
  for (const [p, pos] of ps) {
    const d = view.def(p);
    if (d.type !== 'APP') return false;
    if (view.pattern(d.pattern).items[pos].sub === undefined) return false;
  }
  return true;
}

// context pentru măsura în biți: numărul de variante dintre care se alege
export function bitsContext(mem, extra = { atoms: 0, patterns: 0 }) {
  let atoms = 0, patterns = 0;
  for (let id = 1; id < mem.atoms.length; id++) {
    const a = mem.atoms[id];
    if (a.kind === 'TOKEN' || a.def?.type === 'SEQ' || a.def?.type === 'APP') atoms++;
    if (a.def?.type === 'PATTERN' && mem.isLive(id)) patterns++;
  }
  return { V: atoms + extra.atoms, P: patterns + extra.patterns };
}

const lg = (n) => Math.log2(Math.max(2, n));

export function defSize(view, id, measure = 'terms', bctx = null) {
  const d = view.def(id);
  if ((d.type === 'SEQ' || d.type === 'APP') && isDerived(view, id)) return 0;
  if (measure === 'terms') {
    switch (d.type) {
      case 'SEQ': return d.items.length;
      case 'CHOICE': return d.members.size;
      case 'PATTERN': return d.items.length + d.items.reduce((s, it) => s + (it.args ? it.args.length : 0) + (it.form !== undefined ? 1 : 0), 0);
      case 'APP': return 1 + d.fills.length;
      case 'PCLASS': return d.members.length + d.roles.length;
    }
  } else {
    const v = lg(bctx.V);
    switch (d.type) {
      case 'SEQ': return d.items.length * v;
      case 'CHOICE': return d.members.size * v;
      case 'PATTERN': return d.items.reduce((s, it) => s + (it.sub !== undefined ? lg(bctx.P) + (it.args.length + (it.form !== undefined ? 1 : 0)) * v : v), 0);
      case 'PCLASS': return (d.members.length + d.roles.length) * v;
      case 'APP': {
        const p = view.pattern(d.pattern);
        let s = lg(bctx.P);
        for (const st of p.slots) {
          const c = view.atom(st).accepts;
          s += lg(view.card ? view.card(c) : view.members(c).size);
        }
        return s;
      }
    }
  }
  throw new Error(`definiție necunoscută ${d.type}`);
}

// măsura amestecată: 'mix:α' = α·termeni + (1−α)·biți / log2(V)  (biții exprimați în „termeni echivalenți”)
export function parseMix(measure) {
  return typeof measure === 'string' && measure.startsWith('mix:') ? Number(measure.slice(4)) : null;
}

export function total(mem, measure = 'terms') {
  const alpha = parseMix(measure);
  if (alpha !== null) {
    const V = bitsContext(mem).V;
    return alpha * total(mem, 'terms') + ((1 - alpha) * total(mem, 'bits')) / Math.log2(Math.max(2, V));
  }
  const view = memoryView(mem);
  const bctx = measure === 'bits' ? bitsContext(mem) : null;
  let t = 0;
  for (let id = 1; id < mem.atoms.length; id++) if (mem.atoms[id].kind === 'SENSE' && mem.isLive(id)) t += defSize(view, id, measure, bctx);
  return t;
}

// rezumat pentru jurnal
export function stats(mem, measure = 'terms') {
  return {
    version: mem.version,
    total: total(mem, measure),
    patterns: mem.allOfType('PATTERN').filter((p) => mem.isLive(p)).length,
    choices: mem.allOfType('CHOICE').filter((c) => mem.isLive(c)).length,
    seq: mem.allOfType('SEQ').length,
    app: mem.allOfType('APP').length,
  };
}
