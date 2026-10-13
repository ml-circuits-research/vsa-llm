// These are evaluator regression tests, not expected failures of the learner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalChecks, semanticGraph, evaluate } from '../src/eval/goals/evaluate.mjs';
import { pairs, training, evaluationTexts } from '../src/eval/goals/cases.mjs';

const check = (model, id) => goalChecks(model).find((c) => c.id === id).run();
test('goal harness: two null parses cannot pass paraphrase or distinction', async () => {
  const model = { formalize: () => ({ complete: false, key: null }) };
  await assert.rejects(check(model, 'active-passive-heldout'), /incompletă/);
  await assert.rejects(check(model, 'negation'), /incompletă/);
});
test('goal harness: constant canonical key cannot pass argument preservation', async () => {
  await assert.rejects(check({ formalize: () => ({ complete: true, key: 'constant' }) }, 'argument-swap'), /contopite/);
});
test('goal harness: source echo cannot replace a semantic graph', () => {
  assert.throws(() => semanticGraph({ text: 'Ada approved the report.' }));
  assert.throws(() => semanticGraph({ nodes: [{ id: 'a', kind: 'entity' }], edges: [{ from: 'a', to: 'missing', role: 'r' }] }));
});
test('goal harness: reasoning receives only independent copies of graphs', async () => {
  const graph = { nodes: [{ id: 'r', kind: 'relation' }, { id: 'x', kind: 'entity' }],
    edges: [{ from: 'r', to: 'x', role: 'argument' }] };
  let called = false;
  const model = { formalize: () => ({ complete: true, key: 'k', graph }),
    infer: (...args) => {
      called = true; assert.equal(args.length, 2);
      assert.equal(args[0].length, 2); assert.notEqual(args[0][0], graph);
      assert.deepEqual(args[1], graph); args[0][0].nodes.length = 0;
      return true;
    } };
  await check(model, 'modus-ponens-software');
  assert.equal(called, true); assert.equal(graph.nodes.length, 2);
});
test('goal harness: all goals execute and exceptions are reported separately', async () => {
  const result = await evaluate({ formalize: () => { throw new Error('broken adapter'); }, snapshot: () => 's' });
  assert.equal(result.rows.length, goalChecks({}).length);
  assert.equal(result.passed, 0);
  assert.ok(result.rows.every((r) => r.failureType === 'execution-error'));
  assert.ok(result.coverage.executionErrors > 0);
});
test('goal fixtures: held-out positive pairs really differ from all training documents', () => {
  for (const id of ['active-passive-heldout', 'new-entity-active-passive', 'scientific-paraphrase', 'software-paraphrase']) {
    const c = pairs.find((p) => p.id === id);
    assert.ok(!training.includes(c.a) && !training.includes(c.b), id);
  }
});
test('goal harness: coverage probes every input despite early failures', async () => {
  const seen = new Set();
  const result = await evaluate({ formalize: (text) => {
    seen.add(text); return { complete: false, key: null };
  }, snapshot: () => 'unchanged' });
  assert.equal(result.coverage.probed, evaluationTexts().length);
  assert.equal(result.coverage.complete, 0);
  assert.deepEqual(seen, new Set(evaluationTexts()));
});
test('goal harness: contamination on the very first probe remains a failure', async () => {
  const state = { reads: 0 };
  const result = await evaluate({ snapshot: () => state, formalize: () => {
    if (!state.reads) state.reads++;
    return { complete: false, key: null };
  } });
  const row = result.rows.find((r) => r.id === 'evaluation-is-read-only');
  assert.equal(row.pass, false);
  assert.match(row.error, /evaluarea completă/);
});
