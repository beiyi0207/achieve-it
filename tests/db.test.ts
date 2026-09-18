import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbStore, normaliseSettings } from '../src/db';
import { DEFAULT_SETTINGS, type Achievement, type Child, type Tag, type Template } from '../src/types';

const child = (id: string): Child => ({
  id,
  firstName: 'Kid',
  lastName: id,
  age: 7,
  avatar: { style: 'lorelei', skin: '', hair: '', hairColor: '', eyes: '', mouth: '', extras: 'none', background: 'ffd166' },
  createdAt: '2026-01-01T00:00:00.000Z',
});

const ach = (id: string, childId: string, date = '2026-03-01'): Achievement => ({
  id,
  childId,
  title: `Title ${id}`,
  description: '',
  date,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const tpl = (id: string, name: string): Template => ({
  id,
  name,
  icon: 'book',
  color: 'blue',
  tagIds: [],
  titlePattern: '',
  body: '',
  suggestOnTag: true,
  version: 1,
  usageCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

let n = 0;

describe('IndexedDbStore', () => {
  let store: IndexedDbStore;

  beforeEach(async () => {
    store = new IndexedDbStore(`test-db-${n++}`);
    await store.init();
  });

  it('starts empty with default settings', async () => {
    const s = await store.loadAll();
    expect(s.children).toEqual([]);
    expect(s.achievements).toEqual([]);
    expect(s.tags).toEqual([]);
    expect(s.templates).toEqual([]);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips templates', async () => {
    await store.putTemplate(tpl('x', 'Reading log'));
    await store.putTemplates([tpl('y', 'Music'), tpl('z', 'Art')]);
    let s = await store.loadAll();
    expect(s.templates.map((t) => t.id).sort()).toEqual(['x', 'y', 'z']);
    await store.deleteTemplate('y');
    s = await store.loadAll();
    expect(s.templates.map((t) => t.id).sort()).toEqual(['x', 'z']);
  });

  it('round-trips children, achievements, tags and settings', async () => {
    await store.putChild(child('a'));
    await store.putAchievement(ach('1', 'a'));
    const tag: Tag = { id: 't1', name: 'Reading', color: 'blue' };
    await store.putTag(tag);
    await store.putSettings({ ...DEFAULT_SETTINGS, showAges: false });

    const s = await store.loadAll();
    expect(s.children).toHaveLength(1);
    expect(s.achievements[0].title).toBe('Title 1');
    expect(s.tags[0]).toEqual(tag);
    expect(s.settings.showAges).toBe(false);
    expect((s.settings as unknown as { key?: string }).key).toBeUndefined();
  });

  it('deletes achievements by child', async () => {
    await store.putChild(child('a'));
    await store.putChild(child('b'));
    await store.putAchievements([ach('1', 'a'), ach('2', 'a'), ach('3', 'b')]);
    await store.deleteAchievementsByChild('a');
    const s = await store.loadAll();
    expect(s.achievements.map((a) => a.id)).toEqual(['3']);
  });

  it('replaceAll swaps the whole dataset', async () => {
    await store.putChild(child('old'));
    await store.replaceAll({
      children: [child('new')],
      achievements: [ach('9', 'new')],
      tags: [],
      templates: [tpl('t', 'T')],
      settings: { ...DEFAULT_SETTINGS, backupReminderDays: 30 },
    });
    const s = await store.loadAll();
    expect(s.children.map((c) => c.id)).toEqual(['new']);
    expect(s.achievements.map((a) => a.id)).toEqual(['9']);
    expect(s.templates.map((t) => t.id)).toEqual(['t']);
    expect(s.settings.backupReminderDays).toBe(30);
  });

  it('clearAll empties every store', async () => {
    await store.putChild(child('a'));
    await store.putAchievement(ach('1', 'a'));
    await store.putTemplate(tpl('t', 'T'));
    await store.clearAll();
    const s = await store.loadAll();
    expect(s.children).toEqual([]);
    expect(s.achievements).toEqual([]);
    expect(s.templates).toEqual([]);
  });
});

describe('migration from version 1', () => {
  it('keeps existing data and adds the templates store and new indexes', async () => {
    const name = `test-db-migrate-${n++}`;
    // Create a v1 database the way the first release did.
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('children', { keyPath: 'id' });
        const a = db.createObjectStore('achievements', { keyPath: 'id' });
        a.createIndex('byChild', 'childId');
        a.createIndex('byDate', 'date');
        db.createObjectStore('tags', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
    await v1.put('children', child('a'));
    await v1.put('achievements', ach('1', 'a'));
    v1.close();

    const store = new IndexedDbStore(name);
    await store.init();
    await store.putTemplate(tpl('t', 'T'));
    await store.putAchievement({ ...ach('2', 'a'), templateId: 't', templateVersion: 1, batchId: 'b' });
    const s = await store.loadAll();
    expect(s.children.map((c) => c.id)).toEqual(['a']);
    expect(s.achievements.map((a) => a.id).sort()).toEqual(['1', '2']);
    expect(s.templates.map((t) => t.id)).toEqual(['t']);

    const raw = await openDB(name, 2);
    expect(Array.from(raw.objectStoreNames).sort()).toEqual(['achievements', 'children', 'settings', 'tags', 'templates']);
    const idx = raw.transaction('achievements').store.indexNames;
    expect(Array.from(idx).sort()).toEqual(['byBatch', 'byChild', 'byDate', 'byTemplate']);
    expect(await raw.getAllFromIndex('achievements', 'byBatch', 'b')).toHaveLength(1);
    expect(await raw.getAllFromIndex('achievements', 'byTemplate', 't')).toHaveLength(1);
    raw.close();
  });
});

describe('normaliseSettings', () => {
  it('fills defaults and drops the storage key', () => {
    const s = normaliseSettings({ appearance: 'dark', key: 'settings' } as never);
    expect(s.appearance).toBe('dark');
    expect(s.backupReminderDays).toBe(14);
    expect(s.termDates).toEqual([]);
    expect('key' in s).toBe(false);
  });
});
