import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbStore, normaliseSettings } from '../src/db';
import { DEFAULT_SETTINGS, type Achievement, type Child, type Tag } from '../src/types';

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
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
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
      settings: { ...DEFAULT_SETTINGS, backupReminderDays: 30 },
    });
    const s = await store.loadAll();
    expect(s.children.map((c) => c.id)).toEqual(['new']);
    expect(s.achievements.map((a) => a.id)).toEqual(['9']);
    expect(s.settings.backupReminderDays).toBe(30);
  });

  it('clearAll empties every store', async () => {
    await store.putChild(child('a'));
    await store.putAchievement(ach('1', 'a'));
    await store.clearAll();
    const s = await store.loadAll();
    expect(s.children).toEqual([]);
    expect(s.achievements).toEqual([]);
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
