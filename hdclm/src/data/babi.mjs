// bAbI (sarcina 1): povești cu fapte și întrebări. La învățare, răspunsul se scrie după întrebare
// („Where is Mary? bathroom.”), ca în G7. La test, promptul este tot textul până la întrebare inclusiv.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../data/babi');

export function loadBabi(task = 'qa1', part = 'train') {
  return readFileSync(join(DIR, `${task}_${part}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l).lines);
}

// o poveste -> textul complet (cu răspunsuri) și întrebările ei
export function babiStory(lines, id) {
  const parts = [];
  const questions = [];
  for (const l of lines) {
    if (l.type === 1) {
      const prompt = [...parts, l.text].join(' ');
      questions.push({ id: `${id}-q${questions.length}`, prompt, answer: l.answer });
      parts.push(`${l.text} ${l.answer}.`);
    } else parts.push(l.text);
  }
  return { id, text: parts.join(' '), questions };
}

// BABI2: ferestre de două fapte + întrebare (ca G10), din qa1 train și test.
// Faptul care răspunde = cel despre persoana întrebată, cu locul egal cu răspunsul (cel mai recent dacă ambele).
// heldout: toate ferestrele din test (rezervate pentru val/test); `novel` marchează tripletele
// (nume, verb, loc) care nu apar ca fapt-răspuns în nicio fereastră din train.
const FACT_RE = /^(\w+) (.+) to the (\w+)\.$/;
const parseFact = (t) => { const m = FACT_RE.exec(t); return m ? { name: m[1], verb: m[2], place: m[3] } : null; };

export function babi2Set(seed = 1) {
  void seed; // deterministă, fără hazard
  const wins = [];
  for (const source of ['train', 'test']) {
    for (const lines of loadBabi('qa1', source)) {
      const facts = [];
      for (const l of lines) {
        if (l.type === 0) { facts.push(l.text); continue; }
        if (facts.length < 2) continue;
        const f = facts.slice(-2);
        const p = f.map(parseFact);
        const who = /^Where is (\w+)\?$/.exec(l.text);
        if (!who || !p[0] || !p[1]) continue;
        let pos = -1;
        for (const k of [0, 1]) if (p[k].name === who[1] && p[k].place === l.answer) pos = k;
        if (pos < 0) continue;
        wins.push({ f, p, q: l.text, answer: l.answer, pos, source });
      }
    }
  }
  const key = (w) => `${w.p[w.pos].name}|${w.p[w.pos].verb}|${w.p[w.pos].place}`;
  const trainKeys = new Set(wins.filter((w) => w.source === 'train').map(key));
  const seen = new Set();
  const docs = [];
  for (const w of wins) {
    const prompt = `${w.f[0]} ${w.f[1]} ${w.q}`;
    const text = `${prompt} ${w.answer}.`;
    if (seen.has(text)) continue; // train are întâietate (apare primul)
    seen.add(text);
    docs.push({
      text,
      heldout: w.source === 'test',
      meta: { prompt, answer: w.answer, verbs: [w.p[0].verb, w.p[1].verb], pos: w.pos, source: w.source, novel: !trainKeys.has(key(w)) },
    });
  }
  return { name: 'BABI2', docs: docs.map((d, n) => ({ id: `BABI2-${n}`, ...d })), meta: { size: docs.length } };
}
