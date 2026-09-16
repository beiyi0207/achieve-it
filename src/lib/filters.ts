import type { Achievement, Child, GroupBy, Settings, SortDirection, SortKey, Tag, TermDate } from '../types';
import { inRange, monthKey, monthLabel, rangeFor, type DateRange, type RangePreset } from './dates';
import { cssHex, tagHex } from './palette';

export type RecordFilter = {
  q: string;
  childIds: string[];
  tagIds: string[];
  range: RangePreset;
  from?: string;
  to?: string;
};

export type RecordSort = { sort: SortKey; direction: SortDirection };

export type RecordView = { filter: RecordFilter; sort: RecordSort; groupBy: GroupBy };

export type FilterContext = {
  children: Map<string, Child>;
  tags: Map<string, Tag>;
  terms?: TermDate[];
  now?: Date;
};

export const EMPTY_FILTER: RecordFilter = { q: '', childIds: [], tagIds: [], range: 'all' };

export function isFilterActive(f: RecordFilter): boolean {
  return f.q.trim() !== '' || f.childIds.length > 0 || f.tagIds.length > 0 || f.range !== 'all';
}

export function resolveRange(f: RecordFilter, ctx: Pick<FilterContext, 'terms' | 'now'>): DateRange | null {
  return rangeFor(f.range, { now: ctx.now, terms: ctx.terms, from: f.from, to: f.to });
}

export function filterAchievements(list: Achievement[], f: RecordFilter, ctx: FilterContext): Achievement[] {
  const q = f.q.trim().toLowerCase();
  const range = resolveRange(f, ctx);
  const kids = f.childIds.length ? new Set(f.childIds) : null;
  const tags = f.tagIds.length ? new Set(f.tagIds) : null;
  return list.filter((a) => {
    if (kids && !kids.has(a.childId)) return false;
    if (tags && !a.tags.some((t) => tags.has(t))) return false;
    if (!inRange(a.date, range)) return false;
    if (q && !a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
    return true;
  });
}

function childLabel(a: Achievement, ctx: FilterContext): string {
  const c = ctx.children.get(a.childId);
  return c ? `${c.firstName} ${c.lastName}`.trim() : '￿'; // unknown kids sort last
}

function primaryTag(a: Achievement, ctx: FilterContext): Tag | undefined {
  for (const id of a.tags) {
    const t = ctx.tags.get(id);
    if (t) return t;
  }
  return undefined;
}

export function sortAchievements(list: Achievement[], s: RecordSort, ctx: FilterContext): Achievement[] {
  const dir = s.direction === 'asc' ? 1 : -1;
  const byDateDesc = (a: Achievement, b: Achievement) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt));
  const out = [...list];
  out.sort((a, b) => {
    let primary = 0;
    if (s.sort === 'date') {
      primary = a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt.localeCompare(b.createdAt);
    } else if (s.sort === 'child') {
      primary = childLabel(a, ctx).localeCompare(childLabel(b, ctx));
    } else {
      const ta = primaryTag(a, ctx)?.name ?? '￿';
      const tb = primaryTag(b, ctx)?.name ?? '￿';
      primary = ta.localeCompare(tb);
    }
    if (primary !== 0) return primary * dir;
    return s.sort === 'date' ? 0 : byDateDesc(a, b);
  });
  return out;
}

export type Section = {
  key: string;
  title: string;
  /** CSS color for the header accent. */
  color: string;
  items: Achievement[];
  /** Deep link that re-filters Records to this group, when meaningful. */
  href?: string;
};

