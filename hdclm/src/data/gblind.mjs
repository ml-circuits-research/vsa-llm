// G-BLIND: setul de control orb (P2) pentru unificarea reformulărilor. Construit înainte de orice rulare pe el
// și rulat o singură dată pe configurarea fixată dinainte; nicio reparație nu se face după rezultatele lui.
// Diferă de GPARA în tot ce se poate schimba fără a schimba întrebarea:
//   alte nume, locuri, obiecte și verbe; alte întrebări; 2 sau 3 fapte pe poveste; faptul întrebat oriunde;
//   două capcane: un sens cu aceleași tipuri ca LOC dar alt înțeles (LOOK: „looked at the”) și negația
//   (NEG: „is not in the”), care diferă de o formă LOC printr-un singur cuvânt.
const NAMES = ['Ada', 'Bram', 'Cleo', 'Dario', 'Elif', 'Femi', 'Goran', 'Hana', 'Ivo'];
const PLACES = ['kitchen', 'garden', 'office', 'hall', 'studio', 'library', 'shed'];
const OBJECTS = ['lamp', 'key', 'map', 'cup', 'coin', 'book'];

const FORMS = {
  LOC: ['is in', 'stays in', 'waits in', 'is sitting in'],
  OWN: ['carries', 'owns', 'grabbed', 'is carrying'],
  LOOK: ['looked at'],
  NEG: ['is not in'],
};
const RARE = { LOC: 3, OWN: 3 }; // în train, doar ca fapt neîntrebat

export const GBLIND_GOLD = {
  meanings: {
    LOC: ['is in', 'stays in', 'waits in', 'is sitting in'],
    OWN: ['carries', 'owns', 'grabbed', 'is carrying'],
    LOOK: ['looked at'],
    NEG: ['is not in'],
  },
  // perechile de sensuri care nu au voie să aibă aceeași ecuație
  traps: [['LOC', 'LOOK'], ['LOC', 'NEG']],
};

const heldCombo = (f, n, t) => (3 * t + f + 2 * n) % 5 === 1;

function fact(meaning, f, n, t) {
  const obj = meaning === 'OWN';
  const form = FORMS[meaning][f];
  return { meaning, f, n, t, text: `${NAMES[n]} ${form} the ${obj ? OBJECTS[t] : PLACES[t]}.`, held: (meaning === 'LOC' || meaning === 'OWN') && heldCombo(f, n, t) };
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

function story(R) {
  const u = R();
  const n1 = R.int(NAMES.length);
  let a, others;
  if (u < 0.4) {
    // LOC întrebat; distractori LOC / OWN despre alte persoane
    a = fact('LOC', pickForm(R, 'LOC'), n1, R.int(PLACES.length));
    const k = R() < 0.5 ? 1 : 2;
    others = [];
    for (let i = 0; i < k; i++) {
      const n = otherName(R, [n1, ...others.map((o) => o.n)]);
      others.push(R() < 0.5 ? fact('LOC', R.int(4), n, R.int(PLACES.length)) : fact('OWN', R.int(4), n, R.int(OBJECTS.length)));
    }
  } else if (u < 0.75) {
    a = fact('OWN', pickForm(R, 'OWN'), n1, R.int(OBJECTS.length));
    const k = R() < 0.5 ? 1 : 2;
    others = [];
    for (let i = 0; i < k; i++) {
      const n = otherName(R, [n1, ...others.map((o) => o.n)]);
      others.push(R() < 0.5 ? fact('LOC', R.int(4), n, R.int(PLACES.length)) : fact('OWN', R.int(4), n, R.int(OBJECTS.length)));
    }
  } else {
    // capcană: aceeași persoană, alt loc, cu LOOK sau NEG; întrebarea e tot despre LOC
    const p1 = R.int(PLACES.length);
    let p2 = R.int(PLACES.length - 1);
    if (p2 >= p1) p2++;
    a = fact('LOC', pickForm(R, 'LOC'), n1, p1);
    others = [R() < 0.5 ? fact('LOOK', 0, n1, p2) : fact('NEG', 0, n1, p2)];
  }
  // poziția faptului întrebat: oriunde printre fapte
  const pos = R.int(others.length + 1);
  const facts = [...others.slice(0, pos), a, ...others.slice(pos)];
  const q = a.meaning === 'LOC' ? `In which room is ${NAMES[a.n]}?` : `What is ${NAMES[a.n]} carrying?`;
  const answer = a.meaning === 'LOC' ? PLACES[a.t] : OBJECTS[a.t];
  const prompt = `${facts.map((f) => f.text).join(' ')} ${q}`;
  const heldout = a.f === RARE[a.meaning] || a.held;
  if (!heldout && others.some((o) => o.held)) return null;
  const trap = others.find((o) => o.meaning === 'LOOK' || o.meaning === 'NEG')?.meaning ?? null;
  return { text: `${prompt} ${answer}.`, heldout, meta: { prompt, answer, meaningAsked: a.meaning, trap, nFacts: facts.length } };
}

export function gblind(R) {
  const docs = [];
  const seen = new Set();
  while (docs.length < 300) {
    const d = story(R);
    if (!d || seen.has(d.text)) continue;
    seen.add(d.text);
    docs.push(d);
  }
  return { name: 'GBLIND', docs: docs.map((d, n) => ({ id: `GBLIND-${n}`, text: d.text, heldout: d.heldout, meta: d.meta })), meta: { size: docs.length } };
}
