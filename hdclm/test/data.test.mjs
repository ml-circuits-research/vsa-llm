import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSet, splitDocs, saveSplit, NAMES } from '../src/data/generate.mjs';

const SETS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G7', 'G8', 'G9'];

test('determinism', () => {
  for (const n of SETS) {
    assert.equal(JSON.stringify(generateSet(n, 3)), JSON.stringify(generateSet(n, 3)));
    assert.equal(JSON.stringify(splitDocs(generateSet(n, 3), 5)), JSON.stringify(splitDocs(generateSet(n, 3), 5)));
  }
  assert.notEqual(JSON.stringify(generateSet('G4', 1)), JSON.stringify(generateSet('G4', 2)));
});

test('split: fără suprapuneri, held-out nu e în train', () => {
  for (const n of SETS) {
    for (const opt of [{}, { allTrain: true }]) {
      const set = generateSet(n, 1);
      const sp = splitDocs(set, 1, opt);
      const ids = [...sp.train, ...sp.val, ...sp.test].map((d) => d.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(ids.length, set.docs.length);
      assert.ok(sp.train.every((d) => !d.heldout));
      if (opt.allTrain) {
        assert.ok(sp.val.every((d) => d.heldout) && sp.test.every((d) => d.heldout));
      }
    }
  }
});

test('G7: 100 docs, 30 held-out, 3 per nume și per obiect', () => {
  const s = generateSet('G7');
  assert.equal(s.docs.length, 100);
  const h = s.docs.filter((d) => d.heldout);
  assert.equal(h.length, 30);
  const cn = {}, co = {};
  for (const d of h) {
    cn[d.meta.name] = (cn[d.meta.name] ?? 0) + 1;
    co[d.meta.object] = (co[d.meta.object] ?? 0) + 1;
  }
  assert.equal(Object.keys(cn).length, NAMES.length);
  assert.ok(Object.values(cn).every((v) => v === 3));
  assert.equal(Object.keys(co).length, 10);
  assert.ok(Object.values(co).every((v) => v === 3));
});

test('G1: 20 propoziții distincte (set complet)', () => {
  const s = generateSet('G1', 1, { holdout: false });
  assert.equal(new Set(s.docs.map((d) => d.text)).size, 20);
  assert.ok(s.docs.every((d) => !d.heldout));
  assert.equal(generateSet('G1').docs.filter((d) => d.heldout).length, 4);
});

test('G6 și saveSplit', () => {
  assert.throws(() => generateSet('G6'), /GPT-2/);
  const dir = mkdtempSync(join(tmpdir(), 'hdclm-'));
  const sp = splitDocs(generateSet('G2'), 1);
  saveSplit(join(dir, 'x'), sp);
  const j = JSON.parse(readFileSync(join(dir, 'x', 'split.json'), 'utf8'));
  assert.equal(j.train.length, sp.train.length);
});