/** Group an already-sorted list; section order follows first appearance so it respects the sort. */
export function groupAchievements(list: Achievement[], groupBy: GroupBy, ctx: FilterContext): Section[] {
  if (groupBy === 'none') {
    return list.length ? [{ key: 'all', title: 'All records', color: 'var(--accent)', items: list }] : [];
  }
  const sections = new Map<string, Section>();
  for (const a of list) {
    let key: string;
    let title: string;
    let color: string;
    let href: string | undefined;
    if (groupBy === 'date') {
      key = monthKey(a.date);
      title = monthLabel(key);
      color = 'var(--accent)';
    } else if (groupBy === 'child') {
      const c = ctx.children.get(a.childId);
      key = a.childId;
      title = c ? `${c.firstName} ${c.lastName}`.trim() : 'Unknown child';
      color = c ? cssHex(c.avatar.background) : 'var(--text-3)';
      href = c ? `#/kids/${c.id}` : undefined;
    } else {
      const t = primaryTag(a, ctx);
      key = t ? t.id : '__untagged';
      title = t ? t.name : 'Untagged';
      color = t ? tagHex(t.color) : 'var(--text-3)';
    }
    let s = sections.get(key);
    if (!s) {
      s = { key, title, color, items: [], href };
      sections.set(key, s);
    }
    s.items.push(a);
  }
  return [...sections.values()];
}

/* ---------- URL (hash query) serialisation ---------- */

const RANGES: RangePreset[] = ['week', 'month', 'term', 'year', 'all', 'custom'];
const GROUPS: GroupBy[] = ['date', 'child', 'tag', 'none'];
const SORTS: SortKey[] = ['date', 'child', 'tag'];

export function viewFromQuery(q: URLSearchParams, settings: Settings): RecordView {
  const list = (k: string) => (q.get(k) ?? '').split(',').filter(Boolean);
  const range = q.get('range') as RangePreset | null;
  const group = q.get('group') as GroupBy | null;
  const sort = q.get('sort') as SortKey | null;
  const dir = q.get('dir') as SortDirection | null;
  return {
    filter: {
      q: q.get('q') ?? '',
      childIds: list('child'),
      tagIds: list('tag'),
      range: range && RANGES.includes(range) ? range : 'all',
      from: q.get('from') ?? undefined,
      to: q.get('to') ?? undefined,
    },
    sort: {
      sort: sort && SORTS.includes(sort) ? sort : settings.defaultRecordView.sort,
      direction: dir === 'asc' || dir === 'desc' ? dir : settings.defaultRecordView.direction,
    },
    groupBy: group && GROUPS.includes(group) ? group : settings.groupBy,
  };
}

export function queryFromView(v: RecordView, settings: Settings): URLSearchParams {
  const q = new URLSearchParams();
  if (v.filter.q.trim()) q.set('q', v.filter.q.trim());
  if (v.filter.childIds.length) q.set('child', v.filter.childIds.join(','));
  if (v.filter.tagIds.length) q.set('tag', v.filter.tagIds.join(','));
  if (v.filter.range !== 'all') q.set('range', v.filter.range);
  if (v.filter.range === 'custom') {
    if (v.filter.from) q.set('from', v.filter.from);
    if (v.filter.to) q.set('to', v.filter.to);
  }
  if (v.groupBy !== settings.groupBy) q.set('group', v.groupBy);
  if (v.sort.sort !== settings.defaultRecordView.sort) q.set('sort', v.sort.sort);
  if (v.sort.direction !== settings.defaultRecordView.direction) q.set('dir', v.sort.direction);
  return q;
}

export function recordsHref(partial: Partial<RecordFilter> & { group?: GroupBy }): string {
  const q = new URLSearchParams();
  if (partial.q) q.set('q', partial.q);
  if (partial.childIds?.length) q.set('child', partial.childIds.join(','));
  if (partial.tagIds?.length) q.set('tag', partial.tagIds.join(','));
  if (partial.range && partial.range !== 'all') q.set('range', partial.range);
  if (partial.from) q.set('from', partial.from);
  if (partial.to) q.set('to', partial.to);
  if (partial.group) q.set('group', partial.group);
  const s = q.toString();
  return `#/records${s ? `?${s}` : ''}`;
}
