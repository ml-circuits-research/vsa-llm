import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/core/config.mjs';
import { Memory } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { generateSet } from '../src/data/generate.mjs';
import { sleepPass } from '../src/sleep/pass.mjs';
import { checkInvariants } from '../src/core/invariants.mjs';

const cfg = loadConfig({});
function slept(name) {
  const mem = new Memory(cfg);
  for (const d of generateSet(name, 1, { holdout: false }).docs) ingest(mem, d.text, { docName: d.id });
  for (let i = 0; i < 5; i++) {
    const r = sleepPass(mem, cfg);
    assert.equal(checkInvariants(mem), true);
    if (!(r.after < r.before)) break;
  }
  return mem;
}
const code = (c) => (e) => e.code === c;

for (const g of ['G1', 'G2', 'G7']) test(`invarianți după fiecare trecere pe ${g}`, () => slept(g));

test('I3: internIndex arată alt id', () => {
  const mem = slept('G1');
  const u = mem.allOfType('APP')[0];
  mem.internIndex.set(mem.children(u).join(','), u + 1);
  assert.throws(() => checkInvariants(mem), code('I3'));
});

test('I4: alegere cu un singur membru', () => {
  const mem = slept('G1');
  // alegere nouă, nefolosită de nimeni, cu un singur membru
  const id = mem.atoms.length;
  mem.atoms.push({ id, kind: 'SENSE', level: 1, def: { type: 'CHOICE', members: new Map([[1, 1]]) }, count: 0, choices: [] });
  assert.throws(() => checkInvariants(mem), code('I4'));
});

test('I5: tipar fără copil fix', () => {
  const mem = slept('G1');
  const p = mem.allOfType('PATTERN')[0];
  const d = mem.atoms[p].def;
  d.items = d.items.map(() => ({ slot: d.slots[0] }));
  assert.throws(() => checkInvariants(mem), code('I5'));
});

test('I7: intern în timpul trecerii', () => {
  const mem = slept('G1');
  const a = mem.token('a'), b = mem.token('b');
  mem.beginPass();
  assert.throws(() => mem.intern({ type: 'SEQ', items: [a, b] }, 1), code('I7'));
});
