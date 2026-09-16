import { describe, expect, it } from 'vitest';
import { computeStats, monthRange } from '../src/lib/stats';
import type { Achievement, Child, Tag } from '../src/types';

const kid = (id: string, first: string): Child => ({
  id,
  firstName: first,
  lastName: 'Z',
  age: 7,
  avatar: { style: 'lorelei', skin: '', hair: '', hairColor: '', eyes: '', mouth: '', extras: 'none', background: 'ffd166' },
  createdAt: '2026-01-01T00:00:00.000Z',
});

const rec = (id: string, childId: string, date: string, tags: string[] = []): Achievement => ({
  id,
  childId,
  title: id,
  description: '',
  date,
  tags,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const tags: Tag[] = [
  { id: 't-read', name: 'Reading', color: 'blue' },
  { id: 't-sport', name: 'Sport', color: 'green' },
  { id: 't-first', name: 'First', color: 'amber' },
];

const children = [kid('z', 'Zara'), kid('a', 'Abe'), kid('m', 'Mo')];
const now = new Date(2026, 8, 15);

const achievements = [
  rec('1', 'z', '2026-09-10', ['t-read']),
  rec('2', 'z', '2026-09-01', ['t-sport', 't-first']),
  rec('3', 'a', '2026-08-20', ['t-sport']),
  rec('4', 'a', '2026-08-02', ['t-read']),
  rec('5', 'a', '2026-07-15', ['t-read']),
  rec('6', 'm', '2026-03-01', []),
];

describe('computeStats (cohort)', () => {
  it('computes totals, delta and averages for a month range', () => {
    const s = computeStats({ achievements, children, tags, range: { from: '2026-09-01', to: '2026-09-30' }, now });
    expect(s.total).toBe(2);
    expect(s.previousTotal).toBe(2); // Aug 2-31 window holds records 3 and 4
    expect(s.delta).toBe(0);
    expect(s.tagsUsed).toBe(3);
    expect(s.averagePerKid).toBe(0.7);
    expect(s.mostActiveMonth).toEqual({ key: '2026-09', count: 2 });
  });

  it('lists kids alphabetically, never ranked', () => {
    const s = computeStats({ achievements, children, tags, range: null, now });
    expect(s.perKid.map((k) => k.child.firstName)).toEqual(['Abe', 'Mo', 'Zara']);
    expect(s.perKid.map((k) => k.count)).toEqual([3, 1, 2]);
    expect(s.previousTotal).toBeNull();
    expect(s.delta).toBeNull();
  });

  it('spans months from the earliest record for all time', () => {
    const s = computeStats({ achievements, children, tags, range: null, now });
    expect(s.perMonth[0].key).toBe('2026-03');
    expect(s.perMonth[s.perMonth.length - 1].key).toBe('2026-09');
    expect(s.perMonth.find((m) => m.key === '2026-08')?.count).toBe(2);
  });

  it('flags quiet kids with nothing in the last 30 days', () => {
    const s = computeStats({ achievements, children, tags, range: null, now });
    expect(s.quietKids.map((c) => c.firstName)).toEqual(['Mo']);
  });

  it('sorts tags by count with previous-period comparison', () => {
    const s = computeStats({ achievements, children, tags, range: { from: '2026-09-01', to: '2026-09-30' }, now });
    const read = s.perTag.find((t) => t.tag.id === 't-read');
    expect(read?.count).toBe(1);
    expect(read?.previous).toBe(1);
  });
});

describe('computeStats (single child)', () => {
  it('counts a monthly streak back from the current month', () => {
    const s = computeStats({ achievements, children, tags, range: null, childId: 'a', now });
    // Abe: Jul, Aug but not Sep -> streak counted from last month = 2
    expect(s.streak).toBe(2);
    const z = computeStats({ achievements, children, tags, range: null, childId: 'z', now });
    expect(z.streak).toBe(1);
    const m = computeStats({ achievements, children, tags, range: null, childId: 'm', now });
    expect(m.streak).toBe(0);
  });

  it('lists firsts and restricts everything to the child', () => {
    const s = computeStats({ achievements, children, tags, range: null, childId: 'z', now });
    expect(s.total).toBe(2);
    expect(s.firsts.map((a) => a.id)).toEqual(['2']);
    expect(s.perKid).toHaveLength(1);
    expect(s.averagePerKid).toBe(2);
  });
});

describe('monthRange', () => {
  it('covers the whole month', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});
