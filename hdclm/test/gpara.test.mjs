import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSet } from '../src/data/generate.mjs';
import { GPARA_GOLD } from '../src/data/gpara.mjs';

// parser independent: o propoziție -> {name, verb, arg}
const VERBS = [
  ...GPARA_GOLD.meanings.MOVE.map((v) => [v === 'went back' ? 'went back to' : v === 'went' ? 'went to' : v === 'moved' ? 'moved to' : 'travelled to', 'MOVE']),
  ...GPARA_GOLD.meanings.HAVE.map((v) => [v, 'HAVE']),
  ['left', 'LEAVE'],
];
function parse(s) {
  const m = /^(\w+) (.+) (?:the )(\w+)\.$/.exec(s);
  assert.ok(m, s);
  const v = VERBS.find(([w]) => w === m[2]);
  assert.ok(v, `verb ${m[2]}`);
  return { name: m[1], verb: m[2], meaning: v[1], arg: m[3] };
}
function split(d) {
  const p = d.meta.prompt;
  const qi = p.search(/(Where is|What does) /);
  const facts = p.slice(0, qi).trim().split(/(?<=\.) /);
  assert.equal(facts.length, 2);
  return { facts: facts.map(parse), q: p.slice(qi) };
}
function derive(d) {
  const { facts, q } = split(d);
  const name = /^(?:Where is|What does) (\w+)/.exec(q)[1];
  const mine = facts.filter((f) => f.name === name);
  if (q.startsWith('Where')) {
    const mv = mine.filter((f) => f.meaning === 'MOVE');
    return mv[mv.length - 1].arg;
  }
  return mine.find((f) => f.meaning === 'HAVE').arg;
}
const combos = (d) => {
  const { facts } = split(d);
  const name = /^(?:Where is|What does) (\w+)/.exec(split(d).q)[1];
  return { facts, asked: facts.find((f) => f.name === name && f.meaning === d.meta.meaningAsked) };
};
const key = (f) => `${f.verb}|${f.name}|${f.arg}`;

test('GPARA determinist, ~300 docuri', () => {
  for (const s of [1, 2, 3]) {
    const a = generateSet('GPARA', s);
    assert.equal(JSON.stringify(a), JSON.stringify(generateSet('GPARA', s)));
    assert.equal(a.docs.length, 300);
    console.log(`GPARA seed ${s}: total ${a.docs.length}, heldout ${a.docs.filter((d) => d.heldout).length}`);
  }
  assert.notEqual(JSON.stringify(generateSet('GPARA', 1)), JSON.stringify(generateSet('GPARA', 2)));
});

test('GPARA răspunsuri corecte, LEAVE -> locul MOVE', () => {
  for (const s of [1, 2, 3]) {
    let leave = 0;
    for (const d of generateSet('GPARA', s).docs) {
      assert.equal(derive(d), d.meta.answer, d.text);
      assert.ok(d.text.endsWith(` ${d.meta.answer}.`));
      assert.ok(d.text.startsWith(d.meta.prompt));
      if (d.meta.trap) {
        leave++;
        const { facts } = split(d);
        const l = facts.find((f) => f.meaning === 'LEAVE'), m = facts.find((f) => f.meaning === 'MOVE');
        assert.equal(l.name, m.name);
        assert.notEqual(l.arg, m.arg);
        assert.equal(d.meta.answer, m.arg);
      } else assert.notEqual(split(d).facts[0].name, split(d).facts[1].name);
    }
    assert.ok(leave > 40);
  }
});

test('GPARA held-out (i) și (ii) exact', () => {
  for (const s of [1, 2, 3]) {
    const docs = generateSet('GPARA', s).docs;
    const train = docs.filter((d) => !d.heldout), held = docs.filter((d) => d.heldout);
    assert.ok(held.length > 0 && train.length > 0);
    const heldKeys = new Set();
    for (const d of held) {
      const { asked } = combos(d);
      const rare = asked.verb === 'travelled to' || asked.verb === 'is holding';
      if (!rare) heldKeys.add(key(asked));
    }
    let rareTrain = 0;
    for (const d of train) {
      const { facts, asked } = combos(d);
      assert.ok(asked.verb !== 'travelled to' && asked.verb !== 'is holding', d.text);
      for (const f of facts) {
        if (f.meaning !== 'LEAVE') assert.ok(!heldKeys.has(key(f)), `held in train: ${d.text}`);
        if (f.verb === 'travelled to' || f.verb === 'is holding') rareTrain++;
      }
    }
    assert.ok(rareTrain > 0, 'formele rare apar în train ca fapt neîntrebat');
    for (const d of docs) {
      const { asked } = combos(d);
      if (asked.verb === 'travelled to' || asked.verb === 'is holding') assert.ok(d.heldout);
    }
  }
});

test('BABI2: răspunsul e locul unuia dintre cele două fapte', () => {
  const set = generateSet('BABI2');
  assert.equal(JSON.stringify(set), JSON.stringify(generateSet('BABI2')));
  const ids = new Set();
  let held = 0, novel = 0;
  for (const d of set.docs) {
    const m = /^(.+\.) (.+\.) (Where is \w+\?) (\w+)\.$/.exec(d.text);
    assert.ok(m, d.text);
    const places = [m[1], m[2]].map((f) => /the (\w+)\.$/.exec(f)[1]);
    assert.equal(places[d.meta.pos], d.meta.answer);
    assert.ok(places.includes(m[4]));
    assert.equal(d.meta.prompt, `${m[1]} ${m[2]} ${m[3]}`);
    assert.equal(d.meta.verbs.length, 2);
    assert.equal(d.heldout, d.meta.source === 'test');
    assert.ok(!ids.has(d.text)); ids.add(d.text);
    if (d.heldout) held++;
    if (d.meta.novel) novel++;
  }
  console.log(`BABI2: total ${set.docs.length}, heldout ${held}, novel ${novel}`);
});
