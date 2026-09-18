#!/usr/bin/env node
/**
 * Local, file-based MCP server for the Achievement tracker.
 *
 *   tsx server.ts --file <backup.json> [--changes <changes.json>]
 *
 * Reads a backup exported from the app (Settings → Export data → Full backup) and
 * answers questions about it. Creates and updates are written to a changes file in the
 * same format, which the user imports with Settings → Import backup → Merge. There is
 * no delete: the format has no way to express one and this server never will.
 *
 * All parsing, filtering, hint stripping and stats come from src/core, the same code
 * the app runs, so what Claude writes is what the app would have written.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BACKUP_VERSION, mergeSnapshots, parseBackup } from '../src/core/backup';
import { filterAchievements, sortAchievements, NO_TEMPLATE, type RecordFilter } from '../src/core/filters';
import { computeStats } from '../src/core/stats';
import { isValidIsoDate, rangeFor, todayIso, type RangePreset } from '../src/core/dates';
import { stripHints } from '../src/core/templateHints';
import { customTokens, resolveTitle, tokenDate } from '../src/core/templateTokens';
import { parseSections } from '../src/core/sections';
import { bodyOutline } from '../src/core/starterTemplates';
import { makeLabels } from '../src/core/labels';
import { nextTagColor } from '../src/core/palette';
import type { Achievement, BackupFile, DataSnapshot, Tag, Template } from '../src/types';

/* ---------- Arguments ---------- */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const FILE = arg('file');
if (!FILE) {
  console.error('Usage: tsx server.ts --file <backup.json> [--changes <changes.json>]');
  process.exit(2);
}
const BACKUP_PATH = resolve(FILE);
const CHANGES_PATH = resolve(arg('changes') ?? join(dirname(BACKUP_PATH), 'achievements-changes.json'));

/* ---------- Data ---------- */

function readSnapshot(path: string): DataSnapshot {
  const parsed = parseBackup(readFileSync(path, 'utf8'));
  if (!parsed.ok) throw new Error(`${path}: ${parsed.error}`);
  return parsed.data;
}

/** The backup with any pending changes merged on top, re-read on every call so a fresh export is picked up. */
function load(): DataSnapshot {
  if (!existsSync(BACKUP_PATH)) throw new Error(`Backup file not found: ${BACKUP_PATH}. Export one from the app (Settings → Export data → Full backup).`);
  const base = readSnapshot(BACKUP_PATH);
  return existsSync(CHANGES_PATH) ? mergeSnapshots(base, readSnapshot(CHANGES_PATH)) : base;
}

function emptyChanges(): BackupFile {
  return { app: 'achieve-it', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), children: [], achievements: [], tags: [], templates: [] };
}

/** Upsert a record (and every tag it references) into the changes file. */
function writeChange(record: Achievement, tags: Tag[]) {
  const file: BackupFile = existsSync(CHANGES_PATH) ? (JSON.parse(readFileSync(CHANGES_PATH, 'utf8')) as BackupFile) : emptyChanges();
  file.achievements = [...file.achievements.filter((a) => a.id !== record.id), record];
  const have = new Set(file.tags.map((t) => t.id));
  for (const t of tags) if (record.tags.includes(t.id) && !have.has(t.id)) file.tags.push(t);
  file.exportedAt = new Date().toISOString();
  writeFileSync(CHANGES_PATH, JSON.stringify(file, null, 2) + '\n');
}

const IMPORT_NOTE = `Written to ${CHANGES_PATH}. To apply: in the app open Settings → Import backup, choose this file, then "Merge into existing data".`;

/* ---------- Helpers ---------- */

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true });

function childName(s: DataSnapshot, id: string): string {
  const c = s.children.find((x) => x.id === id);
  return c ? `${c.firstName} ${c.lastName}`.trim() : `Unknown ${makeLabels(s.settings.labels).one}`;
}

function findChild(s: DataSnapshot, ref: { childId?: string; childName?: string }) {
  if (ref.childId) return s.children.find((c) => c.id === ref.childId);
  const n = ref.childName?.trim().toLowerCase();
  if (!n) return undefined;
  return s.children.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === n) ?? s.children.find((c) => c.firstName.toLowerCase() === n);
}

/** Resolve tag names to tags, creating any that do not exist yet (returned separately so they get written). */
function resolveTags(s: DataSnapshot, names: string[]): { tags: Tag[]; created: Tag[] } {
  const tags: Tag[] = [];
  const created: Tag[] = [];
  const all = [...s.tags];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    let t = all.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!t) {
      t = { id: randomUUID(), name, color: nextTagColor(all.map((x) => x.color)) };
      all.push(t);
      created.push(t);
    }
    if (!tags.some((x) => x.id === t!.id)) tags.push(t);
  }
  return { tags, created };
}

