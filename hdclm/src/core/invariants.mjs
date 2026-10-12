// checkInvariants(memory): verificările din secțiunea 13 care se pot face pe memorie.
// Nu importă nimic din memory/: lucrează prin interfața obiectului Memory.

export class InvariantError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

export function fail(code, message) {
  throw new InvariantError(code, message);
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export function checkInvariants(mem, { before = null } = {}) {
  const K = mem.K;
  let units = 0;
  for (let id = 1; id < mem.atoms.length; id++) {
    const a = mem.atoms[id];
    if (a.kind !== 'SENSE') continue;
    const d = a.def;
    if (d.type === 'SEQ' || d.type === 'APP') {
      units++;
      const ch = mem.children(id);
      // I3: o unitate, un id
      if (mem.lookup(ch) !== id) fail('I3', `atom ${id} nu este cel internat pentru copiii lui`);
      if (d.type === 'SEQ' && (d.items.length < 1 || d.items.length > K)) fail('I4', `înșiruirea ${id} are ${d.items.length} copii`);
      if (d.type === 'APP') {
        // I6: aplicare validă
        const p = mem.atoms[d.pattern];
        if (!p || p.def?.type !== 'PATTERN') fail('I6', `aplicarea ${id} nu arată spre un tipar`);
        if (d.fills.length !== p.def.slots.length) fail('I6', `aplicarea ${id}: ${d.fills.length} valori pentru ${p.def.slots.length} locuri`);
        d.fills.forEach((v, i) => {
          const s = mem.atoms[p.def.slots[i]];
          if (!mem.members(s.accepts).has(v)) fail('I6', `aplicarea ${id}: valoarea ${v} nu este membru al alegerii ${s.accepts}`);
        });
      }
    } else if (d.type === 'CHOICE') {
      if (d.members.size < 2) fail('I4', `alegerea ${id} are ${d.members.size} membri`);
    } else if (d.type === 'PATTERN') {
      if (d.items.length < 1 || d.items.length > K) fail('I4', `tiparul ${id} are ${d.items.length} copii`);
      const anchored = d.items.some((it) => it.fixed !== undefined || it.sub !== undefined);
      if (!anchored) fail('I5', `tiparul ${id} nu are niciun copil fix sau cuibărit`);
      if (d.slots.length < 1) fail('I5', `tiparul ${id} nu are niciun loc liber`);
      for (const s of d.slots) {
        const st = mem.atoms[s];
        if (!st || st.kind !== 'STRUCT' || st.pattern !== id) fail('I5', `locul ${s} nu aparține tiparului ${id}`);
      }
      for (const it of d.items) {
        const used = it.slot !== undefined ? [it.slot] : [...(it.args ?? []), ...(it.form !== undefined ? [it.form] : [])];
        for (const s of used) if (!d.slots.includes(s)) fail('I5', `tiparul ${id} folosește locul ${s} nedeclarat`);
        if (it.sub !== undefined) {
          const q = mem.atoms[it.sub]?.def;
          const need = q?.type === 'PCLASS' ? q.roles.length : q?.slots?.length;
          if (need !== it.args.length) fail('I5', `tiparul ${id}: ${it.args.length} argumente pentru ${need}`);
          if (q?.type === 'PCLASS' && it.form === undefined) fail('I5', `tiparul ${id}: clasa ${it.sub} fără locul formei`);
        }
      }
    } else if (d.type === 'PCLASS') {
      // I5 (D15): rolurile aparțin clasei și sunt comune membrilor; fiecare membru e un tipar, aliniat la roluri
      for (const r of d.roles) {
        const st = mem.atoms[r];
        if (!st || st.kind !== 'STRUCT' || st.pclass !== id) fail('I5', `rolul ${r} nu aparține clasei ${id}`);
      }
      if (d.members.length < 1) fail('I4', `clasa ${id} nu are membri`);
      for (const m of d.members) {
        const md = mem.atoms[m]?.def;
        if (md?.type !== 'PATTERN') fail('I5', `membrul ${m} al clasei ${id} nu este tipar`);
        const al = d.align[m];
        if (!al || al.length !== md.slots.length || al.some((r) => r < 0 || r >= d.roles.length)) fail('I5', `alinierea membrului ${m} în clasa ${id} este greșită`);
      }
    }
  }
  // I15: nimic nu se pierde
  if (units < (mem._maxUnits ?? 0)) fail('I15', `numărul de unități a scăzut: ${units} < ${mem._maxUnits}`);
  mem._maxUnits = units;
  // I1, I2: atomii atinși de commit
  if (before) {
    for (const [id, snap] of before) {
      if (!same(mem.children(id), snap.children)) fail('I2', `copiii lui ${id} s-au schimbat`);
      if (!same(mem.unfold(id, { fresh: true }), snap.unfold)) fail('I1', `textul lui ${id} s-a schimbat`);
    }
  }
  return true;
}
