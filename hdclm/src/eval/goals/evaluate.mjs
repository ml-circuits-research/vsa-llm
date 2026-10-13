import assert from 'node:assert/strict';
import { pairs, ambiguities, reasoning, exactTexts, prose, evaluationTexts, VERSION } from './cases.mjs';

function complete(result, text) {
  assert.equal(result?.complete, true, `formalizare incompletă: ${text}`);
  assert.equal(typeof result.key, 'string', 'lipsește cheia semantică');
  assert.ok(result.key.length, 'cheie semantică goală');
}

// Minimal graph interface, not a prescribed inventory of learned predicates/roles.
// The downstream reasoner must operate on nodes and edges, not parse a text wrapper.
export function semanticGraph(graph) {
  assert.ok(graph && typeof graph === 'object', 'lipsește graful semantic');
  assert.ok(Array.isArray(graph.nodes) && graph.nodes.length, 'graful nu are noduri');
  assert.ok(Array.isArray(graph.edges) && graph.edges.length, 'graful nu are relații');
  const ids = new Set(graph.nodes.map((n) => n.id));
  assert.equal(ids.size, graph.nodes.length, 'id-uri de nod duplicate');
  for (const n of graph.nodes) {
    assert.ok(typeof n.id === 'string' && n.id.length, 'id de nod invalid');
    assert.ok(['entity', 'literal', 'relation', 'operator', 'variable'].includes(n.kind), 'tip de nod invalid');
    assert.ok(!('text' in n) && !('source' in n), 'text brut în nodul semantic');
  }
  for (const e of graph.edges) {
    assert.ok(ids.has(e.from) && ids.has(e.to), 'muchie spre un nod inexistent');
    assert.ok(typeof e.role === 'string' && e.role.length, 'muchie fără rol');
  }
  assert.ok(!('text' in graph) && !('source' in graph), 'text brut în loc de graf semantic');
}

export function goalChecks(model) {
  const checks = pairs.map((c) => ({ ...c, run: async () => {
    const a = await model.formalize(c.a), b = await model.formalize(c.b);
    complete(a, c.a); complete(b, c.b);
    assert.equal(a.key === b.key, c.same,
      `${c.same ? 'reformulări separate' : 'sensuri/argumente contopite'}: ${a.key} / ${b.key}`);
  } }));
  checks.push({ id: 'ambiguity-preserved', category: 'ambiguity', run: async () => {
    for (const text of ambiguities) {
      const r = await model.formalize(text);
      assert.ok(r?.interpretations?.length >= 2, `ambiguitate pierdută: ${text}`);
      const keys = r.interpretations.map((x) => x.key);
      assert.ok(keys.every((x) => typeof x === 'string' && x.length), 'interpretări fără chei');
      assert.equal(new Set(keys).size, keys.length, 'interpretări duplicate');
    }
  } });
  checks.push({ id: 'exact-source-reconstruction', category: 'provenance', run: async () => {
    for (const text of exactTexts) assert.equal((await model.formalize(text)).reconstructed, text);
  } });
  checks.push({ id: 'export-semantic-frame', category: 'frame-export', run: async () => {
    const r = await model.formalize('Ada approved the proposal.');
    complete(r, 'Ada approved the proposal.'); semanticGraph(r.graph);
    assert.ok(r.graph.nodes.some((n) => n.kind === 'relation'), 'lipsește relația');
    assert.ok(r.graph.nodes.some((n) => n.kind === 'entity'), 'lipsesc argumentele');
  } });
  checks.push({ id: 'nested-proposition-structure', category: 'composition', run: async () => {
    const r = await model.formalize('Ada believes that the report is not valid.');
    complete(r, 'Ada believes that the report is not valid.'); semanticGraph(r.graph);
    const nodes = new Map(r.graph.nodes.map((n) => [n.id, n]));
    assert.ok(r.graph.edges.some((e) =>
      ['relation', 'operator'].includes(nodes.get(e.from).kind) &&
      ['relation', 'operator'].includes(nodes.get(e.to).kind)), 'propoziția este aplatizată');
    assert.ok(r.graph.nodes.some((n) => n.kind === 'operator'), 'negația nu are structură explicită');
  } });
  for (const c of prose) checks.push({ id: c.id, category: 'open-text', run: async () => {
    const r = await model.formalize(c.text); complete(r, c.text); semanticGraph(r.graph);
    assert.equal(r.reconstructed, c.text, 'formalizarea textului liber pierde sursa');
    assert.ok(r.graph.nodes.filter((n) => n.kind === 'relation').length > 1,
      'textul este redus la un singur atom opac');
  } });
  for (const c of reasoning) checks.push({ ...c, run: async () => {
    const premises = [];
    for (const text of c.premises) {
      const r = await model.formalize(text); complete(r, text);
      semanticGraph(r.graph);
      premises.push(r.graph);
    }
    const q = await model.formalize(c.query); complete(q, c.query);
    semanticGraph(q.graph);
    assert.equal(typeof model.infer, 'function', 'lipsește raționamentul peste grafuri');
    // Deliberately no premise text, expected answer, case id or domain passed in.
    const answer = await model.infer(structuredClone(premises), structuredClone(q.graph));
    assert.equal(answer, c.answer);
  } });
  checks.push({ id: 'evaluation-is-read-only', category: 'integrity', run: async () => {
    assert.equal(typeof model.snapshot, 'function', 'lipsește snapshot-ul pentru verificarea contaminării');
    const before = structuredClone(await model.snapshot());
    for (const c of pairs) { await model.formalize(c.a); await model.formalize(c.b); }
    assert.deepEqual(await model.snapshot(), before, 'evaluarea a modificat memoria antrenată');
  } });
  return checks;
}

