// Formalizare pe bAbI, sarcina 1: ce ecuații ies din text (fapte, întrebări, reguli) și dacă verbele de
// mișcare (moved / went / journeyed / travelled) ajung în aceeași alegere. Plus răspunsurile (referință E6).
// Tokeni-cuvânt (bAbI are text regulat; se evită problema spațiului din GPT-2, D2/D12).
import { runDir, writeResult } from '../run.mjs';
import { loadConfig } from '../../core/config.mjs';
import { Memory } from '../../memory/store.mjs';
import { ingest } from '../../wake/ingest.mjs';
import { deepSleep } from '../../sleep/scheduler.mjs';
import { loadBabi, babiStory } from '../../data/babi.mjs';
import { describe, total } from '../metrics.mjs';
import { Predictor, argmax } from '../../predict/distribution.mjs';

const GOLD_VERBS = ['moved', 'went', 'journeyed', 'travelled'];

function accuracy(mem, cfg, qs) {
  const pred = new Predictor(mem, cfg);
  let ok = 0;
  const rows = qs.map((q) => {
    const d = pred.nextFromText(q.prompt);
    const top = pred.tokenText(argmax(d));
    if (top === q.answer) ok++;
    return { id: q.id, answer: q.answer, top };
  });
  return { acc: qs.length ? ok / qs.length : 0, n: qs.length, failures: rows.filter((r) => r.top !== r.answer).slice(0, 15) };
}

export function run({ seed = 1, base = {} } = {}) {
  const dir = runDir('BABI1');
  const cfg = loadConfig({ seed, ...base });
  const nTrain = base.babiTrain ?? 100, nTest = base.babiTest ?? 50;
  const train = loadBabi('qa1', 'train').slice(0, nTrain).map((l, i) => babiStory(l, `tr${i}`));
  const test = loadBabi('qa1', 'test').slice(0, nTest).map((l, i) => babiStory(l, `te${i}`));
  const testQs = test.flatMap((s) => s.questions);
  const mem = new Memory(cfg);
  for (const s of train) ingest(mem, s.text, { mode: 'word', docName: s.id });
  const before = { total: total(mem, cfg.measure), acc: accuracy(mem, cfg, testQs) };
  const t0 = performance.now();
  const passes = deepSleep(mem, cfg);
  const sleepSeconds = (performance.now() - t0) / 1000;
  const after = { total: total(mem, cfg.measure), acc: accuracy(mem, cfg, testQs) };
  const desc = describe(mem);
  // formalizarea: alegerile care conțin verbe de mișcare și tiparele în care apar
  const verbChoices = desc.choices.filter((c) => c.members.some((m) => GOLD_VERBS.includes(m)));
  const best = verbChoices.reduce((b, c) => {
    const hit = c.members.filter((m) => GOLD_VERBS.includes(m)).length;
    return !b || hit > b.hit ? { hit, members: c.members, id: c.id } : b;
  }, null);
  const nm = (id) => (mem.isToken(id) ? mem.atoms[id].text : mem.atoms[id].def?.type === 'PATTERN' ? `P${id}` : `"${mem.text(id)}"`);
  const pretty = (p) => p.text.replace(/N(\d+)/g, (_, i) => nm(+i));
  return writeResult(dir, {
    experiment: 'BABI1',
    question: 'Ce ecuații ies din bAbI (sarcina 1)? Ajung verbele de mișcare în aceeași alegere?',
    seed,
    mode: 'word',
    train: train.length,
    testQuestions: testQs.length,
    sleepSeconds: +sleepSeconds.toFixed(1),
    totalBefore: before.total,
    totalAfter: after.total,
    accBefore: before.acc.acc,
    accAfter: after.acc.acc,
    failures: after.acc.failures,
    patterns: desc.patterns.sort((a, b) => b.usage - a.usage).slice(0, 40).map((p) => ({ level: p.level, text: pretty(p), usage: p.usage })),
    choices: desc.choices.map((c) => c.members.slice(0, 20)),
    verbClass: best ? { members: best.members, goldFound: best.hit, goldTotal: GOLD_VERBS.length, purity: best.hit / best.members.length } : null,
    passes: passes.map((p) => ({ kind: p.kind, total: p.total, patterns: p.patterns })),
    decision: `verbe de mișcare în aceeași alegere: ${best ? `${best.hit}/${GOLD_VERBS.length} (alegerea: ${best.members.join(', ')})` : 'niciunul'}; răspunsuri corecte: ${(before.acc.acc * 100).toFixed(1)}% fără somn, ${(after.acc.acc * 100).toFixed(1)}% după somn (${testQs.length} întrebări)`,
  });
}
