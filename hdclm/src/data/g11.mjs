// G11: set de control orb. Relatie tranzitiva cu 2-3 fapte; intrebarea cere subiectul SAU obiectul
// unui singur fapt (slotul intrebat difera ca pozitie de cel din fapt). Raspunsul se leaga doar din povestea curenta.
export const G11_DESCRIPTION =
  'G11: set de control orb. Povesti cu 2-3 fapte de forma "The cat chased the ball." si o intrebare ' +
  'despre un singur fapt, fie obiectul ("What did the cat chase?") fie subiectul ("Who chased the ball?"). ' +
  'Testeaza daca mecanismul leaga raspunsul de faptul potrivit si de pozitia slotului intrebat (alta decat in fapt), ' +
  'pe combinatii subiect-obiect nevazute (regula ciclica (j - i) mod 12 < 3, ~25% heldout).';

const SUBJ = ['cat', 'dog', 'fox', 'girl', 'boy', 'bird', 'mouse', 'horse', 'goat', 'owl'];
const OBJ = ['ball', 'bone', 'kite', 'cake', 'rope', 'drum', 'shoe', 'coat', 'bell', 'nut', 'leaf', 'bread'];
const VERB = [['chased', 'chase'], ['found', 'find'], ['dropped', 'drop'], ['pushed', 'push'], ['carried', 'carry'], ['wanted', 'want'], ['painted', 'paint']];

export function g11(R) {
  const N = 220;
  const docs = [];
  const held = (i, j) => (((j - i) % 12) + 12) % 12 < 3;
  for (let n = 0; n < N; n++) {
    const wantHeld = n % 4 === 0;
    const nf = 2 + R.int(2);
    let facts, ask, qi;
    for (;;) {
      const si = R.shuffle([...SUBJ.keys()]).slice(0, nf);
      const oj = R.shuffle([...OBJ.keys()]).slice(0, nf);
      facts = si.map((s, k) => ({ s, o: oj[k], v: R.int(VERB.length) }));
      qi = R.int(nf);
      const flags = facts.map((f) => held(f.s, f.o));
      const okQ = flags[qi] === wantHeld;
      const okOthers = flags.every((h, k) => k === qi || !h);
      if (okQ && okOthers) break;
    }
    ask = R.int(2); // 0: obiectul (What did S V?), 1: subiectul (Who Ved O?)
    const f = facts[qi];
    const sents = facts.map((x) => `The ${SUBJ[x.s]} ${VERB[x.v][0]} the ${OBJ[x.o]}.`);
    const q = ask === 0
      ? `What did the ${SUBJ[f.s]} ${VERB[f.v][1]}?`
      : `Who ${VERB[f.v][0]} the ${OBJ[f.o]}?`;
    const answer = ask === 0 ? OBJ[f.o] : SUBJ[f.s];
    const prompt = `${sents.join(' ')} ${q}`;
    docs.push({
      id: `G11-${n}`, text: `${prompt} ${answer}.`, heldout: wantHeld,
      meta: { prompt, answer, ask, facts: nf, queried: qi, subject: SUBJ[f.s], object: OBJ[f.o], verb: VERB[f.v][0] },
    });
  }
  return { name: 'G11', docs, meta: { size: docs.length } };
}
