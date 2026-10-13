import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/core/config.mjs';
import { Memory, LEVELS } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { generateSet } from '../src/data/generate.mjs';
import { deepSleep } from '../src/sleep/scheduler.mjs';
import { total } from '../src/memory/size.mjs';
import { PassContext } from '../src/sleep/context.mjs';
import { recognize } from '../src/sleep/recognize.mjs';
import { group } from '../src/sleep/group.mjs';
import { propose } from '../src/sleep/propose.mjs';
import { Judge } from '../src/sleep/package.mjs';

// mecanismul din specificație, fără reparațiile din etapele 1–2 (valorile de aur sunt date în termeni)
const SPEC = { measure: 'terms', alternatives: false, multiInterp: false, abstractGroups: false };

function g1(cfg) {
  const mem = new Memory(cfg);
  for (const d of generateSet('G1', 1, { holdout: false }).docs) ingest(mem, d.text, { docName: d.id });
  return mem;
}

test('judecata pachetului: 60 -> 56', () => {
  const cfg = loadConfig(SPEC);
  const mem = g1(cfg);
  assert.equal(total(mem), 60);
  deepSleep(mem, cfg);
  assert.equal(total(mem), 56);
});

test('acceptare una câte una: 60 rămâne 60, niciun tipar', () => {
  const cfg = loadConfig({ ...SPEC, packageJudge: false });
  const mem = g1(cfg);
  deepSleep(mem, cfg);
  assert.equal(total(mem), 60);
  assert.equal(mem.allOfType('PATTERN').length, 0);
});

test('câștig 7 în pachet, -3 singur', () => {
  const cfg = loadConfig(SPEC);
  const mem = g1(cfg);
  mem.beginPass();
  const ctx = new PassContext(mem, cfg);
  for (let level = 1; level <= LEVELS; level++) {
    const units = [...new Set([...mem.buffer[level], ...mem.residue[level]])].filter((u) => mem.atoms[u].def.type === 'SEQ').sort((a, b) => a - b);
    ctx.seen[level] = units;
    if (!units.length) continue;
    const { rest } = recognize(ctx, units, level);
    propose(ctx, group(ctx, rest, level), level);
  }
  const judge = new Judge(ctx);
  const pids = judge.props.map((p) => p.pattern);
  assert.equal(pids.length, 2);
  const all = new Set(pids);
  for (const pid of pids) {
    assert.equal(judge.gain(pid, all), 7);
    const one = new Set([pid]);
    const reg = judge.region(one);
    assert.equal(judge.cost(reg, new Set()) - judge.cost(reg, one), -3);
  }
});
