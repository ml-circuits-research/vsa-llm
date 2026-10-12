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
