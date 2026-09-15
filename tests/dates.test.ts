import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, inRange, isValidIsoDate, monthsInRange, parseIso, previousRange, rangeFor, todayIso } from '../src/lib/dates';

const now = new Date(2026, 8, 15); // 15 Sep 2026, a Tuesday

describe('dates', () => {
  it('formats today as local ISO', () => {
    expect(todayIso(now)).toBe('2026-09-15');
  });

  it('parses ISO as local midnight', () => {
    const d = parseIso('2026-03-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
  });

  it('validates ISO dates', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-2-3')).toBe(false);
  });

  it('adds days and months across boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('computes week (Monday start), month and year ranges', () => {
    expect(rangeFor('week', { now })).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    expect(rangeFor('month', { now })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeFor('year', { now })).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(rangeFor('all', { now })).toBeNull();
  });

  it('resolves the current term from settings', () => {
    const terms = [
      { name: 'Autumn', start: '2026-09-01', end: '2026-12-18' },
      { name: 'Spring', start: '2027-01-05', end: '2027-03-26' },
    ];
    expect(rangeFor('term', { now, terms })).toEqual({ from: '2026-09-01', to: '2026-12-18' });
    expect(rangeFor('term', { now, terms: [] })).toBeNull();
  });

  it('custom ranges accept open ends', () => {
    expect(rangeFor('custom', { from: '2026-01-01' })).toEqual({ from: '2026-01-01', to: '9999-12-31' });
    expect(rangeFor('custom', {})).toBeNull();
  });

  it('previousRange is the same length immediately before', () => {
    expect(previousRange({ from: '2026-09-01', to: '2026-09-30' })).toEqual({ from: '2026-08-02', to: '2026-08-31' });
    expect(previousRange({ from: '2026-09-14', to: '2026-09-20' })).toEqual({ from: '2026-09-07', to: '2026-09-13' });
  });

  it('inRange treats null as unbounded', () => {
    expect(inRange('2026-05-05', null)).toBe(true);
    expect(inRange('2026-05-05', { from: '2026-05-01', to: '2026-05-31' })).toBe(true);
    expect(inRange('2026-06-01', { from: '2026-05-01', to: '2026-05-31' })).toBe(false);
  });

  it('lists months in a range', () => {
    expect(monthsInRange({ from: '2026-11-15', to: '2027-02-01' })).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
  });
});
