import { describe, expect, it } from 'vitest';
import { buildBackup, buildCsv, DEFAULT_EXPORT, exportFilename } from '../src/lib/export';
import { mergeSnapshots, parseBackup } from '../src/lib/import';
import { DEFAULT_SETTINGS, type Achievement, type Child, type DataSnapshot, type Tag, type Template } from '../src/types';

const kid = (id: string, first: string): Child => ({
  id,
  firstName: first,
  lastName: 'Lee',
  age: 8,
  avatar: { style: 'lorelei', skin: 'f8d9c6', hair: 'variant01', hairColor: '0e0e0e', eyes: 'variant01', mouth: 'happy01', extras: 'none', background: 'ffd166' },
  createdAt: '2026-01-01T00:00:00.000Z',
});

const rec = (id: string, childId: string, date: string, tags: string[] = [], updatedAt = '2026-01-01T00:00:00.000Z'): Achievement => ({
  id,
  childId,
  title: `Title, with "quotes" ${id}`,
  description: 'line one\nline two',
  date,
  tags,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
});

const tags: Tag[] = [
  { id: 't1', name: 'Reading', color: 'blue' },
  { id: 't2', name: 'Sport', color: 'green' },
];

const tpl = (id: string, name: string, extra: Partial<Template> = {}): Template => ({
  id,
  name,
  icon: 'book',
  color: 'blue',
  tagIds: ['t1'],
  titlePattern: 'Read {book}',
  body: '## Book\n[[title]]',
  suggestOnTag: true,
  version: 1,
  usageCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const snap: DataSnapshot = {
  children: [kid('a', 'Ana'), kid('b', 'Ben')],
  achievements: [
    { ...rec('1', 'a', '2026-09-01', ['t1']), templateId: 'tp1', templateVersion: 1, batchId: 'batch-1' },
    rec('2', 'b', '2026-03-01', ['t2']),
    { ...rec('3', 'a', '2025-12-25'), templateId: 'gone', templateVersion: 2 },
  ],
  tags,
  templates: [tpl('tp1', 'Reading log')],
  settings: { ...DEFAULT_SETTINGS, showAges: false },
};

describe('buildBackup', () => {
  it('includes everything by default', () => {
    const b = buildBackup(snap, DEFAULT_EXPORT);
    expect(b.app).toBe('achieve-it');
    expect(b.children).toHaveLength(2);
    expect(b.achievements).toHaveLength(3);
    expect(b.tags).toHaveLength(2);
    expect(b.templates).toHaveLength(1);
    expect(b.version).toBe(2);
    expect(b.settings?.showAges).toBe(false);
  });

  it('filters by kid and range, and only keeps referenced tags', () => {
    const b = buildBackup(snap, { ...DEFAULT_EXPORT, childIds: ['a'], range: 'year' }, { now: new Date(2026, 8, 15) });
    expect(b.children.map((c) => c.id)).toEqual(['a']);
    expect(b.achievements.map((a) => a.id)).toEqual(['1']);
    expect(b.tags.map((t) => t.id)).toEqual(['t1']);
    expect(b.settings).toBeUndefined();
  });

  it('can omit avatars', () => {
    const b = buildBackup(snap, { ...DEFAULT_EXPORT, includeAvatars: false });
    expect('avatar' in b.children[0]).toBe(false);
  });
});

describe('buildCsv', () => {
  it('escapes quotes, commas and newlines', () => {
    const csv = buildCsv(snap, { ...DEFAULT_EXPORT, format: 'csv' });
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('date,child_first_name,child_last_name,child_age,title,tags,description,record_id,child_id,template');
    expect(lines[1]).toContain('"Title, with ""quotes"" 1"');
    expect(lines[1]).toContain('"line one\nline two"');
    expect(lines[1]).toContain('Reading');
    expect(csv).toMatch(/\r\n$/);
  });

  it('adds the template name, blank when none or deleted', () => {
    const lines = buildCsv(snap, { ...DEFAULT_EXPORT, format: 'csv' }).split('\r\n');
    expect(lines[1].endsWith(',Reading log')).toBe(true); // record 1 (newest)
    expect(lines[2].endsWith(',b,')).toBe(true); // record 2, no template
    expect(lines[3].endsWith(',a,')).toBe(true); // record 3, deleted template
  });

  it('names files by format and date', () => {
    expect(exportFilename({ ...DEFAULT_EXPORT }, new Date(2026, 8, 15))).toBe('achievements-backup-2026-09-15.json');
    expect(exportFilename({ ...DEFAULT_EXPORT, format: 'csv' }, new Date(2026, 8, 15))).toBe('achievements-records-2026-09-15.csv');
  });
});

describe('parseBackup', () => {
  it('round-trips a backup', () => {
    const text = JSON.stringify(buildBackup(snap, DEFAULT_EXPORT));
    const p = parseBackup(text);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.data.children).toHaveLength(2);
    expect(p.data.achievements).toHaveLength(3);
    expect(p.data.templates).toHaveLength(1);
    expect(p.data.achievements[0]).toMatchObject({ templateId: 'tp1', templateVersion: 1, batchId: 'batch-1' });
    expect(p.data.settings.showAges).toBe(false);
  });

  it('accepts version 1 backups without templates and rejects newer ones', () => {
    const v1 = parseBackup(JSON.stringify({ app: 'achieve-it', version: 1, children: [], achievements: [], tags: [] }));
    expect(v1.ok && v1.data.templates).toEqual([]);
    expect(parseBackup(JSON.stringify({ app: 'achieve-it', version: 3, children: [], achievements: [] })).ok).toBe(false);
  });

  it('normalises templates and drops duplicate names and unknown tags', () => {
    const p = parseBackup(
      JSON.stringify({
        app: 'achieve-it',
        version: 2,
        children: [],
        achievements: [],
        tags: [{ id: 't1', name: 'Reading', color: 'blue' }],
        templates: [
          { id: 'a', name: 'One', tagIds: ['t1', 'nope'], version: 0, usageCount: -2 },
          { id: 'b', name: 'one' },
          { id: 'c' },
        ],
      }),
    );
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.data.templates.map((t) => t.id)).toEqual(['a']);
    expect(p.data.templates[0]).toMatchObject({ tagIds: ['t1'], version: 1, usageCount: 0, suggestOnTag: true, icon: 'template', body: '' });
  });

  it('rejects non-backups', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"foo":1}').ok).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
  });

  it('regenerates missing avatars and drops unknown tag ids', () => {
    const text = JSON.stringify({
      app: 'achieve-it',
      version: 1,
      children: [{ id: 'x', firstName: 'Xi', lastName: '', age: '5' }],
      achievements: [{ id: 'r', childId: 'x', title: 'T', date: '2026-01-02', tags: ['missing'] }],
      tags: [],
    });
    const p = parseBackup(text);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.data.children[0].avatar.style).toBe('lorelei');
    expect(p.data.children[0].age).toBe(5);
    expect(p.data.achievements[0].tags).toEqual([]);
  });
});

