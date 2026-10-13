// Alegeri tipizate (D18): un loc acceptă orice aplicare a unui tipar sau a unei clase
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainSimple } from '../src/eval/run.mjs';
import { checkInvariants } from '../src/core/invariants.mjs';
import { total } from '../src/memory/size.mjs';
import { typePass } from '../src/sleep/types.mjs';

const r = trainSimple({ set: 'G9', seed: 1 });
const mem = r.mem;
const appMembers = (m, c) => [...m.atoms[c].def.members.keys()].filter((x) => m.atoms[x].def?.type === 'APP');

test('G9: o alegere de aplicări rescrisă cu tipul ei păstrează membrii, textul și invarianții', () => {
  const c = mem.allOfType('CHOICE').find((x) => mem.isLive(x) && appMembers(mem, x).length >= 2);
  assert.ok(c !== undefined);
  const old = [...mem.atoms[c].def.members.keys()];
  const k = mem.clone();
  // fiecare aplicare -> tiparul ei
  const members = new Map();
  for (const [m, w] of k.atoms[c].def.members) {
    const d = k.atoms[m].def;
    const key = d.type === 'APP' ? d.pattern : m;
    members.set(key, (members.get(key) ?? 0) + w);
  }
  const units = k.allOfType('APP').map((u) => [u, k.unfold(u).join(',')]);
  k.beginPass();
  k.commit({ retype: [{ choice: c, members: [...members] }] });
  assert.equal(k.atoms[c].def.typed, true);
  for (const m of old) assert.ok(k.inChoice(c, m), `${m} nu mai e acceptat`);
  assert.ok(k.choiceCard(c) >= old.length);
  for (const [u, t] of units) assert.equal(k.unfold(u).join(','), t);
  checkInvariants(k);
  // memoria de pe disc păstrează tipizarea
  assert.match(k.toJSONL(), /"typed":true/);
  assert.equal(k.clone().atoms[c].def.typed, true);
});

test('G9: trecerea de tipuri nu crește totalul și păstrează invarianții', () => {
  const k = mem.clone();
  const before = total(k, 'bits');
  const t = typePass(k, r.cfg);
  assert.ok(total(k, 'bits') <= before + 1e-9);
  checkInvariants(k);
  assert.ok(t.tried.length >= 1);
});
