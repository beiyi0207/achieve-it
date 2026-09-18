/**
 * End-to-end check: start the server on a sample backup, call every tool through a real
 * MCP client, and verify the changes file it writes merges back cleanly.
 *   npm test   (in mcp/)
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildBackup, DEFAULT_EXPORT, mergeSnapshots, parseBackup, placeholderAvatar } from '../src/core/backup';
import { DEFAULT_SETTINGS, type DataSnapshot } from '../src/types';

const dir = mkdtempSync(join(tmpdir(), 'achieve-it-mcp-'));
const backupPath = join(dir, 'backup.json');
const changesPath = join(dir, 'changes.json');

const snap: DataSnapshot = {
  children: [
    { id: 'c1', firstName: 'Maya', lastName: 'Okafor', avatar: placeholderAvatar('Maya Okafor', 'c1'), createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'c2', firstName: 'Leo', lastName: 'Bennett', avatar: placeholderAvatar('Leo Bennett', 'c2'), createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  tags: [
    { id: 't-read', name: 'Reading', color: 'blue' },
    { id: 't-first', name: 'First', color: 'amber' },
  ],
  templates: [
    {
      id: 'tp-read',
      name: 'Reading log',
      icon: 'book',
      color: 'blue',
      tagIds: ['t-read'],
      titlePattern: 'Read {book}',
      body: '## Book\n[[title and author]]\n\n## Thoughts\n[[what they said]]',
      suggestOnTag: true,
      version: 2,
      history: [{ version: 1, titlePattern: 'Read {book}', body: '## Book\n[[title]]', changedAt: '2026-02-01T00:00:00.000Z' }],
      usageCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ],
  achievements: [
    { id: 'r1', childId: 'c1', title: 'Read Matilda', description: '## Book\nMatilda by Roald Dahl', date: '2026-09-10', tags: ['t-read'], templateId: 'tp-read', templateVersion: 1, createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z' },
    { id: 'r2', childId: 'c2', title: 'First goal', description: '', date: '2026-08-20', tags: ['t-first'], createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-20T00:00:00.000Z' },
  ],
  settings: { ...DEFAULT_SETTINGS, labels: { singular: 'student', plural: 'students' }, termDates: [{ name: 'Autumn', start: '2026-09-01', end: '2026-12-18' }] },
};
writeFileSync(backupPath, JSON.stringify(buildBackup(snap, DEFAULT_EXPORT), null, 2));

const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(new StdioClientTransport({ command: 'npx', args: ['tsx', 'server.ts', '--file', backupPath, '--changes', changesPath], cwd: new URL('.', import.meta.url).pathname }));

type Result = { content: { type: string; text: string }[]; isError?: boolean };
async function call(name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as Result;
  const text = r.content[0].text;
  return { error: r.isError, data: r.isError ? text : JSON.parse(text) };
}

const tools = (await client.listTools()).tools.map((t) => t.name).sort();
assert.deepEqual(tools, ['add_achievement', 'get_achievement', 'get_stats', 'list_achievements', 'list_children', 'list_tags', 'list_templates', 'update_achievement']);
assert.ok(!tools.some((t) => /delete|remove/.test(t)), 'no delete tool');

const kids = (await call('list_children')).data;
assert.equal(kids.labels.singular, 'student');
assert.equal(kids.children.find((c: { firstName: string }) => c.firstName === 'Maya').recordCount, 1);
assert.equal(kids.termDates.length, 1);

const tags = (await call('list_tags')).data;
assert.equal(tags[0].recordCount, 1);

const templates = (await call('list_templates')).data;
assert.deepEqual(templates[0].sections, ['Book', 'Thoughts']);
assert.deepEqual(templates[0].tokens, ['book']);

const list = (await call('list_achievements', { childName: 'maya' })).data;
assert.equal(list.total, 1);
assert.equal(list.achievements[0].sections[0].heading, 'Book');
assert.equal((await call('list_achievements', { templateId: 'none' })).data.total, 1);
assert.equal((await call('list_achievements', { range: 'term' })).data.total, 1);
assert.equal((await call('list_achievements', { q: 'goal', includeDescription: false })).data.achievements[0].description, undefined);
assert.ok((await call('list_achievements', { childName: 'nobody' })).error);

const one = (await call('get_achievement', { id: 'r1' })).data;
assert.deepEqual(one.templateSections, ['Book'], 'sections come from the template version the record was made with');

const stats = (await call('get_stats', { range: 'all' })).data;
assert.equal(stats.total, 2);
assert.equal(stats.firsts.length, 1);
assert.deepEqual(stats.perChild.map((c: { child: string }) => c.child), ['Leo Bennett', 'Maya Okafor']);

// Writes
const missingTokens = await call('add_achievement', { childName: 'Leo', templateId: 'tp-read' });
assert.ok(missingTokens.error && /\{book\}/.test(missingTokens.data));

const added = (
  await call('add_achievement', {
    childName: 'Leo',
    templateId: 'tp-read',
    tokens: { book: 'The Gruffalo' },
    date: '2026-09-16',
    tagNames: ['Bedtime'],
    description: '## Book\nThe Gruffalo by Julia Donaldson\n\n## Thoughts\n[[what they said]]',
  })
).data;
assert.equal(added.record.title, 'Read The Gruffalo');
assert.equal(added.record.description, '## Book\nThe Gruffalo by Julia Donaldson', 'untouched hint and its section are stripped');
assert.deepEqual(added.record.tags, ['Reading', 'Bedtime']);
assert.equal(added.record.templateVersion, 2);
assert.equal(added.record.source, 'claude');
assert.deepEqual(added.createdTags, ['Bedtime']);

// The server sees its own write on the next call.
assert.equal((await call('list_achievements', { source: 'claude' })).data.total, 1);

const updated = (await call('update_achievement', { id: 'r2', title: 'First goal of the season', addTagNames: ['Sport'] })).data;
assert.equal(updated.record.title, 'First goal of the season');
assert.deepEqual(updated.record.tags, ['First', 'Sport']);
assert.ok((await call('update_achievement', { id: 'nope', title: 'x' })).error);

// The changes file is a valid backup that merges cleanly into the original.
const changes = parseBackup(readFileSync(changesPath, 'utf8'));
assert.ok(changes.ok);
if (changes.ok) {
  assert.equal(changes.data.achievements.length, 2);
  assert.deepEqual(changes.data.tags.map((t) => t.name).sort(), ['Bedtime', 'First', 'Reading', 'Sport']);
  const merged = mergeSnapshots(snap, changes.data);
  assert.equal(merged.achievements.length, 3);
  assert.equal(merged.achievements.find((a) => a.id === 'r2')?.title, 'First goal of the season');
  assert.equal(merged.tags.length, 4);
}

await client.close();
console.log('MCP smoke test passed');
