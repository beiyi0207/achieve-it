import type { Achievement, Child, Tag } from '../types';
import { addDays, addMonths, inRange, monthKey, monthsInRange, previousRange, todayIso, type DateRange } from './dates';

export type StatsInput = {
  achievements: Achievement[];
  children: Child[];
  tags: Tag[];
  /** null = all time */
  range: DateRange | null;
  /** Restrict to one child (single-child mode). */
  childId?: string;
  now?: Date;
};

export type MonthCount = { key: string; count: number };
export type TagCount = { tag: Tag; count: number; previous: number };
export type KidCount = { child: Child; count: number };

export type Stats = {
  total: number;
  /** null when there is no previous period (all time). */
  previousTotal: number | null;
  delta: number | null;
  tagsUsed: number;
  mostActiveMonth: MonthCount | null;
  averagePerKid: number;
  perMonth: MonthCount[];
  perTag: TagCount[];
  /** Alphabetical by first name, never ranked. */
  perKid: KidCount[];
  /** Kids with no record in the last 30 days (cohort mode). */
  quietKids: Child[];
  /** Consecutive months with at least one record, ending this month or last month. */
  streak: number;
  firsts: Achievement[];
};

const byDateDesc = (a: Achievement, b: Achievement) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export function isFirstTag(t: Tag): boolean {
  return t.name.trim().toLowerCase() === 'first';
}

export function computeStats(input: StatsInput): Stats {
  const now = input.now ?? new Date();
  const today = todayIso(now);
  const children = input.childId ? input.children.filter((c) => c.id === input.childId) : input.children;
  const scoped = input.childId ? input.achievements.filter((a) => a.childId === input.childId) : input.achievements;
  const inCurrent = scoped.filter((a) => inRange(a.date, input.range));
  const prevRange = input.range ? previousRange(input.range) : null;
  const inPrevious = prevRange ? scoped.filter((a) => inRange(a.date, prevRange)) : [];

  const total = inCurrent.length;
  const previousTotal = prevRange ? inPrevious.length : null;
  const delta = previousTotal === null ? null : total - previousTotal;

  // Per month across the range (or from the earliest record for all time).
  let months: string[];
  if (input.range) {
    months = monthsInRange(input.range);
  } else {
    const earliest = scoped.reduce<string | null>((min, a) => (min === null || a.date < min ? a.date : min), null);
    months = earliest ? monthsInRange({ from: earliest, to: today }) : [monthKey(today)];
  }
  const monthCounts = new Map<string, number>(months.map((m) => [m, 0]));
  for (const a of inCurrent) {
    const k = monthKey(a.date);
    monthCounts.set(k, (monthCounts.get(k) ?? 0) + 1);
  }
  const perMonth: MonthCount[] = months.map((key) => ({ key, count: monthCounts.get(key) ?? 0 }));
  const mostActiveMonth = perMonth.reduce<MonthCount | null>((best, m) => (m.count > 0 && (!best || m.count > best.count) ? m : best), null);

  // Per tag with previous-period comparison.
  const tagMap = new Map(input.tags.map((t) => [t.id, t]));
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  for (const a of inCurrent) for (const t of a.tags) if (tagMap.has(t)) cur.set(t, (cur.get(t) ?? 0) + 1);
  for (const a of inPrevious) for (const t of a.tags) if (tagMap.has(t)) prev.set(t, (prev.get(t) ?? 0) + 1);
  const tagIds = new Set([...cur.keys(), ...prev.keys()]);
  const perTag: TagCount[] = [...tagIds]
    .map((id) => ({ tag: tagMap.get(id)!, count: cur.get(id) ?? 0, previous: prev.get(id) ?? 0 }))
    .filter((t) => t.count > 0 || t.previous > 0)
    .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name));

  // Per kid, alphabetical.
  const kidCounts = new Map<string, number>();
  for (const a of inCurrent) kidCounts.set(a.childId, (kidCounts.get(a.childId) ?? 0) + 1);
  const perKid: KidCount[] = [...children]
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
    .map((child) => ({ child, count: kidCounts.get(child.id) ?? 0 }));

  const averagePerKid = children.length ? Math.round((total / children.length) * 10) / 10 : 0;

  // Quiet kids: nothing in the last 30 days, regardless of range.
  const cutoff = addDays(today, -30);
  const recent = new Set(scoped.filter((a) => a.date >= cutoff && a.date <= today).map((a) => a.childId));
  const quietKids = children.filter((c) => !recent.has(c.id));

  // Streak: consecutive months with a record, counting back from this month
  // (or from last month if this month is still empty).
  const monthsWithRecords = new Set(scoped.map((a) => monthKey(a.date)));
  let cursor = monthKey(today);
  if (!monthsWithRecords.has(cursor)) cursor = addMonths(cursor, -1);
  let streak = 0;
  while (monthsWithRecords.has(cursor)) {
    streak++;
    cursor = addMonths(cursor, -1);
  }

  const firstTagIds = new Set(input.tags.filter(isFirstTag).map((t) => t.id));
  const firsts = inCurrent.filter((a) => a.tags.some((t) => firstTagIds.has(t))).sort(byDateDesc);

  return { total, previousTotal, delta, tagsUsed: cur.size, mostActiveMonth, averagePerKid, perMonth, perTag, perKid, quietKids, streak, firsts };
}

/** Inclusive date range covering one month key. */
export function monthRange(key: string): DateRange {
  const next = addMonths(key, 1);
  return { from: `${key}-01`, to: addDays(`${next}-01`, -1) };
}
