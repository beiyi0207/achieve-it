import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER, NO_TEMPLATE, filterAchievements, groupAchievements, queryFromView, sortAchievements, viewFromQuery, type FilterContext } from '../src/lib/filters';
import { DEFAULT_SETTINGS, type Achievement, type Child, type Tag } from '../src/types';

const kid = (id: string, first: string, bg = 'ffd166'): Child => ({
  id,
  firstName: first,
  lastName: 'X',
  age: 7,
  avatar: { style: 'lorelei', skin: '', hair: '', hairColor: '', eyes: '', mouth: '', extras: 'none', background: bg },
  createdAt: '2026-01-01T00:00:00.000Z',
});

const rec = (id: string, childId: string, date: string, title: string, tags: string[] = [], description = ''): Achievement => ({
  id,
  childId,
  title,
  description,
  date,
  tags,
  createdAt: `2026-01-01T00:00:0${id}.000Z`,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const tags: Tag[] = [
  { id: 't-read', name: 'Reading', color: 'blue' },
  { id: 't-sport', name: 'Sport', color: 'green' },
];

const ctx: FilterContext = {
  children: new Map([kid('a', 'Zoe'), kid('b', 'Amir', 'b5e48c')].map((c) => [c.id, c])),
  tags: new Map(tags.map((t) => [t.id, t])),
  terms: [{ name: 'Autumn', start: '2026-09-01', end: '2026-12-18' }],
  now: new Date(2026, 8, 15),
};

const list: Achievement[] = [
  rec('1', 'a', '2026-09-10', 'Read a book', ['t-read'], 'chapter book'),
  rec('2', 'b', '2026-08-20', 'Scored a goal', ['t-sport']),
  rec('3', 'a', '2026-09-14', 'Swam a length', ['t-sport', 't-read']),
  rec('4', 'b', '2026-02-01', 'Untagged thing'),
];

describe('filterAchievements', () => {
  it('matches search in title and description', () => {
    expect(filterAchievements(list, { ...EMPTY_FILTER, q: 'CHAPTER' }, ctx).map((a) => a.id)).toEqual(['1']);
    expect(filterAchievements(list, { ...EMPTY_FILTER, q: 'swam' }, ctx).map((a) => a.id)).toEqual(['3']);
  });

  it('filters by kids and tags (any match)', () => {
    expect(filterAchievements(list, { ...EMPTY_FILTER, childIds: ['b'] }, ctx).map((a) => a.id)).toEqual(['2', '4']);
    expect(filterAchievements(list, { ...EMPTY_FILTER, tagIds: ['t-sport'] }, ctx).map((a) => a.id)).toEqual(['2', '3']);
  });

  it('filters by range presets and term dates', () => {
    expect(filterAchievements(list, { ...EMPTY_FILTER, range: 'month' }, ctx).map((a) => a.id)).toEqual(['1', '3']);
    expect(filterAchievements(list, { ...EMPTY_FILTER, range: 'term' }, ctx).map((a) => a.id)).toEqual(['1', '3']);
    expect(filterAchievements(list, { ...EMPTY_FILTER, range: 'year' }, ctx)).toHaveLength(4);
    expect(filterAchievements(list, { ...EMPTY_FILTER, range: 'custom', from: '2026-08-01', to: '2026-08-31' }, ctx).map((a) => a.id)).toEqual(['2']);
  });

  it('filters by template, "no template" and batch', () => {
    const stamped: Achievement[] = [
      { ...list[0], templateId: 'tp1', templateVersion: 1, batchId: 'b1' },
      { ...list[1], templateId: 'tp2', batchId: 'b1' },
      list[2],
    ];
    const ids = (f: Partial<typeof EMPTY_FILTER>) => filterAchievements(stamped, { ...EMPTY_FILTER, ...f }, ctx).map((a) => a.id);
    expect(ids({ templateIds: ['tp1'] })).toEqual(['1']);
    expect(ids({ templateIds: ['tp1', 'tp2'] })).toEqual(['1', '2']);
    expect(ids({ templateIds: [NO_TEMPLATE] })).toEqual(['3']);
    expect(ids({ templateIds: [NO_TEMPLATE, 'tp2'] })).toEqual(['2', '3']);
    expect(ids({ batchId: 'b1' })).toEqual(['1', '2']);
    expect(ids({ batchId: 'nope' })).toEqual([]);
  });
});

describe('sortAchievements', () => {
  it('sorts by date in both directions', () => {
    expect(sortAchievements(list, { sort: 'date', direction: 'desc' }, ctx).map((a) => a.id)).toEqual(['3', '1', '2', '4']);
    expect(sortAchievements(list, { sort: 'date', direction: 'asc' }, ctx).map((a) => a.id)).toEqual(['4', '2', '1', '3']);
  });

  it('sorts by child name then date desc', () => {
    expect(sortAchievements(list, { sort: 'child', direction: 'asc' }, ctx).map((a) => a.id)).toEqual(['2', '4', '3', '1']);
  });

  it('sorts by primary tag with untagged last', () => {
    expect(sortAchievements(list, { sort: 'tag', direction: 'asc' }, ctx).map((a) => a.id)).toEqual(['1', '3', '2', '4']);
  });
});

describe('groupAchievements', () => {
  it('groups by month in list order', () => {
    const sorted = sortAchievements(list, { sort: 'date', direction: 'desc' }, ctx);
    const sections = groupAchievements(sorted, 'date', ctx);
    expect(sections.map((s) => [s.key, s.items.length])).toEqual([
      ['2026-09', 2],
      ['2026-08', 1],
      ['2026-02', 1],
    ]);
  });

  it('groups by child with the avatar background as colour', () => {
    const sections = groupAchievements(list, 'child', ctx);
    expect(sections.find((s) => s.key === 'b')?.color).toBe('#b5e48c');
    expect(sections.find((s) => s.key === 'b')?.title).toBe('Amir X');
  });

  it('groups by primary tag and collects untagged', () => {
    const sections = groupAchievements(list, 'tag', ctx);
    expect(sections.map((s) => s.title)).toEqual(['Reading', 'Sport', 'Untagged']);
  });

  it('returns a single section for none', () => {
    expect(groupAchievements(list, 'none', ctx)).toHaveLength(1);
    expect(groupAchievements([], 'none', ctx)).toHaveLength(0);
  });
});

describe('query round-trip', () => {
  it('parses and serialises the view, omitting defaults', () => {
    const q = new URLSearchParams('q=goal&child=a,b&tag=t-sport&template=tp1,none&batch=b1&range=custom&from=2026-01-01&group=none&sort=child&dir=asc');
    const view = viewFromQuery(q, DEFAULT_SETTINGS);
    expect(view.filter.childIds).toEqual(['a', 'b']);
    expect(view.filter.templateIds).toEqual(['tp1', 'none']);
    expect(view.filter.batchId).toBe('b1');
    expect(view.filter.range).toBe('custom');
    expect(view.groupBy).toBe('none');
    expect(view.sort).toEqual({ sort: 'child', direction: 'asc' });
    expect(queryFromView(view, DEFAULT_SETTINGS).toString()).toBe(q.toString());
  });

  it('falls back to settings defaults for invalid values', () => {
    const view = viewFromQuery(new URLSearchParams('range=bogus&group=nope'), DEFAULT_SETTINGS);
    expect(view.filter.range).toBe('all');
    expect(view.groupBy).toBe(DEFAULT_SETTINGS.groupBy);
    expect(queryFromView(view, DEFAULT_SETTINGS).toString()).toBe('');
  });
});
