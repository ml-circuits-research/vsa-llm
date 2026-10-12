// Veghea: text -> unități -> tampon. Nu caută și nu hotărăște nimic.
import { tokenize } from '../text/tokenizer.mjs';
import { segment, buildUnit } from '../text/boundaries.mjs';

export function ingest(mem, text, { mode = 'word', docName } = {}) {
  const toks = tokenize(text, mode).map((t) => ({ ...t, ref: mem.token(t.text) }));
  const tree = segment(toks);
  const hooks = {
    unit: (items, level) => {
      const { id, isNew } = mem.intern({ type: 'SEQ', items }, level);
      mem.noteRead(id, level, isNew);
      for (const c of items) mem.noteChild(level, c);
      return id;
    },
    single: (level, id) => mem.noteSingle(level, id),
  };
  const root = buildUnit(tree, hooks, mem.K);
  if (root !== null) mem.noteRoot(root, docName);
  return { root, tokens: toks.map((t) => t.ref) };
}
