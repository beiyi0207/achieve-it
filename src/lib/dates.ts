import type { TermDate } from '../types';

/** Inclusive ISO date range. */
export type DateRange = { from: string; to: string };
export type RangePreset = 'week' | 'month' | 'term' | 'year' | 'all' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Parse YYYY-MM-DD as local midnight (Date.parse would treat it as UTC). */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseIso(iso);
  return toIsoDate(d) === iso;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: style, year: 'numeric' });
}

export function monthShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return parseIso(iso).toLocaleDateString(undefined, opts);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIso(fromIso).getTime();
  const b = parseIso(toIso).getTime();
  return Math.round((b - a) / 86400000);
}

/** Whole days since an ISO date-time (or date) string. */
export function daysSince(isoDateTime: string, now: Date = new Date()): number {
  const then = new Date(isoDateTime).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((now.getTime() - then) / 86400000);
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function termContaining(terms: TermDate[] | undefined, iso: string): TermDate | undefined {
  return terms?.find((t) => t.start && t.end && t.start <= iso && iso <= t.end);
}

export function rangeFor(
  preset: RangePreset,
  opts: { now?: Date; terms?: TermDate[]; from?: string; to?: string } = {},
): DateRange | null {
  const now = opts.now ?? new Date();
  const today = toIsoDate(now);
  switch (preset) {
    case 'week': {
      // Monday-start week.
      const dow = (now.getDay() + 6) % 7;
      const from = addDays(today, -dow);
      return { from, to: addDays(from, 6) };
    }
    case 'month': {
      const from = `${today.slice(0, 7)}-01`;
      const next = addMonths(today.slice(0, 7), 1);
      return { from, to: addDays(`${next}-01`, -1) };
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'term': {
      const t = termContaining(opts.terms, today);
      return t ? { from: t.start, to: t.end } : null;
    }
    case 'custom':
      if (!opts.from && !opts.to) return null;
      return { from: opts.from || '0000-01-01', to: opts.to || '9999-12-31' };
    case 'all':
    default:
      return null;
  }
}

/** The range of the same length immediately before `range`. */
export function previousRange(range: DateRange): DateRange {
  const len = daysBetween(range.from, range.to) + 1;
  const to = addDays(range.from, -1);
  return { from: addDays(to, -(len - 1)), to };
}

export function inRange(iso: string, range: DateRange | null): boolean {
  if (!range) return true;
  return range.from <= iso && iso <= range.to;
}

/** All month keys from range.from to range.to inclusive. */
export function monthsInRange(range: DateRange): string[] {
  const out: string[] = [];
  let k = monthKey(range.from);
  const end = monthKey(range.to);
  while (k <= end) {
    out.push(k);
    k = addMonths(k, 1);
  }
  return out;
}

export function isoNow(): string {
  return new Date().toISOString();
}
