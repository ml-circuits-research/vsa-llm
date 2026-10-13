import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../../core/config.mjs';
import { training, evaluationTexts } from './cases.mjs';
import { evaluate } from './evaluate.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`lipsește valoarea ${name}`);
  return args[i + 1];
};
const seeds = option('--seeds', '1,2,3').split(',').map(Number);
if (seeds.some((n) => !Number.isInteger(n) || n < 0)) throw new Error('semințe invalide');
const profile = JSON.parse(readFileSync(new URL('../../../config/profiles/algoritm.json', import.meta.url), 'utf8'));
const adapter = option('--adapter', null);
const { createModel } = await import(adapter ? pathToFileURL(resolve(adapter)).href : './current.mjs');
const out = option('--out', null);
const results = [];
for (const seed of seeds) {
  const cfg = loadConfig({ ...Object.fromEntries(Object.entries(profile).filter(([k]) => !k.startsWith('_'))), seed });
  // Adapter receives plain training text only. Assertions/gold remain in evaluator.
  const model = await createModel({ training: training.slice(), cfg });
  const r = { seed, config: cfg, ...await evaluate(model) };
  const texts = evaluationTexts();
  r.split = { trainingDocuments: training.length, evaluationInputs: texts.length,
    seenInputs: texts.filter((t) => training.includes(t)),
    unseenInputs: texts.filter((t) => !training.includes(t)).length };
  results.push(r);
  console.log(`seed ${seed}: ${r.passed}/${r.total} obiective îndeplinite`);
  console.log(`acoperire ${r.coverage.complete}/${r.coverage.probed}; grafuri ${r.coverage.graphs}; erori execuție ${r.coverage.executionErrors}`);
  for (const row of r.rows) console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.id}${row.pass ? '' : ': ' + row.error.split('\n')[0]}`);
}
if (out) {
  mkdirSync(resolve(out), { recursive: true });
  writeFileSync(resolve(out, 'result.json'), JSON.stringify({ benchmark: 'public-development-goals', adapter: adapter ?? 'current', results }, null, 2) + '\n');
}
if (results.some((r) => r.passed !== r.total)) process.exitCode = 1;
