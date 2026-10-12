// Utilitare comune experimentelor: date, învățare, jurnal, result.json.
import { mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../core/config.mjs';
import { Memory } from '../memory/store.mjs';
import { ingest } from '../wake/ingest.mjs';
import { generateSet, splitDocs, saveSplit } from '../data/generate.mjs';
import { deepSleep } from '../sleep/scheduler.mjs';
import { predError, checkSplit, reconstruction, total } from './metrics.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function runDir(name) {
  const dir = join(ROOT, 'runs', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

// modul simplu: tot textul de învățare, apoi somn adânc
export function trainSimple({ set, seed = 1, overrides = {}, splitOpts = {}, genOpts = {}, dir = null, sleep = true, validate = true }) {
  const cfg = loadConfig({ seed, ...overrides });
  const data = generateSet(set, seed, genOpts);
  const split = splitDocs(data, seed, splitOpts);
  if (dir) saveSplit(dir, split);
  const mem = new Memory(cfg);
  const roots = split.train.map((d) => ({ doc: d, ...ingest(mem, d.text, { docName: d.id }) })).map((r) => ({ id: r.root, tokens: r.tokens }));
  const before = { total: total(mem, cfg.measure), valError: split.val.length ? predError(mem, cfg, split.val) : null };
  const logPath = dir ? join(dir, 'log.jsonl') : null;
  if (logPath) writeFileSync(logPath, '');
  const passes = sleep
    ? deepSleep(mem, cfg, {
        validate: validate && split.val.length ? (m) => predError(m, cfg, split.val) : undefined,
        log: logPath ? (rec) => appendFileSync(logPath, JSON.stringify(rec) + '\n') : undefined,
      })
    : [];
  checkSplit(mem, split);
  const recon = reconstruction(mem, roots);
  if (dir) writeFileSync(join(dir, 'atoms.jsonl'), mem.toJSONL());
  return { cfg, data, split, mem, roots, before, passes, recon };
}

export function writeResult(dir, result) {
  writeFileSync(join(dir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
