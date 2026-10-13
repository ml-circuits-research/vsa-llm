// Read-only diagnostic adapter for the CURRENT model. No lexical rules, gold,
// fabricated semantic graphs, or ingestion of evaluation text into trained memory.
import { Memory } from '../../memory/store.mjs';
import { ingest } from '../../wake/ingest.mjs';
import { deepSleep } from '../../sleep/scheduler.mjs';
import { Predictor } from '../../predict/distribution.mjs';
import { canon, bearingSlots, classIndex } from '../../memory/meaning.mjs';
import { tokenize, wordDetokenize } from '../../text/tokenizer.mjs';
import { segment, buildUnit } from '../../text/boundaries.mjs';

export async function createModel({ training, cfg }) {
  const mem = new Memory(cfg);
  for (const [i, text] of training.entries()) ingest(mem, text, { docName: `goal-train-${i}` });
  deepSleep(mem, cfg);
  const bearing = bearingSlots(mem), classes = classIndex(mem);
  return {
    snapshot: () => mem.toJSONL(),
    formalize(text) {
      const pred = new Predictor(mem, cfg);
      const toks = tokenize(text, mem.tokenMode);
      const tree = segment(toks.map((t) => ({ ...t, ref: pred.temp.token(t.text) })));
      const root = buildUnit(tree, { unit: (xs, level) => pred.temp.make(xs, level) }, mem.K);
      const textsOf = (id) => {
        if (pred.temp.isToken(id)) return [pred.temp.isTemp(id) ? pred.temp.tokens.get(id) : mem.atoms[id].text];
        return (pred.temp.children(id) ?? []).flatMap(textsOf);
      };
      const app = root === null ? null : pred.interp(root);
      let key = null;
      if (app) {
        // canon() reads the application plus trained definitions only. This virtual
        // atom exposes the existing recognizer's result without a memory write.
        const virtual = mem.atoms.length;
        const atoms = mem.atoms.slice();
        // Temporary numeric ids restart for each prediction. Preserve the identity
        // of unseen values across calls; otherwise two different names collide.
        const fills = app.fills.map((v) => pred.temp.isTemp(v) ? `temporary:${JSON.stringify(textsOf(v))}` : v);
        atoms[virtual] = { def: { type: 'APP', ...app, fills } };
        key = canon({ atoms }, virtual, bearing, classes);
      }
      return {
        complete: key !== null,
        key,
        // Reconstruction through the current storage path, not an echo of input.
        reconstructed: root === null ? '' : wordDetokenize(textsOf(root)),
        interpretations: key === null ? [] : [{ key }],
        graph: null, // Current code has no exported semantic graph. Visible failure.
      };
    },
    // No infer() here: next-token QA is not graph-only reasoning.
  };
}
