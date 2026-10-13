// G-PARA: parafraze (aceeași semnificație, forme diferite) + capcana antonimului (LEAVE).
// Două fapte, o întrebare, un răspuns; ca în G10, dar semnificația faptului întrebat contează.
const NAMES = ['Nora', 'Hugo', 'Ines', 'Kurt', 'Lena', 'Omar', 'Pia', 'Remy'];
const PLACES = ['cellar', 'attic', 'garage', 'harbor', 'market', 'tower'];
const OBJECTS = ['spoon', 'ticket', 'towel', 'candle', 'wallet'];

// forme de suprafață pe semnificație; indexul formei intră în regula ciclică
const FORMS = {
  MOVE: ['went to', 'moved to', 'travelled to', 'went back to'],
  HAVE: ['has', 'holds', 'picked up', 'is holding'],
  LEAVE: ['left'],
};
const RARE = { MOVE: 2, HAVE: 3 }; // 'travelled to' și 'is holding': doar ca fapt neîntrebat în train

export const GPARA_GOLD = {
  meanings: {
    MOVE: ['went', 'moved', 'travelled', 'went back'],
    HAVE: ['has', 'holds', 'picked up', 'is holding'],
    LEAVE: ['left'],
  },
  roles: { MOVE: ['agent', 'place'], HAVE: ['agent', 'object'], LEAVE: ['agent', 'place'] },
};

// regula ciclică echilibrată: combinația (formă, nume, țintă) e pusă deoparte (~20%)
const heldCombo = (f, n, t) => (t + 2 * f + n) % 5 === 0;

function fact(meaning, f, n, t) {
  const obj = meaning === 'HAVE';
  const form = FORMS[meaning][f];
  const text = `${NAMES[n]} ${form} the ${obj ? OBJECTS[t] : PLACES[t]}.`;
  const id = meaning === 'LEAVE' ? 'left' : form;
  return { meaning, f, n, t, text, id, held: meaning !== 'LEAVE' && heldCombo(f, n, t) };
}

// formă pentru faptul întrebat: formele rare apar rar
function pickForm(R, meaning) {
  const k = RARE[meaning];
  if (R() < 0.14) return k;
  const o = R.int(3);
  return o >= k ? o + 1 : o;
}

function story(R) {
  const u = R();
  let a, b, ask, first; // a: faptul întrebat, b: celălalt; first: a vine primul?
  const n1 = R.int(8);
  let n2 = R.int(7);
  if (n2 >= n1) n2++;
  if (u < 0.4) { // where, două MOVE
    a = fact('MOVE', pickForm(R, 'MOVE'), n1, R.int(6));
    b = fact('MOVE', R.int(4), n2, R.int(6));
    ask = 'where'; first = R() < 0.5;
  } else if (u < 0.75) { // what, HAVE + (MOVE sau HAVE)
    a = fact('HAVE', pickForm(R, 'HAVE'), n1, R.int(5));
    b = R() < 0.5 ? fact('MOVE', R.int(4), n2, R.int(6)) : fact('HAVE', R.int(4), n2, R.int(5));
    ask = 'what'; first = R() < 0.5;
  } else { // LEAVE: MOVE(N,P1) apoi LEAVE(N,P2), P2 != P1
    const p1 = R.int(6);
    let p2 = R.int(5);
    if (p2 >= p1) p2++;
    a = fact('MOVE', pickForm(R, 'MOVE'), n1, p1);
    b = fact('LEAVE', 0, n1, p2);
    ask = 'where'; first = true;
  }
  const trap = b.meaning === 'LEAVE';
  const [f1, f2] = first ? [a, b] : [b, a];
  const q = ask === 'where' ? `Where is ${NAMES[a.n]}?` : `What does ${NAMES[a.n]} have?`;
  const answer = ask === 'where' ? PLACES[a.t] : OBJECTS[a.t];
  const prompt = `${f1.text} ${f2.text} ${q}`;
  const rare = a.f === RARE[a.meaning];
  // în train, nicio combinație pusă deoparte nu apare nici ca fapt neîntrebat
  const heldout = rare || a.held;
  if (!heldout && b.held) return null;
  return {
    text: `${prompt} ${answer}.`,
    heldout,
    meta: { prompt, answer, ask, forms: [f1.id, f2.id], meaningAsked: a.meaning, trap },
  };
}

export function gpara(R) {
  const docs = [];
  const seen = new Set();
  while (docs.length < 300) {
    const d = story(R);
    if (!d || seen.has(d.text)) continue;
    seen.add(d.text);
    docs.push(d);
  }
  return {
    name: 'GPARA',
    docs: docs.map((d, n) => ({ id: `GPARA-${n}`, text: d.text, heldout: d.heldout, meta: d.meta })),
    meta: { size: docs.length },
  };
}
