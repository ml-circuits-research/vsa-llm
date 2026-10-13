// Interactive laboratory over the existing learner/predictor. No external LLM,
// semantic rules, automatic teaching from questions, or generated answers as data.
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { loadConfig } from './core/config.mjs';
import { Memory } from './memory/store.mjs';
import { ingest } from './wake/ingest.mjs';
import { deepSleep } from './sleep/scheduler.mjs';
import { generateSet, splitDocs } from './data/generate.mjs';
import { Predictor } from './predict/distribution.mjs';
import { generate } from './predict/generate.mjs';
import { completeFromRules } from './predict/complete.mjs';
import { stats } from './memory/size.mjs';
import { describe } from './eval/metrics.mjs';
import { canon, bearingSlots, classIndex } from './memory/meaning.mjs';
import { tokenize } from './text/tokenizer.mjs';
import { segment, buildUnit } from './text/boundaries.mjs';

const HELP = `Întrebările primesc răspunsuri din reguli învățate; enunțurile rămân în context.
/continue TEXT    generare liberă de tokeni (poate fi incoerentă)
/why              regula sau motivul ultimului răspuns
/next PREFIX      primii 5 tokeni și probabilitățile lor
/inspect TEXT     tipare recunoscute, umpleri și chei canonice actuale
/context TEXT     context comun pentru continuări și /next; fără text îl șterge
/teach TEXT       citește textul ca exemplu; apoi folosește /sleep
/load CALE        citește un fișier UTF-8 ca exemplu; apoi /sleep
/sleep            descoperă tipare în memoria curentă
/demo G7          înlocuiește memoria cu antrenarea unui set sintetic
/patterns         primele 12 tipare învățate
/stats            mărimea memoriei și câte tipare sunt vii
/reset            golește memoria și contextul
/help             comenzile
/quit             ieșire; memoria sesiunii nu se salvează automat`;

