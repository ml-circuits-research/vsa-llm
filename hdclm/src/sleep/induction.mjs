// Inducția (D19, somnul adânc): „dacă merge ca o rață și măcăne ca o rață”. O ipoteză din rețeaua de
// concepte (forme cu aceeași intensiune de tip) care cuprinde strict o clasă confirmată funcțional (o clasă
// vie, folosită de reguli) propune ca formele în plus să fie tratate ca membrii clasei. Propunerea se testează
// prin consecințe, nu prin asemănare: pe o copie, forma intră în clasă și somnul alternativelor rulează până
// se oprește; pe o altă copie (martorul), același somn fără adăugare. Forma rămâne în clasă numai dacă memoria
// cu ea este mai scurtă decât martorul: regulile clasei explică acum și datele formei noi.
// Altfel ipoteza rămâne doar ierarhie (concept mai general, `isa`), fără unificare.
// Judecata e cea unică (D20): MDL față de martor + contraexemple + validare.
import { alternativePass } from './alternatives.mjs';
import { sleepPass } from './pass.mjs';
import { total } from '../memory/size.mjs';
import { judgeGeneralization, patternsUsing } from './generalize.mjs';

const EPS = 1e-9;

function settle(mem, cfg, rounds) {
  for (let i = 0; i < rounds; i++) {
    const r = sleepPass(mem, cfg, {});
    if (r.after < r.before - EPS) continue;
    if (!alternativePass(mem, cfg).changed) break;
  }
  return total(mem, cfg.measure ?? 'terms');
}

// perechile (clasă confirmată F, formă d) propuse de ipoteze H ⊃ F
export function inductionCandidates(mem) {
  const classes = mem.allOfType('PCLASS');
  const out = [];
  for (const H of classes) {
    if (mem.atoms[H].concept?.kind !== 'ipoteză') continue;
    const h = mem.atoms[H].def;
    for (const F of classes) {
      if (F === H || !mem.isLive(F)) continue;
      const f = mem.atoms[F].def;
      if (!f.members.every((m) => h.align[m])) continue;
      if (f.members.length >= h.members.length) continue;
      // alinierile trebuie să fie compatibile: rolul j al lui H corespunde aceluiași rol al lui F pentru toți membrii lui F
      const map = new Map();
      let ok = f.roles.length === h.roles.length;
      for (const m of f.members)
        f.align[m].forEach((r, k) => {
          const hr = h.align[m][k];
          if (map.has(hr) && map.get(hr) !== r) ok = false;
          map.set(hr, r);
        });
      if (!ok) continue;
      for (const d of h.members) {
        if (f.align[d]) continue;
        const al = h.align[d].map((hr) => map.get(hr));
        if (al.some((r) => r === undefined)) continue;
        out.push({ F, H, form: d, align: al });
      }
    }
  }
  return out;
}

export function inductionPass(mem, cfg, { validate } = {}) {
  const rounds = cfg.inductionRounds ?? 6;
  const cands = inductionCandidates(mem);
  const tried = [];
  let accepted = 0;
  for (const c of cands) {
    if (mem.atoms[c.F].def.align[c.form]) continue; // adăugată deja
    const control = mem.clone();
    const tBase = settle(control, cfg, rounds);
    const test = mem.clone();
    test.beginPass();
    test.commit({ classAdds: [{ cls: c.F, align: [[c.form, c.align]] }] }, { check: false });
    settle(test, cfg, rounds);
    // judecata unică (D20): martorul joacă rolul memoriei de acum
    const J = judgeGeneralization(control, test, cfg, { patterns: patternsUsing(control, { cls: c.F }), validate, before: tBase });
    tried.push({ cls: c.F, hypothesis: c.H, form: c.form, gain: +J.gain.toFixed(3), claimed: J.claimed, predDelta: +J.predDelta.toFixed(3), valDelta: +J.valDelta.toFixed(4) });
    if (J.accept) {
      mem.beginPass();
      mem.commit({ classAdds: [{ cls: c.F, align: [[c.form, c.align]] }] });
      accepted++;
    }
  }
  return { changed: accepted > 0, accepted, tried };
}
