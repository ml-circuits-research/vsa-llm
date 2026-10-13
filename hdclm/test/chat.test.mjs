import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { loadConfig } from '../src/core/config.mjs';
import { ChatSession, startChat } from '../src/chat.mjs';
import { generateSet, splitDocs } from '../src/data/generate.mjs';

test('chat: real held-out G7 question, read-only prediction and inspection', () => {
  const s = new ChatSession(loadConfig());
  const banner = s.demo('G7');
  const prompt = banner.split('Încearcă: ')[1];
  assert.ok(prompt);
  const expected = prompt.split(' ')[0]; // G7 asks Who has the object of its first fact.
  const before = s.mem.toJSONL();
  assert.equal(s.next(prompt)[0].token, expected);
  assert.equal(s.reply(prompt), `${expected}.`);
  const report = s.inspect('Zeyna has the book.');
  assert.equal(report.tokens, 5); assert.equal(report.knownTokens, 4);
  assert.equal(s.mem.toJSONL(), before);
});
test('chat: successive turns use context without training on the conversation', () => {
  const s = new ChatSession(loadConfig());
  s.demo('G7');
  const before = s.mem.toJSONL();
  s.reply('Ana has the pen.');
  assert.equal(s.reply('Who has the pen?'), 'Ana.');
  assert.equal(s.mem.toJSONL(), before);
});
test('chat: unsupported questions abstain instead of inventing a continuation', () => {
  const s = new ChatSession(loadConfig());
  s.demo('G7');
  assert.match(s.reply('Why is the universe expanding?'), /Nu pot determina/);
});
test('chat: a complete multi-token response follows a learned equation', () => {
  const s = new ChatSession(loadConfig());
  for (const name of ['Ana', 'Maria', 'Ion', 'Elena', 'Mihai', 'Radu']) {
    s.teach(`${name} reads. Who reads? ${name} reads.`);
  }
  s.sleep();
  assert.equal(s.reply('Ana reads. Who reads?'), 'Ana reads.');
  assert.equal(s.lastReply.status, 'supported');
  assert.ok(s.lastReply.candidates[0].pattern > 0);
});
test('chat: conflicting learned rules abstain and expose both alternatives', () => {
  const s = new ChatSession(loadConfig());
  for (const name of ['Ana', 'Maria', 'Ion', 'Elena', 'Mihai', 'Radu']) {
    s.teach(`${name} reads. Who reads? ${name}.`);
    s.teach(`${name} reads. Who reads? Dan.`);
  }
  s.sleep();
  assert.match(s.reply('Ana reads. Who reads?'), /răspuns unic/);
  assert.equal(s.lastReply.status, 'ambiguous');
  assert.deepEqual(new Set(s.lastReply.alternatives), new Set(['Ana.', 'Dan.']));
});
test('chat: full answers on held-out G7 and G8 combinations, three seeds', () => {
  for (const seed of [1, 2, 3]) for (const name of ['G7', 'G8']) {
    const s = new ChatSession(loadConfig({ seed }));
    s.demo(name);
    const held = splitDocs(generateSet(name, seed), seed).test.filter((d) => d.heldout);
    assert.ok(held.length);
    for (const d of held) assert.equal(s.reply(d.meta.prompt), `${d.meta.answer}.`, `${name}, seed ${seed}, ${d.id}`);
  }
});
test('chat: teaching is explicit; context is not ingested; reset clears both', async () => {
  const s = new ChatSession(loadConfig());
  assert.match(s.reply('Hello'), /goală/);
  await s.execute('/teach Ada reads.');
  const before = s.mem.toJSONL();
  await s.execute('/context Unknown person is outside.');
  await s.execute('Who is outside?');
  assert.equal(s.mem.toJSONL(), before);
  assert.equal(s.mem.tokenId('Unknown'), undefined);
  await s.execute('/reset');
  assert.equal(s.mem.tokenIndex.size, 0); assert.equal(s.context, '');
});
test('chat: scripted stdin processes every command and reports errors without exiting', async () => {
  let out = '';
  const input = Readable.from(['/teach Ada reads.\n/sleep\n/stats\n/unknown\n/inspect Ada reads.\n/quit\n']);
  const output = new Writable({ write(chunk, encoding, callback) { out += chunk.toString(); callback(); } });
  await startChat({ args: ['--empty'], input, output });
  assert.match(out, /Text citit/); assert.match(out, /Somn:/);
  assert.match(out, /comandă necunoscută/); assert.match(out, /knownTokens/);
  assert.match(out, /Sesiune încheiată/);
});
