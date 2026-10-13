import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../../src/core/config.mjs';
import { training } from '../../src/eval/goals/cases.mjs';
import { createModel } from '../../src/eval/goals/current.mjs';
import { goalChecks } from '../../src/eval/goals/evaluate.mjs';

const profile = JSON.parse(readFileSync(new URL('../../config/profiles/algoritm.json', import.meta.url), 'utf8'));
const cfg = loadConfig(Object.fromEntries(Object.entries(profile).filter(([k]) => !k.startsWith('_'))));
const model = await createModel({ training, cfg });
// Real red tests: no skip, todo, expected-failure inversion or assertion of failure.
for (const c of goalChecks(model)) test(`[GOAL:${c.category}] ${c.id}`, c.run);
