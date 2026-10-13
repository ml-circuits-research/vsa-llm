// Trecerea de concepte (somnul adânc): din comportamentul atomilor, rețeaua de concepte devine memorie.
//  - concepte de valori (valori care apar în aceleași locuri) -> alegeri semantice (persoane, locuri…),
//    adăugate valorilor: valorile de același fel se apropie și în vectori (îmbogățirea)
//  - concepte de tipare (forme cu aceeași intensiune) -> clase de tipare cu roluri tipizate de conceptele
//    de valori; ierarhia se păstrează în `isa` (părinții din rețea). Un concept cu atribute de funcție
//    (aceleași legături în reguli) înseamnă același sens; unul doar de tip este o ipoteză mai generală.
// Atomii noi nu sunt folosiți de nicio aplicare, deci nu schimbă totalul; regulile de mai târziu îi pot
// folosi (ridicarea refolosește o clasă existentă), iar atunci judecata îi plătește.
import { patternProfilesByValues, conceptLattice } from '../memory/concepts.mjs';

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function conceptPass(mem, cfg) {
  const level = 3;
  const { pats, prof, vc } = patternProfilesByValues(mem, level, cfg.theta_merge ?? 0.5);
  let ref = -1;
  const pkg = { newChoices: [], addMembers: [], newPatterns: [], newClasses: [], classAdds: [], rewrites: [], seen: {}, meta: [] };
  // 1. concepte de valori -> alegeri (refolosite dacă există deja una cu exact aceiași membri)
  const choices = mem.allOfType('CHOICE');
  const catChoice = new Map(); // indexul conceptului de valori -> id-ul alegerii
  vc.groups.forEach((g, k) => {
    if (g.length < 2) return;
    const ex = choices.find((c) => sameSet([...mem.atoms[c].def.members.keys()], g));
    if (ex !== undefined) return catChoice.set(k, ex);
    const tmp = ref--;
    const counts = new Map(g.map((v) => [v, vc.attrs.get(v).size]));
    pkg.newChoices.push({ tmp, level: Math.max(...g.map((v) => mem.level(v))), members: g.map((v) => [v, counts.get(v)]) });
    pkg.meta.push({ ref: tmp, concept: { kind: 'valori', size: g.length } });
    catChoice.set(k, tmp);
  });
  // 2. concepte de tipare -> clase (cel puțin două forme, aceeași aritate)
  const objs = pats.filter((p) => mem.atoms[p].def.slots.length >= 1 && mem.usage(p) >= 2);
  const lattice = conceptLattice(objs, prof);
  const classes = mem.allOfType('PCLASS');
  const made = new Map();
  for (const c of lattice) {
    if (c.extent.length < 2) continue;
    const k = mem.atoms[c.extent[0]].def.slots.length;
    if (!c.extent.every((p) => mem.atoms[p].def.slots.length === k)) continue;
    const types = [...Array(k).keys()].map((j) => [...c.intent].find((a) => a.startsWith(`T${j}:V`))?.slice(`T${j}:V`.length));
    if (types.some((t) => t === undefined || !catChoice.has(Number(t)))) continue; // roluri fără tip curat
    // o ipoteză (fără dovadă funcțională) cere cel puțin două roluri tipizate: un singur tip comun
    // („e vorba de o persoană”) e o dovadă prea slabă pentru a uni forme
    const functionalIntent = [...c.intent].some((a) => a.startsWith('F:'));
    if (!functionalIntent && k < 2) continue;
    if (classes.some((x) => sameSet(mem.atoms[x].def.members, c.extent))) continue;
    // alinierea: locul j al fiecărui membru merge la rolul cu același tip (aici, aceeași ordine)
    const cls = ref--;
    const roles = types.map((t) => ({ tmp: ref--, accepts: catChoice.get(Number(t)) }));
    const identity = [...Array(k).keys()];
    pkg.newClasses.push({ tmp: cls, level, members: c.extent.slice().sort((a, b) => a - b), roles, align: c.extent.map((p) => [p, identity]) });
    const functional = [...c.intent].some((a) => a.startsWith('F:'));
    pkg.meta.push({ ref: cls, concept: { kind: functional ? 'sens' : 'ipoteză', intent: [...c.intent].sort() } });
    made.set(c, cls);
  }
  // ierarhia: părinții din rețea
  for (const [c, cls] of made) pkg.meta.find((x) => x.ref === cls).isa = c.parents.filter((p) => made.has(p)).map((p) => made.get(p));
  if (!pkg.newChoices.length && !pkg.newClasses.length) return { changed: false, choices: 0, classes: 0 };
  mem.beginPass();
  mem.commit(pkg);
  return { changed: true, choices: pkg.newChoices.length, classes: pkg.newClasses.length, functional: pkg.meta.filter((x) => x.concept?.kind === 'sens').length };
}