function templateSections(t: Template, version: number | undefined): string[] {
  if (version === undefined || version === t.version) return bodyOutline(t.body);
  const rev = t.history?.find((h) => h.version === version);
  return rev ? bodyOutline(rev.body) : bodyOutline(t.body);
}

function describe(s: DataSnapshot, a: Achievement, withDescription: boolean) {
  const template = a.templateId ? s.templates.find((t) => t.id === a.templateId) : undefined;
  return {
    id: a.id,
    childId: a.childId,
    childName: childName(s, a.childId),
    title: a.title,
    date: a.date,
    tags: a.tags.map((id) => s.tags.find((t) => t.id === id)?.name).filter(Boolean),
    ...(a.templateId ? { templateId: a.templateId, templateName: template?.name ?? '(deleted template)', templateVersion: a.templateVersion } : {}),
    ...(a.batchId ? { batchId: a.batchId } : {}),
    source: a.source ?? 'user',
    ...(withDescription ? { description: a.description, sections: parseSections(a.description) } : {}),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

const RANGE = z.enum(['week', 'month', 'term', 'year', 'all']);

/* ---------- Server ---------- */

const server = new McpServer(
  { name: 'achieve-it', version: '0.1.0' },
  {
    instructions:
      'Achievement records for the kids (or students) one adult looks after. Call list_children first: it returns the labels the user prefers ("kid"/"student"), use them in prose. ' +
      'Records made from a template have "##" sections; list_templates shows the sections each template defines. ' +
      'You can add and update records; the user then imports the changes file in the app. You cannot delete anything.',
  },
);

server.registerTool(
  'list_children',
  { title: 'List children', description: 'Every child with their record count, plus the labels the user prefers and their term dates.' },
  async () => {
    const s = load();
    const labels = makeLabels(s.settings.labels);
    return ok({
      labels: { singular: labels.one, plural: labels.many },
      termDates: s.settings.termDates ?? [],
      children: s.children
        .map((c) => {
          const mine = s.achievements.filter((a) => a.childId === c.id);
          return { id: c.id, firstName: c.firstName, lastName: c.lastName, recordCount: mine.length, lastRecordDate: mine.map((a) => a.date).sort().at(-1) ?? null };
        })
        .sort((a, b) => a.firstName.localeCompare(b.firstName)),
    });
  },
);

server.registerTool('list_tags', { title: 'List tags', description: 'Every tag with how many records use it.' }, async () => {
  const s = load();
  return ok(
    s.tags
      .map((t) => ({ id: t.id, name: t.name, color: t.color, recordCount: s.achievements.filter((a) => a.tags.includes(t.id)).length }))
      .sort((a, b) => b.recordCount - a.recordCount || a.name.localeCompare(b.name)),
  );
});

server.registerTool(
  'list_templates',
  { title: 'List templates', description: 'Every template: its linked tags, title pattern and the tokens it needs, the sections its body defines, and the body itself to fill in.' },
  async () => {
    const s = load();
    return ok(
      s.templates
        .map((t) => ({
          id: t.id,
          name: t.name,
          tags: t.tagIds.map((id) => s.tags.find((x) => x.id === id)?.name).filter(Boolean),
          titlePattern: t.titlePattern,
          tokens: customTokens(t.titlePattern),
          sections: bodyOutline(t.body),
          body: t.body,
          version: t.version,
          usageCount: t.usageCount,
          recordCount: s.achievements.filter((a) => a.templateId === t.id).length,
        }))
        .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name)),
    );
  },
);

