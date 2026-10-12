// Seturi de date sintetice G1..G9, deterministe (tot hazardul vine din rng(seed)).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rng } from '../core/rng.mjs';

export const NAMES = ['Ana', 'Maria', 'Ion', 'Elena', 'Mihai', 'Radu', 'Ioana', 'Dan', 'Paul', 'Vlad'];
const VERBS = ['reads', 'writes'];
const OBJECTS5 = ['book', 'letter', 'poem', 'note', 'story'];
const OBJECTS10 = ['book', 'pen', 'cup', 'key', 'ball', 'hat', 'map', 'box', 'lamp', 'coin'];
const PLACES = ['garden', 'kitchen', 'park', 'school', 'office'];
const TIMES = ['Yesterday', 'Today', 'Now'];
const CITIES = [
  ['Paris', 'France'], ['Rome', 'Italy'], ['Berlin', 'Germany'], ['Madrid', 'Spain'],
  ['Lisbon', 'Portugal'], ['Vienna', 'Austria'], ['Warsaw', 'Poland'], ['Prague', 'Czechia'],
  ['Athens', 'Greece'], ['Dublin', 'Ireland'], ['Oslo', 'Norway'], ['Stockholm', 'Sweden'],
  ['Helsinki', 'Finland'], ['Copenhagen', 'Denmark'], ['Budapest', 'Hungary'], ['Bucharest', 'Romania'],
  ['Sofia', 'Bulgaria'], ['Bern', 'Switzerland'], ['Brussels', 'Belgium'], ['Amsterdam', 'Netherlands'],
];
const OTHER_WORDS = [
  'the', 'a', 'and', 'is', 'in', 'on', 'of', 'to', 'with', 'red', 'big', 'small', 'old', 'new', 'good',
  'day', 'night', 'house', 'water', 'green', 'quick', 'slow', 'sees', 'takes', 'gives', 'finds',
  'time', 'man', 'dog', 'cat', 'car', 'sun', 'tree',
];
const VOCAB = [...NAMES, ...VERBS, ...OBJECTS5, ...OTHER_WORDS];
const DISTRACTORS = [
  'The sun is warm.', 'The sky is blue.', 'Birds can fly.', 'The road is long.',
  'Rain falls today.', 'The sea is calm.', 'Time goes fast.', 'The tree is tall.',
];

// regula ciclică: combinația e scoasă dacă (j - i) mod 10 < 3
const cyc = (i, j) => (((j - i) % 10) + 10) % 10 < 3;

function mk(name, docs, meta = {}) {
  return {
    name,
    docs: docs.map((d, n) => ({ id: `${name}-${n}`, text: d.text, heldout: !!d.heldout, meta: d.meta })),
    meta: { size: docs.length, ...meta },
  };
}

function g1(opts) {
  const hold = opts.holdout !== false;
  const docs = [];
  NAMES.forEach((n, i) => VERBS.forEach((v, j) =>
    docs.push({ text: `${n} ${v}.`, heldout: hold && (i + j) % 5 === 0, meta: { name: n, verb: v } })));
  return mk('G1', docs);
}

function g2like(name, opts, R) {
  const hold = opts.holdout !== false;
  const docs = [];
  NAMES.forEach((n, i) => VERBS.forEach((v, j) => OBJECTS5.forEach((o, k) => {
    let text = `${n} ${v} the ${o}.`;
    const meta = { name: n, verb: v, object: o };
    if (R && R() < 0.5) {
      const t = R.pick(TIMES);
      text = `${t} ${text}`;
      meta.time = t;
    }
    docs.push({ text, heldout: hold && (i + j + k) % 5 === 0, meta });
  })));
  return mk(name, docs);
}

function g3() {
  return mk('G3', CITIES.map(([city, country]) => ({
    text: `${city} is the capital of ${country}.`, heldout: false, meta: { city, country },
  })));
}

