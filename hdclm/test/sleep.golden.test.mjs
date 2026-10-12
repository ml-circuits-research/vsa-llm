import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/core/config.mjs';
import { Memory } from '../src/memory/store.mjs';
import { ingest } from '../src/wake/ingest.mjs';
import { generateSet, NAMES } from '../src/data/generate.mjs';
import { deepSleep } from '../src/sleep/scheduler.mjs';
import { total, isDerived, memoryView } from '../src/memory/size.mjs';

// mecanismul din specificație, fără reparațiile din etapele 1–2 (valorile de aur sunt date în termeni)
const SPEC = { measure: 'terms', alternatives: false, multiInterp: false, abstractGroups: false };

function build(name, cfg = loadConfig(SPEC)) {
  const mem = new Memory(cfg);
  for (const d of generateSet(name, 1, { holdout: false }).docs) ingest(mem, d.text, { docName: d.id });
  return mem;
}

test('G1: 2 tipare, o alegere cu 10 nume, total 60 -> 56', () => {
  const cfg = loadConfig(SPEC);
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
  const cfg = loadConfig(SPEC);
  const mem = build('G4', cfg);
  const t = total(mem);
  deepSleep(mem, cfg);
  assert.equal(mem.allOfType('PATTERN').length, 0);
  assert.equal(total(mem), t);
});

test('G7: regula „răspuns = numele din fapt” (loc legat de două ori)', () => {
  const cfg = loadConfig(SPEC);
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
  const cfg = loadConfig(SPEC);
  const run = () => {
    const mem = build('G7', cfg);
    deepSleep(mem, cfg);
    return mem.toJSONL();
  };
  assert.equal(run(), run());
});

// configurarea implicită (biți + alternative + interpretări multiple + grupare abstractă)
import { trainSimple } from '../src/eval/run.mjs';
import { answerAccuracy } from '../src/eval/metrics.mjs';

function rulesOf(mem, level) {
  return mem.allOfType('PATTERN').filter((p) => mem.isLive(p) && mem.atoms[p].level === level);
}

test('G7 implicit: o singură regulă generală [Fapt(S1,S2), Întrebare(S2), Răspuns(S1)]', () => {
  const r = trainSimple({ set: 'G7' });
  const rules = rulesOf(r.mem, 4);
  assert.equal(rules.length, 1);
  const d = r.mem.atoms[rules[0]].def;
  assert.equal(d.items.length, 3);
  assert.ok(d.items.every((it) => it.sub !== undefined));
  assert.equal(d.slots.length, 2);
  const [a, b, c] = d.items.map((it) => it.args);
  assert.deepEqual([a.length, b.length, c.length], [2, 1, 1]);
  assert.ok(b[0] === a[1] && c[0] === a[0]); // obiectul din întrebare și numele din răspuns vin din fapt
  assert.equal(r.recon, 1);
  assert.equal(answerAccuracy(r.mem, r.cfg, r.split.test.filter((x) => x.heldout)).acc, 1);
});

test('G8 implicit: regula cu doi pași, 100% pe combinațiile puse deoparte', () => {
  const r = trainSimple({ set: 'G8' });
  const rules = rulesOf(r.mem, 4);
  assert.equal(rules.length, 1);
  assert.equal(r.mem.atoms[rules[0]].def.items.length, 4);
  assert.equal(answerAccuracy(r.mem, r.cfg, r.split.test.filter((x) => x.heldout)).acc, 1);
});
