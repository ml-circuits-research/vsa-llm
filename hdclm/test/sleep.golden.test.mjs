import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/core/config.mjs';
import { Memory } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { generateSet, NAMES } from '../src/data/generate.mjs';
import { deepSleep } from '../src/sleep/scheduler.mjs';
import { total, isDerived, memoryView } from '../src/memory/size.mjs';

function build(name, cfg = loadConfig({})) {
  const mem = new Memory(cfg);
  for (const d of generateSet(name, 1, { holdout: false }).docs) ingest(mem, d.text, { docName: d.id });
  return mem;
}

test('G1: 2 tipare, o alegere cu 10 nume, total 60 -> 56', () => {
  const cfg = loadConfig({});
  const mem = build('G1', cfg);
  const roots = [...mem.roots.keys()];
  const unf = roots.map((r) => mem.unfold(r).slice());
  assert.equal(total(mem), 60);
  deepSleep(mem, cfg);
  assert.equal(mem.allOfType('PATTERN').length, 2);
  const ch = mem.allOfType('CHOICE');
  assert.equal(ch.length, 1);
  const names = [...mem.members(ch[0]).keys()].map((m) => mem.atoms[m].text).sort();
  assert.deepEqual(names, NAMES.slice().sort());
  assert.equal(total(mem), 56);
  // fiecare frază e acum o aplicare, textul rămâne la fel
  roots.forEach((r, i) => {
    assert.equal(mem.def(r).type, 'APP');
    assert.deepEqual(mem.unfold(r, { fresh: true }), unf[i]);
  });
  assert.equal(mem.allOfType('SEQ').length, 0);
});

test('G4 (zgomot): niciun tipar, totalul neschimbat', () => {
  const cfg = loadConfig({});
  const mem = build('G4', cfg);
  const t = total(mem);
  deepSleep(mem, cfg);
  assert.equal(mem.allOfType('PATTERN').length, 0);
  assert.equal(total(mem), t);
});

test('G7: regula „răspuns = numele din fapt” (loc legat de două ori)', () => {
  const cfg = loadConfig({});
  const mem = build('G7', cfg);
  deepSleep(mem, cfg);
  const twice = (p) => {
    const subs = mem.atoms[p].def.items.filter((it) => it.sub !== undefined);
    return subs.length === 2 && subs[0].args.some((a) => subs[1].args.includes(a));
  };
  const l4 = mem.allOfType('PATTERN').filter((p) => mem.atoms[p].level === 4);
  const rules = l4.filter(twice);
  assert.ok(rules.length >= 1);
  for (const p of rules) assert.equal(mem.atoms[p].def.slots.length, 1);
  // frazele din interiorul regulii sunt derivate (se refac din părinte)
  const view = memoryView(mem);
  const apps = mem.allOfType('APP').filter((u) => rules.includes(mem.def(u).pattern));
  assert.ok(apps.length > 0);
  for (const u of apps) assert.equal(isDerived(view, mem.children(u)[0]), true);
});

test('determinism: două rulări G7 dau același JSONL', () => {
  const cfg = loadConfig({});
  const run = () => {
    const mem = build('G7', cfg);
    deepSleep(mem, cfg);
    return mem.toJSONL();
  };
  assert.equal(run(), run());
});