function g4(R) {
  const docs = [];
  for (let n = 0; n < 100; n++) {
    const L = 3 + R.int(5);
    const w = [];
    for (let t = 0; t < L; t++) w.push(R.pick(VOCAB));
    docs.push({ text: `${w.join(' ')}.`, heldout: false, meta: { length: L } });
  }
  return mk('G4', docs);
}

function g7(opts) {
  const hold = opts.holdout !== false;
  const docs = [];
  NAMES.forEach((n, i) => OBJECTS10.forEach((o, j) => {
    const prompt = `${n} has the ${o}. Who has the ${o}?`;
    docs.push({ text: `${prompt} ${n}.`, heldout: hold && cyc(i, j), meta: { name: n, object: o, answer: n, prompt } });
  }));
  return mk('G7', docs);
}

function g8(opts) {
  const hold = opts.holdout !== false;
  const docs = [];
  NAMES.forEach((n, i) => OBJECTS10.forEach((o, j) => PLACES.forEach((p, k) => {
    if ((i + 3 * j + 7 * k) % 5 !== 0) return;
    const prompt = `${n} has the ${o}. ${n} is in the ${p}. Where is the ${o}?`;
    docs.push({ text: `${prompt} ${p}.`, heldout: hold && cyc(i, j), meta: { name: n, object: o, place: p, answer: p, prompt } });
  })));
  return mk('G8', docs);
}

function g9(opts, R) {
  const hold = opts.holdout !== false;
  const docs = [];
  NAMES.forEach((n, i) => OBJECTS10.forEach((o, j) => {
    const D = 1 + ((i + j) % 5);
    const ds = R.shuffle(DISTRACTORS.slice()).slice(0, D);
    const prompt = `${n} has the ${o}. ${ds.join(' ')} Who has the ${o}?`;
    docs.push({ text: `${prompt} ${n}.`, heldout: hold && cyc(i, j), meta: { name: n, object: o, answer: n, prompt, distractors: D } });
  }));
  return mk('G9', docs);
}

export function generateSet(name, seed = 1, opts = {}) {
  const R = rng(seed);
  switch (name) {
    case 'G1': return g1(opts);
    case 'G2': return g2like('G2', opts, null);
    case 'G3': return g3();
    case 'G4': return g4(R);
    case 'G5': return g2like('G5', opts, R);
    case 'G6': throw new Error('G6 needs the GPT-2 tokenizer (step 7)');
    case 'G7': return g7(opts);
    case 'G8': return g8(opts);
    case 'G9': return g9(opts, R);
    default: throw new Error(`set necunoscut ${name}`);
  }
}

// împărțire train/val/test; listele rămân în ordinea originală a documentelor
export function splitDocs(set, seed = 1, { allTrain = false } = {}) {
  const R = rng(seed);
  const order = new Map(set.docs.map((d, i) => [d.id, i]));
  const normal = R.shuffle(set.docs.filter((d) => !d.heldout));
  const held = R.shuffle(set.docs.filter((d) => d.heldout));
  let train, val = [], test = [];
  if (allTrain) train = normal;
  else {
    const nv = Math.floor(normal.length * 0.1);
    const nt = Math.floor(normal.length * 0.1);
    val = normal.slice(0, nv);
    test = normal.slice(nv, nv + nt);
    train = normal.slice(nv + nt);
  }
  const hv = Math.ceil(held.length / 2);
  val = val.concat(held.slice(0, hv));
  test = test.concat(held.slice(hv));
  const srt = (a) => a.sort((x, y) => order.get(x.id) - order.get(y.id));
  return { train: srt(train), val: srt(val), test: srt(test) };
}

export function saveSplit(dir, split) {
  mkdirSync(dir, { recursive: true });
  const ids = {};
  for (const k of ['train', 'val', 'test']) ids[k] = split[k].map((d) => d.id);
  writeFileSync(join(dir, 'split.json'), JSON.stringify(ids, null, 2) + '\n');
}