export async function evaluate(model) {
  const rows = [];
  const probes = new Map();
  const initial = typeof model.snapshot === 'function' ? structuredClone(await model.snapshot()) : null;
  const measured = { ...model, formalize: async (text) => {
    try {
      const result = await model.formalize(text);
      probes.set(text, { complete: result?.complete === true, graph: !!result?.graph });
      return result;
    } catch (error) {
      probes.set(text, { complete: false, graph: false, error: error.message });
      throw error;
    }
  } };
  // Fixed denominator: probe even texts whose goal would short-circuit on its first
  // failing premise. Abstention cannot improve the score by hiding hard inputs.
  for (const text of evaluationTexts()) {
    try { await measured.formalize(text); }
    catch { /* Error is retained in probes and in the goal that exercises this text. */ }
  }
  for (const c of goalChecks(measured)) {
    try { await c.run(); rows.push({ id: c.id, category: c.category, pass: true }); }
    catch (error) { rows.push({ id: c.id, category: c.category, pass: false,
      failureType: error.code === 'ERR_ASSERTION' ? 'unmet-goal' : 'execution-error', error: error.message }); }
  }
  const integrity = rows.find((r) => r.id === 'evaluation-is-read-only');
  if (initial !== null) {
    try { assert.deepEqual(await model.snapshot(), initial); }
    catch { Object.assign(integrity, { pass: false, failureType: 'unmet-goal', error: 'evaluarea completă a modificat memoria antrenată' }); }
  }
  const byCategory = {};
  for (const row of rows) {
    const group = byCategory[row.category] ??= { passed: 0, total: 0 };
    group.total++; if (row.pass) group.passed++;
  }
  return { version: VERSION, passed: rows.filter((r) => r.pass).length, total: rows.length, byCategory,
    coverage: { probed: probes.size, complete: [...probes.values()].filter((r) => r.complete).length,
      graphs: [...probes.values()].filter((r) => r.graph).length,
      executionErrors: [...probes.values()].filter((r) => r.error).length }, rows };
}
