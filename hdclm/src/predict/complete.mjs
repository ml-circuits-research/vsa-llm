// Complete a learned higher-level equation as a whole. Unlike token generation,
// this keeps bindings and the learned endpoint until the response is rendered.
import { Predictor } from './distribution.mjs';
import { matchPattern } from '../memory/match.mjs';
import { tokenize, wordDetokenize } from '../text/tokenizer.mjs';

export function completeFromRules(mem, cfg, text, { maxTokens = 24 } = {}) {
  const pred = new Predictor(mem, cfg);
  const stack = pred.stackFor(tokenize(text, mem.tokenMode ?? 'word'));
  const words = (id) => {
    if (pred.temp.isToken(id)) return [pred.temp.isTemp(id) ? pred.temp.tokens.get(id) : mem.atoms[id].text];
    return (pred.temp.children(id) ?? []).flatMap(words);
  };
  for (const entry of stack.slice().reverse()) {
    if (entry.level < 4 || !entry.prefix.length) continue;
    const candidates = [];
    for (const level of entry.levels) for (const pid of pred.patterns[level]) {
      const pattern = mem.atoms[pid].def;
      if (entry.prefix.length >= pattern.items.length) continue;
      const match = matchPattern(pred.env, pid, entry.prefix, { partial: true });
      // Exact acceptance only: no approximate new values silently admitted.
      if (!match || match.newMembers.length) continue;
      const bind = new Map(match.bind);
      const fill = (slot) => {
        if (bind.has(slot)) return true;
        const choice = mem.atoms[mem.atoms[slot].accepts].def;
        if (choice.typed || choice.members.size !== 1) return false;
        bind.set(slot, choice.members.keys().next().value);
        return true;
      };
      const suffix = [];
      let resolved = true;
      for (const item of pattern.items.slice(entry.prefix.length)) {
        if (item.fixed !== undefined) suffix.push(item.fixed);
        else if (item.slot !== undefined) {
          if (!fill(item.slot)) { resolved = false; break; }
          suffix.push(bind.get(item.slot));
        } else {
          if (!item.args.every(fill) || (item.form !== undefined && !fill(item.form))) { resolved = false; break; }
          const mk = (xs) => pred.temp.make(xs, mem.atoms[item.sub].level);
          suffix.push(mk(mem.subChildren(item, bind, mk)));
        }
      }
      if (!resolved) continue;
      const tokens = suffix.flatMap(words);
      if (!tokens.length || tokens.length > maxTokens) continue;
      candidates.push({ pattern: pid, text: wordDetokenize(tokens), tokens, support: mem.usage(pid) });
    }
    if (!candidates.length) continue;
    const answers = [...new Set(candidates.map((c) => c.text))];
    if (answers.length > 1) return { status: 'ambiguous', alternatives: answers, candidates };
    return { status: 'supported', text: answers[0], candidates };
  }
  return { status: 'unsupported', candidates: [] };
}