server.registerTool(
  'list_achievements',
  {
    title: 'List achievements',
    description: 'Records, newest first, with optional filters. Use templateId "none" for records made without a template. Descriptions are included unless includeDescription is false.',
    inputSchema: {
      childId: z.string().optional(),
      childName: z.string().optional().describe('First name or full name; an alternative to childId'),
      tagNames: z.array(z.string()).optional().describe('Match records with any of these tags'),
      templateId: z.string().optional().describe('A template id, or "none"'),
      batchId: z.string().optional(),
      source: z.enum(['user', 'claude']).optional(),
      range: RANGE.optional().describe('Relative to today; "term" needs term dates'),
      from: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      to: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      q: z.string().optional().describe('Search in title and description'),
      limit: z.number().int().positive().max(500).optional().describe('Default 100'),
      includeDescription: z.boolean().optional(),
    },
  },
  async (input) => {
    const s = load();
    const child = input.childId || input.childName ? findChild(s, input) : undefined;
    if ((input.childId || input.childName) && !child) return fail(`No child matches ${input.childId ?? input.childName}. Call list_children.`);
    const tagIds = (input.tagNames ?? []).map((n) => s.tags.find((t) => t.name.toLowerCase() === n.trim().toLowerCase())?.id).filter((x): x is string => !!x);
    if (input.tagNames?.length && !tagIds.length) return fail(`None of those tags exist. Call list_tags.`);
    const custom = !!(input.from || input.to);
    const filter: RecordFilter = {
      q: input.q ?? '',
      childIds: child ? [child.id] : [],
      tagIds,
      templateIds: input.templateId ? [input.templateId === 'none' ? NO_TEMPLATE : input.templateId] : [],
      batchId: input.batchId,
      source: input.source,
      range: custom ? 'custom' : ((input.range ?? 'all') as RangePreset),
      from: input.from,
      to: input.to,
    };
    const ctx = { children: new Map(s.children.map((c) => [c.id, c])), tags: new Map(s.tags.map((t) => [t.id, t])), terms: s.settings.termDates };
    const all = sortAchievements(filterAchievements(s.achievements, filter, ctx), { sort: 'date', direction: 'desc' }, ctx);
    const limit = input.limit ?? 100;
    return ok({ total: all.length, returned: Math.min(limit, all.length), achievements: all.slice(0, limit).map((a) => describe(s, a, input.includeDescription !== false)) });
  },
);

server.registerTool(
  'get_achievement',
  { title: 'Get achievement', description: 'One record in full, with its description split into sections and the sections its template defined at the time.', inputSchema: { id: z.string() } },
  async ({ id }) => {
    const s = load();
    const a = s.achievements.find((x) => x.id === id);
    if (!a) return fail(`No record with id ${id}.`);
    const template = a.templateId ? s.templates.find((t) => t.id === a.templateId) : undefined;
    return ok({ ...describe(s, a, true), ...(template ? { templateSections: templateSections(template, a.templateVersion) } : {}) });
  },
);

server.registerTool(
  'get_stats',
  {
    title: 'Get stats',
    description: 'Counts for a period: total with change versus the previous period, per month, per tag, per child (alphabetical, never ranked), children with nothing in the last 30 days, and firsts.',
    inputSchema: {
      childId: z.string().optional(),
      childName: z.string().optional(),
      range: RANGE.optional().describe('Default "all"'),
      from: z.string().optional().describe('YYYY-MM-DD; with "to", overrides range'),
      to: z.string().optional(),
    },
  },
  async (input) => {
    const s = load();
    const child = input.childId || input.childName ? findChild(s, input) : undefined;
    if ((input.childId || input.childName) && !child) return fail(`No child matches ${input.childId ?? input.childName}. Call list_children.`);
    const range = input.from || input.to ? rangeFor('custom', { from: input.from, to: input.to }) : rangeFor(input.range ?? 'all', { terms: s.settings.termDates });
    if (input.range === 'term' && !range) return fail('No term dates are set for today. Use from/to instead.');
    const st = computeStats({ achievements: s.achievements, children: s.children, tags: s.tags, range, childId: child?.id });
    return ok({
      range,
      total: st.total,
      previousTotal: st.previousTotal,
      delta: st.delta,
      tagsUsed: st.tagsUsed,
      mostActiveMonth: st.mostActiveMonth,
      averagePerChild: st.averagePerKid,
      perMonth: st.perMonth,
      perTag: st.perTag.map((t) => ({ tag: t.tag.name, count: t.count, previous: t.previous })),
      perChild: st.perKid.map((k) => ({ child: `${k.child.firstName} ${k.child.lastName}`.trim(), count: k.count })),
      quietChildren: st.quietKids.map((c) => `${c.firstName} ${c.lastName}`.trim()),
      monthlyStreak: st.streak,
      firsts: st.firsts.map((a) => ({ id: a.id, title: a.title, date: a.date, child: childName(s, a.childId) })),
    });
  },
);

