// Somnul adânc cu interpretări alternative (reparația pentru A1/G2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainSimple } from '../src/eval/run.mjs';
import { describe, total } from '../src/eval/metrics.mjs';
import { checkInvariants } from '../src/core/invariants.mjs';

test('G2, biți, cu alternative: două tipare cu aceleași alegeri, refacere 100%', () => {
  const r = trainSimple({ set: 'G2', overrides: { measure: 'bits', alternatives: true }, splitOpts: { allTrain: true }, validate: false });
  const d = describe(r.mem);
  assert.equal(d.patterns.length, 2);
  for (const p of d.patterns) assert.equal(p.slots.length, 2);
  assert.equal(d.choices.length, 2);
  assert.equal(r.recon, 1);
  assert.ok(total(r.mem, 'bits') < r.before.total);
  checkInvariants(r.mem);
});

test('G2, termeni, cu alternative: tiparul cu două locuri nu se plătește', () => {
  const r = trainSimple({ set: 'G2', overrides: { measure: 'terms', alternatives: true }, splitOpts: { allTrain: true }, validate: false });
  assert.equal(describe(r.mem).patterns.length, 10);
});

test('tiparele rămase fără aplicări nu mai costă și nu mai recunosc', () => {
  const r = trainSimple({ set: 'G2', overrides: { measure: 'bits', alternatives: true }, splitOpts: { allTrain: true }, validate: false });
  const dead = r.mem.allOfType('PATTERN').filter((p) => r.mem.usage(p) === 0);
  assert.ok(dead.length > 0);
  for (let l = 1; l <= 5; l++) for (const p of r.mem.livePatterns(l)) assert.ok(r.mem.usage(p) > 0);
});
