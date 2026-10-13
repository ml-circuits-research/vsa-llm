import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Config: obiect înghețat, construit din config/default.json și suprascrieri explicite.
export function loadConfig(overrides = {}) {
  const base = JSON.parse(readFileSync(join(here, '../../config/default.json'), 'utf8'));
  return Object.freeze({ ...base, ...overrides });
}
