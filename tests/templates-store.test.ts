import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbStore } from '../src/db';
import {
  addAchievements,
  addTag,
  addTemplate,
  duplicateTemplate,
  initStore,
  mergeTags,
  recordTemplateUsage,
  removeTag,
  removeTemplate,
  templates,
  templatesByRecency,
  uniqueTemplateName,
  updateTemplate,
  achievements,
} from '../src/store';

let n = 0;

const base = { icon: 'book', color: 'blue', tagIds: [] as string[], titlePattern: 'Read {book}', body: '## Book\n[[title]]', suggestOnTag: true };

describe('templates in the store', () => {
  beforeEach(async () => {
    await initStore(new IndexedDbStore(`store-test-${n++}`));
  });

  it('adds, versions, duplicates and deletes templates', async () => {
    const t = await addTemplate({ ...base, name: ' Reading log ' });
    expect(t.name).toBe('Reading log');
    expect(t.version).toBe(1);
    expect(t.usageCount).toBe(0);

    // Cosmetic changes do not bump the version.
    let next = await updateTemplate({ ...t, name: 'Reading', color: 'red', suggestOnTag: false, tagIds: ['x'] });
    expect(next.version).toBe(1);
    // Content changes do.
    next = await updateTemplate({ ...next, body: '## Book\n[[title and author]]' });
    expect(next.version).toBe(2);
    next = await updateTemplate({ ...next, titlePattern: 'Read {book} by {author}' });
    expect(next.version).toBe(3);
    // Each content change files the previous version away, oldest first.
    expect(next.history?.map((h) => [h.version, h.titlePattern, h.body])).toEqual([
      [1, 'Read {book}', '## Book\n[[title]]'],
      [2, 'Read {book}', '## Book\n[[title and author]]'],
    ]);

    const copy = await duplicateTemplate(t.id);
    expect(copy?.name).toBe('Reading copy');
    expect(copy?.version).toBe(1);
    expect(copy?.history).toBeUndefined();
    expect(copy?.body).toBe(next.body);
    expect(uniqueTemplateName('reading')).toBe('reading 2');

    await removeTemplate(t.id);
    expect(templates.value.map((x) => x.id)).toEqual([copy!.id]);
  });

  it('counts usage once per call and orders by recency', async () => {
    const a = await addTemplate({ ...base, name: 'A' });
    const b = await addTemplate({ ...base, name: 'B' });
    await recordTemplateUsage(b.id);
    expect(templatesByRecency.value.map((t) => t.name)).toEqual(['B', 'A']);
    const used = templates.value.find((t) => t.id === b.id)!;
    expect(used.usageCount).toBe(1);
    expect(used.lastUsedAt).toBeTruthy();
    await recordTemplateUsage(a.id);
    await recordTemplateUsage(a.id);
    expect(templatesByRecency.value.map((t) => t.name)).toEqual(['A', 'B']);
  });

  it('strips deleted tags and remaps merged tags on templates', async () => {
    const reading = await addTag('Reading');
    const books = await addTag('Books');
    const sport = await addTag('Sport');
    const t = await addTemplate({ ...base, name: 'T', tagIds: [reading.id, sport.id] });

    await mergeTags(reading.id, books.id);
    expect(templates.value.find((x) => x.id === t.id)?.tagIds).toEqual([books.id, sport.id]);

    await removeTag(sport.id);
    expect(templates.value.find((x) => x.id === t.id)?.tagIds).toEqual([books.id]);
  });

  it('saves a class-mode batch in one go', async () => {
    const list = await addAchievements([
      { childId: 'c1', title: 'Cartwheel', description: '', date: '2026-09-15', tags: [], batchId: 'b' },
      { childId: 'c2', title: 'Cartwheel', description: '## Notes\nnearly', date: '2026-09-15', tags: [], batchId: 'b' },
    ]);
    expect(list).toHaveLength(2);
    expect(new Set(list.map((a) => a.id)).size).toBe(2);
    expect(achievements.value.filter((a) => a.batchId === 'b')).toHaveLength(2);
  });
});