describe('mergeSnapshots', () => {
  it('adds missing kids and records, keeps newer records, collapses same-name tags', () => {
    const incoming: DataSnapshot = {
      children: [kid('a', 'Ana Renamed'), kid('c', 'Cy')],
      achievements: [
        rec('1', 'a', '2026-09-02', ['t1'], '2026-05-01T00:00:00.000Z'), // newer than current
        rec('2', 'b', '2026-03-02', ['t2'], '2025-01-01T00:00:00.000Z'), // older than current
        rec('9', 'c', '2026-06-01', ['t-other']),
      ],
      tags: [
        { id: 't1', name: 'Reading', color: 'blue' },
        { id: 't-other', name: 'sport', color: 'red' }, // same name as t2, different id
      ],
      templates: [],
      settings: { ...DEFAULT_SETTINGS, showAges: true },
    };
    const m = mergeSnapshots(snap, incoming);
    expect(m.children.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
    expect(m.children.find((c) => c.id === 'a')?.firstName).toBe('Ana'); // existing kept
    expect(m.achievements.find((a) => a.id === '1')?.date).toBe('2026-09-02');
    expect(m.achievements.find((a) => a.id === '2')?.date).toBe('2026-03-01');
    expect(m.achievements.find((a) => a.id === '9')?.tags).toEqual(['t2']);
    expect(m.tags).toHaveLength(2);
    expect(m.settings.showAges).toBe(false);
  });

  it('merges templates by id, renames name clashes and remaps merged tags', () => {
    const incoming: DataSnapshot = {
      children: [],
      achievements: [],
      tags: [{ id: 't-other', name: 'Sport', color: 'red' }],
      templates: [
        tpl('tp1', 'Reading log renamed', { body: 'changed' }), // same id: existing wins
        tpl('tp2', 'reading LOG', { tagIds: ['t-other'] }), // name clash, different id
        tpl('tp3', 'Sports milestone', { tagIds: ['t-other'] }),
      ],
      settings: DEFAULT_SETTINGS,
    };
    const m = mergeSnapshots(snap, incoming);
    const byId = new Map(m.templates.map((t) => [t.id, t]));
    expect(byId.get('tp1')?.name).toBe('Reading log');
    expect(byId.get('tp2')?.name).toBe('reading LOG (imported)');
    expect(byId.get('tp2')?.tagIds).toEqual(['t2']);
    expect(byId.get('tp3')?.tagIds).toEqual(['t2']);
  });
});