export class ChatSession {
  constructor(cfg, { maxTokens = 24 } = {}) {
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 512) throw new Error('max-tokens trebuie să fie între 1 și 512');
    this.cfg = cfg;
    this.maxTokens = maxTokens;
    this.reset();
  }
  reset() { this.mem = new Memory(this.cfg); this.context = ''; this.reads = 0; this.lastReply = null; }
  teach(text) {
    if (!text.trim()) throw new Error('lipsește textul de învățat');
    ingest(this.mem, text, { docName: `chat-${++this.reads}` });
  }
  sleep() {
    // A rejected/invariant-breaking sleep must not corrupt the interactive session.
    const copy = this.mem.clone();
    const passes = deepSleep(copy, this.cfg);
    this.mem = copy;
    return passes.length;
  }
  demo(name) {
    const split = splitDocs(generateSet(name, this.cfg.seed), this.cfg.seed);
    const next = new ChatSession(this.cfg, { maxTokens: this.maxTokens });
    for (const d of split.train) next.teach(d.text);
    next.sleep();
    this.mem = next.mem; this.reads = next.reads; this.context = ''; this.lastReply = null;
    const example = split.test.find((d) => d.meta?.prompt);
    return `Demo ${name}: ${split.train.length} documente de antrenare. Validarea/testul nu au intrat în memorie.${example ? '\nÎncearcă: ' + example.meta.prompt : ''}`;
  }
  prefix(text) { return this.context ? `${this.context} ${text}` : text; }
  next(text) {
    const pred = new Predictor(this.mem, this.cfg);
    return [...pred.nextFromText(this.prefix(text))]
      .map(([id, p]) => ({ token: pred.tokenText(id), probability: p }))
      .sort((a, b) => b.probability - a.probability || a.token.localeCompare(b.token)).slice(0, 5);
  }
  reply(text) {
    if (!this.mem.tokenIndex.size) return 'Memoria este goală. Folosește /teach, /load sau /demo G7.';
    const question = /\?\s*$/.test(text);
    if (!question) {
      this.context = this.prefix(text);
      this.lastReply = { status: 'context', message: 'Text păstrat numai în context, fără antrenare.' };
      return 'Am păstrat textul în context. Poți pune o întrebare despre el.';
    }
    this.lastReply = completeFromRules(this.mem, this.cfg, this.prefix(text), { maxTokens: this.maxTokens });
    if (this.lastReply.status === 'supported') return this.lastReply.text;
    if (this.lastReply.status === 'ambiguous') return 'Nu pot determina un răspuns unic: regulile învățate propun răspunsuri diferite. /why pentru detalii.';
    return 'Nu pot determina răspunsul din regulile învățate. /why pentru detalii; /continue pentru generare liberă.';
  }
  continue(text) {
    if (!this.mem.tokenIndex.size) return 'Memoria este goală.';
    const result = generate(this.mem, this.cfg, this.prefix(text), { maxTokens: this.maxTokens });
    return result.text || '(modelul a ales sfârșitul textului)';
  }
  inspect(text) {
    const pred = new Predictor(this.mem, this.cfg);
    const tokens = tokenize(text, this.mem.tokenMode ?? 'word');
    const tree = segment(tokens.map((t) => ({ ...t, ref: pred.temp.token(t.text) })));
    const units = [];
    const root = buildUnit(tree, { unit: (xs, level) => {
      const id = pred.temp.make(xs, level); units.push({ id, level }); return id;
    } }, this.mem.K);
    const words = (id) => pred.temp.isToken(id)
      ? [pred.temp.isTemp(id) ? pred.temp.tokens.get(id) : this.mem.atoms[id].text]
      : (pred.temp.children(id) ?? []).flatMap(words);
    const b = bearingSlots(this.mem), ci = classIndex(this.mem);
    const recognized = units.filter((u) => u.level >= 3).map(({ id, level }) => {
      const app = pred.interp(id);
      if (!app) return { level, text: words(id).join(' '), recognized: false };
      const virtual = this.mem.atoms.length;
      const atoms = this.mem.atoms.slice();
      atoms[virtual] = { def: { type: 'APP', ...app,
        fills: app.fills.map((v) => pred.temp.isTemp(v) ? `temporary:${JSON.stringify(words(v))}` : v) } };
      return { level, text: words(id).join(' '), recognized: true, pattern: app.pattern,
        canonical: canon({ atoms }, virtual, b, ci), fills: app.fills.map((v) => words(v).join(' ')) };
    });
    return { knownTokens: tokens.filter((t) => this.mem.tokenId(t.text) !== undefined).length,
      tokens: tokens.length, rootRecognized: root !== null && !!pred.interp(root), units: recognized };
  }
  async execute(line) {
    const text = line.trim();
    if (!text) return { output: '' };
    if (!text.startsWith('/')) return { output: `model> ${this.reply(text)}` };
    const match = text.match(/^(\/\S+)(?:\s+([\s\S]*))?$/);
    const cmd = match[1], value = match[2] ?? '';
    switch (cmd) {
      case '/quit': case '/exit': return { output: 'Sesiune încheiată.', quit: true };
      case '/help': return { output: HELP };
      case '/reset': this.reset(); return { output: 'Memoria și contextul au fost golite.' };
      case '/context': this.context = value; return { output: value ? 'Context setat (fără învățare).' : 'Context șters.' };
      case '/continue': return { output: `continuare> ${this.continue(value)}` };
      case '/why': return { output: JSON.stringify(this.lastReply ?? { status: 'none', message: 'Niciun răspuns încă.' }, null, 2) };
      case '/teach': this.teach(value); return { output: 'Text citit. /sleep pentru descoperirea tiparelor.' };
      case '/load': this.teach(readFileSync(value, 'utf8')); return { output: 'Fișier citit. /sleep pentru descoperirea tiparelor.' };
      case '/sleep': return { output: `Somn: ${this.sleep()} treceri. ${JSON.stringify(stats(this.mem, this.cfg.measure))}` };
      case '/demo': return { output: this.demo(value || 'G7') };
      case '/stats': return { output: JSON.stringify({ documentsRead: this.reads, ...stats(this.mem, this.cfg.measure) }, null, 2) };
      case '/patterns': return { output: JSON.stringify(describe(this.mem).patterns.slice(0, 12), null, 2) };
      case '/next': return { output: this.next(value).map((x) => `${JSON.stringify(x.token)} ${(100 * x.probability).toFixed(2)}%`).join('\n') };
      case '/inspect': return { output: JSON.stringify(this.inspect(value), null, 2) };
      default: throw new Error(`comandă necunoscută: ${cmd}; folosește /help`);
    }
  }
}

export async function startChat({ seed = 1, base = {}, args = [], input = process.stdin, output = process.stdout } = {}) {
  const option = (name, fallback) => {
    const i = args.indexOf(name);
    if (i < 0) return fallback;
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`lipsește valoarea ${name}`);
    return args[i + 1];
  };
  const session = new ChatSession(loadConfig({ ...base, seed }), { maxTokens: Number(option('--max-tokens', '24')) });
  const write = (text) => output.write(text + '\n');
  write('HDCLM interactiv — răspunsuri din reguli învățate, fără LLM extern.\nEnunțurile rămân în context; întrebările se termină cu ?. /continue pentru generare liberă.\nÎntrebările și răspunsurile nu antrenează automat modelul.');
  const file = option('--load', null);
  if (file) { session.teach(readFileSync(file, 'utf8')); session.sleep(); write(`Corpus încărcat: ${file}`); }
  else if (!args.includes('--empty')) write(session.demo(option('--demo', 'G7')));
  write('/help pentru comenzi; /quit pentru ieșire.');
  const terminal = Boolean(input.isTTY && output.isTTY);
  const rl = createInterface({ input, output, terminal, prompt: 'tu> ' });
  if (terminal) rl.prompt();
  try {
    for await (const line of rl) {
      try {
        const result = await session.execute(line);
        if (result.output) write(result.output);
        if (result.quit) break;
      } catch (error) { write(`Eroare: ${error.message}`); }
      if (terminal) rl.prompt();
    }
  } finally { rl.close(); }
}
