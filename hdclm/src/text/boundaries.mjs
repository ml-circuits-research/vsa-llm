// Tăierea în unități (secțiunea 8). Același cod servește veghea (segment) și predicția (segmentPrefix).
// Niveluri: 1 cuvânt, 2 parte de propoziție, 3 propoziție, 4 paragraf, 5 document.
//
// Interpretări (notate în README):
//  - tokenul care închide o unitate este ultimul ei copil; o propoziție fără nicio graniță de parte
//    de propoziție ia direct copiii părții ei unice (altfel „Ana citește.” ar fi [[Ana, citește], .]);
//  - perechile ( [ { „ nu sunt implementate încă (sunt tokeni obișnuiți).

export const SENTENCE_END = new Set(['.', '!', '?']);
export const CLAUSE_END = new Set([',', ';', ':']);

const leaf = (tok) => ({ tok });

export class Segmenter {
  constructor() {
    this.word = [];
    this.clause = [];
    this.sentence = []; // părți de propoziție închise
    this.paragraph = [];
    this.doc = [];
    this.pending = null; // [.!?] care așteaptă tokenul următor
  }

  clone() {
    const s = new Segmenter();
    for (const k of ['word', 'clause', 'sentence', 'paragraph', 'doc']) s[k] = this[k].slice();
    s.pending = this.pending;
    return s;
  }

  push(t) {
    const spaced = t.spaceBefore || t.newlineBefore;
    if (this.pending) this.resolvePending(spaced);
    if (t.newlineBefore) this.closeParagraph();
    else if (t.spaceBefore) this.closeWord();
    if (SENTENCE_END.has(t.text)) this.pending = t;
    else if (CLAUSE_END.has(t.text)) this.closeClause(t);
    else this.word.push(leaf(t.ref));
  }

  resolvePending(closes) {
    const p = this.pending;
    this.pending = null;
    if (closes) this.closeSentence(p);
    else this.word.push(leaf(p.ref)); // „3.14”: punctul rămâne în cuvânt
  }

  closeWord() {
    if (this.word.length) this.clause.push({ level: 1, children: this.word, closer: false });
    this.word = [];
  }
  closeClause(closer) {
    this.closeWord();
    this.sentence.push({ level: 2, children: [...this.clause, leaf(closer.ref)], closer: true });
    this.clause = [];
  }
  closeSentence(closer) {
    this.closeWord();
    let children;
    if (this.sentence.length === 0) children = this.clause;
    else {
      if (this.clause.length) this.sentence.push({ level: 2, children: this.clause, closer: false });
      children = this.sentence;
    }
    if (closer) children = [...children, leaf(closer.ref)];
    if (children.length) this.paragraph.push({ level: 3, children, closer: !!closer });
    this.clause = [];
    this.sentence = [];
  }
  closeParagraph() {
    this.closeWord();
    if (this.clause.length || this.sentence.length) this.closeSentence(null);
    if (this.paragraph.length) this.doc.push({ level: 4, children: this.paragraph, closer: false });
    this.paragraph = [];
  }
  finish() {
    if (this.pending) this.resolvePending(true);
    this.closeParagraph();
    return { level: 5, children: this.doc, closer: false };
  }

  // unitățile deschise, de jos în sus. levels = nivelurile ale căror unități votează (2 și 3 când sunt contopite)
  openStack() {
    const st = [{ level: 1, levels: [1], items: this.word }];
    if (this.sentence.length) {
      st.push({ level: 2, levels: [2], items: this.clause });
      st.push({ level: 3, levels: [3], items: this.sentence });
    } else st.push({ level: 3, levels: [2, 3], items: this.clause });
    st.push({ level: 4, levels: [4], items: this.paragraph });
    st.push({ level: 5, levels: [5], items: this.doc });
    return st;
  }
}

// tokens: [{ text, spaceBefore, newlineBefore, ref }]; ref este ce ajunge în frunze (de obicei id-ul tokenului)
export function segment(tokens) {
  const s = new Segmenter();
  for (const t of tokens) s.push(t);
  return s.finish();
}

// Începutul unui text -> unitățile încă deschise. Un [.!?] de la capăt se consideră închizător
// (presupunem că tokenul următor are spațiu în față).
export function segmentPrefix(tokens) {
  const s = new Segmenter();
  for (const t of tokens) s.push(t);
  if (s.pending) s.resolvePending(true);
  return s.openStack();
}

// Construiește o unitate dintr-un nod brut: copiii înaintea părintelui; nod cu un singur copil și fără
// închizător -> copilul; mai mult de K copii -> bucăți consecutive de cel mult K.
//   hooks.unit(items, level) -> id     hooks.single(level, id)
export function buildUnit(node, hooks, K) {
  if (node.tok !== undefined) return node.tok;
  const ids = node.children.map((c) => buildUnit(c, hooks, K));
  if (ids.length === 0) return null;
  if (ids.length === 1 && !node.closer) {
    hooks.single?.(node.level, ids[0]);
    return ids[0];
  }
  return chunked(ids, node.level, hooks, K);
}

export function chunked(ids, level, hooks, K) {
  let cur = ids;
  while (cur.length > K) {
    const next = [];
    for (let i = 0; i < cur.length; i += K) {
      const part = cur.slice(i, i + K);
      next.push(part.length === 1 ? part[0] : hooks.unit(part, level));
    }
    cur = next;
  }
  return hooks.unit(cur, level);
}
