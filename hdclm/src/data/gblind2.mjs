// GBLIND2: al doilea set de control orb pentru unificarea reformulărilor.
// Vocabular complet nou (nume, substantive, verbe), alte întrebări, 2-4 fapte pe poveste,
// faptul întrebat oriunde. Trei capcane (același tip de argumente ca un sens întrebabil, alt înțeles),
// care apar doar despre ACEEAȘI persoană, iar răspunsul vine din faptul real.
const NAMES = ['Axel', 'Brina', 'Cyrus', 'Dalia', 'Emeka', 'Farah', 'Gideon', 'Hedda', 'Iker', 'Jovan'];
const PLACES = ['bakery', 'cabin', 'dock', 'forge', 'greenhouse', 'lighthouse', 'mill'];
const OBJECTS = ['anchor', 'brush', 'compass', 'drum', 'flute', 'ladder'];

// PLACE: persoană-la-loc; THING: persoană-cu-obiect; LEAVE/DREAM (tipuri PLACE), PAINT (tipuri THING): capcane
const FORMS = {
  PLACE: ['rests in', 'lingers in', 'hurried to', 'is hiding in'],
  THING: ['wields', 'keeps', 'snatched', 'is clutching'],
  LEAVE: ['is leaving'],
  DREAM: ['dreams of'],
  PAINT: ['painted'],
};
const RARE = { PLACE: 3, THING: 3 }; // în train, doar ca fapt neîntrebat
const NOUNS = { PLACE: PLACES, THING: OBJECTS, LEAVE: PLACES, DREAM: PLACES, PAINT: OBJECTS };
const ASKABLE = ['PLACE', 'THING'];

const QUESTIONS = {
  PLACE: [(n) => `Which spot is ${n} occupying?`, (n) => `Where would you look for ${n}?`],
  THING: [(n) => `Which item does ${n} have in hand?`, (n) => `What is ${n} in possession of?`],
};

export const GBLIND2_GOLD = {
  meanings: {
    PLACE: ['rests in', 'lingers in', 'hurried', 'is hiding in'],
    THING: ['wields', 'keeps', 'snatched', 'is clutching'],
    LEAVE: ['is leaving'],
    DREAM: ['dreams of'],
    PAINT: ['painted'],
  },
  // perechile de sensuri care nu au voie să aibă aceeași ecuație
  traps: [['PLACE', 'LEAVE'], ['PLACE', 'DREAM'], ['THING', 'PAINT']],
};

// regula ciclică peste (formă, nume, țintă): ~20% din combinații pusă deoparte
const heldCombo = (f, n, t) => (2 * t + 3 * f + n) % 5 === 2;

function fact(meaning, f, n, t) {
  const form = FORMS[meaning][f];
  return {
    meaning, f, n, t,
    text: `${NAMES[n]} ${form} the ${NOUNS[meaning][t]}.`,
    held: ASKABLE.includes(meaning) && heldCombo(f, n, t),
  };
}

function pickForm(R, meaning) {
  const k = RARE[meaning];
  if (R() < 0.14) return k;
  const o = R.int(3);
  return o >= k ? o + 1 : o;
}

function otherName(R, used) {
  for (;;) {
    const n = R.int(NAMES.length);
    if (!used.includes(n)) return n;
  }
}

function distractor(R, used) {
  const n = otherName(R, used);
  const m = R() < 0.5 ? 'PLACE' : 'THING';
  return fact(m, R.int(4), n, R.int(NOUNS[m].length));
}

function story(R) {
  const u = R();
  const n1 = R.int(NAMES.length);
  const askedMeaning = R() < 0.5 ? 'PLACE' : 'THING';
  const size = NOUNS[askedMeaning].length;
  const a = fact(askedMeaning, pickForm(R, askedMeaning), n1, R.int(size));
  let others = [];
  if (u < 0.6) {
    // distractori despre alte persoane
    const k = 1 + R.int(3);
    for (let i = 0; i < k; i++) others.push(distractor(R, [n1, ...others.map((o) => o.n)]));
  } else {
    // capcană: aceeași persoană, alt înțeles cu aceleași tipuri, altă țintă; răspunsul vine din faptul real
    const trapMeaning = askedMeaning === 'PLACE' ? (R() < 0.5 ? 'LEAVE' : 'DREAM') : 'PAINT';
    let t2 = R.int(size - 1);
    if (t2 >= a.t) t2++;
    others = [fact(trapMeaning, 0, n1, t2)];
    if (R() < 0.4) others.push(distractor(R, [n1]));
  }
  // poziția faptului întrebat: oriunde printre fapte
  others = R.shuffle ? R.shuffle(others) : others;
  const pos = R.int(others.length + 1);
  const facts = [...others.slice(0, pos), a, ...others.slice(pos)];
  const qs = QUESTIONS[askedMeaning];
  const q = qs[R.int(qs.length)](NAMES[n1]);
  const answer = NOUNS[askedMeaning][a.t];
  const prompt = `${facts.map((f) => f.text).join(' ')} ${q}`;
  const heldout = a.f === RARE[askedMeaning] || a.held;
  if (!heldout && others.some((o) => o.held)) return null;
  const trap = others.find((o) => !ASKABLE.includes(o.meaning))?.meaning ?? null;
  return { text: `${prompt} ${answer}.`, heldout, meta: { prompt, answer, meaningAsked: askedMeaning, trap, nFacts: facts.length } };
}

export function gblind2(R) {
  const docs = [];
  const seen = new Set();
  while (docs.length < 300) {
    const d = story(R);
    if (!d || seen.has(d.text)) continue;
    seen.add(d.text);
    docs.push(d);
  }
  return { name: 'GBLIND2', docs: docs.map((d, n) => ({ id: `GBLIND2-${n}`, text: d.text, heldout: d.heldout, meta: d.meta })), meta: { size: docs.length } };
}
