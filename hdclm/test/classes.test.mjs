// Clase de tipare cu roluri comune (D15)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainSimple } from '../src/eval/run.mjs';
import { checkInvariants } from '../src/core/invariants.mjs';
import { formalQuality } from '../src/eval/formal.mjs';
import { GPARA_GOLD } from '../src/data/gpara.mjs';
import { canon, classIndex, bearingSlots } from '../src/memory/meaning.mjs';

const r = trainSimple({ set: 'GPARA', seed: 1, overrides: { patternClasses: true, abstractShape: 'level' } });
const mem = r.mem;

test('GPARA: o clasă de tipare vie, invarianții trec, textul se reface', () => {
  const cls = mem.allOfType('PCLASS').filter((c) => mem.isLive(c));
  assert.ok(cls.length >= 1);
  for (const c of cls) {
    const d = mem.atoms[c].def;
    for (const role of d.roles) assert.equal(mem.atoms[role].pclass, c); // rolurile aparțin clasei
    for (const m of d.members) assert.equal(d.align[m].length, mem.atoms[m].def.slots.length);
  }
  checkInvariants(mem);
  assert.equal(r.recon, 1);
});

test('GPARA: nicio clasă nu amestecă sensuri (MOVE, HAVE, LEAVE)', () => {
  const q = formalQuality(mem, r.roots.map((x) => x.id), { meanings: GPARA_GOLD.meanings });
  assert.deepEqual(q.gold.falseMerges, []);
  assert.equal(q.gold.perMeaning.MOVE.purity, 1);
});

test('GPARA: reformulările MOVE ale aceluiași fapt au aceeași ecuație canonică', () => {
  const b = bearingSlots(mem), ci = classIndex(mem);
  const facts = new Map();
  for (const u of mem.allOfType('APP')) {
    const w = mem.unfold(u).map((t) => mem.atoms[t].text);
    const m = w.join(' ').match(/^(\w+) (moved|went back|went|travelled) to the (\w+) \.$/);
    if (!m) continue;
    const key = `${m[1]}|${m[3]}`;
    if (!facts.has(key)) facts.set(key, new Set());
    facts.get(key).add(canon(mem, u, b, ci));
  }
  const multi = [...facts.values()];
  const same = multi.filter((s) => s.size === 1).length;
  assert.ok(same / multi.length >= 0.5, `doar ${same}/${multi.length} fapte au o singură ecuație canonică`);
});