server.registerTool(
  'add_achievement',
  {
    title: 'Add achievement',
    description:
      'Create a record for one child. With templateId, the title comes from the template pattern and its tokens, and the template tags are added; write the description as filled-in "##" sections matching the template body. Untouched [[hints]] are stripped. The record goes to the changes file for the user to import; nothing is deleted or overwritten.',
    inputSchema: {
      childId: z.string().optional(),
      childName: z.string().optional().describe('First name or full name; an alternative to childId'),
      title: z.string().optional().describe('Required without a template; with one, overrides the pattern'),
      templateId: z.string().optional(),
      tokens: z.record(z.string()).optional().describe('Values for the template title tokens, e.g. {"topic": "Colours"}'),
      date: z.string().optional().describe('YYYY-MM-DD, default today'),
      tagNames: z.array(z.string()).optional().describe('Existing tags are matched by name; unknown ones are created'),
      description: z.string().optional().describe('Markdown'),
    },
  },
  async (input) => {
    const s = load();
    const child = findChild(s, input);
    if (!child) return fail(`No child matches ${input.childId ?? input.childName ?? '(none given)'}. Call list_children.`);
    const date = input.date ?? todayIso();
    if (!isValidIsoDate(date)) return fail(`Invalid date ${input.date}. Use YYYY-MM-DD.`);
    const template = input.templateId ? s.templates.find((t) => t.id === input.templateId) : undefined;
    if (input.templateId && !template) return fail(`No template with id ${input.templateId}. Call list_templates.`);
    let title = input.title?.trim() ?? '';
    if (!title && template?.titlePattern) {
      // A person sees the live preview; a caller does not, so every token must be filled in (or a title given).
      const missing = customTokens(template.titlePattern).filter((t) => !input.tokens?.[t]?.trim());
      if (missing.length) return fail(`The "${template.name}" title pattern is "${template.titlePattern}". Provide tokens for ${missing.map((t) => `{${t}}`).join(', ')}, or give a title.`);
      title = resolveTitle(template.titlePattern, { ...input.tokens, date: tokenDate(date), child: child.firstName });
    }
    if (!title) return fail('A title is required.');
    const { tags, created } = resolveTags(s, input.tagNames ?? []);
    const templateTags = template ? template.tagIds.map((id) => s.tags.find((t) => t.id === id)).filter((t): t is Tag => !!t) : [];
    const allTags = [...templateTags, ...tags.filter((t) => !templateTags.some((x) => x.id === t.id))];
    const now = new Date().toISOString();
    const record: Achievement = {
      id: randomUUID(),
      childId: child.id,
      title,
      description: stripHints(input.description ?? ''),
      date,
      tags: allTags.map((t) => t.id),
      ...(template ? { templateId: template.id, templateVersion: template.version } : {}),
      source: 'claude',
      createdAt: now,
      updatedAt: now,
    };
    writeChange(record, [...s.tags, ...created]);
    return ok({ record: describe({ ...s, tags: [...s.tags, ...created], achievements: [...s.achievements, record] }, record, true), createdTags: created.map((t) => t.name), note: IMPORT_NOTE });
  },
);

server.registerTool(
  'update_achievement',
  {
    title: 'Update achievement',
    description: 'Change the title, date, description or tags of an existing record. Only the fields given change. The updated record goes to the changes file for the user to import. Records cannot be deleted.',
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      date: z.string().optional().describe('YYYY-MM-DD'),
      description: z.string().optional().describe('Markdown; replaces the whole description'),
      tagNames: z.array(z.string()).optional().describe('Replaces all tags; unknown names are created'),
      addTagNames: z.array(z.string()).optional().describe('Adds to the existing tags'),
    },
  },
  async (input) => {
    const s = load();
    const existing = s.achievements.find((a) => a.id === input.id);
    if (!existing) return fail(`No record with id ${input.id}.`);
    if (input.date !== undefined && !isValidIsoDate(input.date)) return fail(`Invalid date ${input.date}. Use YYYY-MM-DD.`);
    if (input.title !== undefined && !input.title.trim()) return fail('The title cannot be empty.');
    const replace = input.tagNames ? resolveTags(s, input.tagNames) : null;
    const add = input.addTagNames ? resolveTags(s, input.addTagNames) : null;
    const created = [...(replace?.created ?? []), ...(add?.created ?? [])];
    const tagIds = Array.from(new Set([...(replace ? replace.tags.map((t) => t.id) : existing.tags), ...(add?.tags.map((t) => t.id) ?? [])]));
    const record: Achievement = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.description !== undefined ? { description: stripHints(input.description) } : {}),
      tags: tagIds,
      source: 'claude',
      updatedAt: new Date().toISOString(),
    };
    writeChange(record, [...s.tags, ...created]);
    const view = { ...s, tags: [...s.tags, ...created], achievements: s.achievements.map((a) => (a.id === record.id ? record : a)) };
    return ok({ record: describe(view, record, true), createdTags: created.map((t) => t.name), note: IMPORT_NOTE });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
