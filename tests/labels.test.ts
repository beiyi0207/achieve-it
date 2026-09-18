import { describe, expect, it } from 'vitest';
import { LABEL_MAX, makeLabels, normaliseLabels } from '../src/core/labels';
import { normaliseSettings } from '../src/core/settings';

describe('labels', () => {
  it('defaults to kid/kids', () => {
    const l = makeLabels(undefined);
    expect(l.one).toBe('kid');
    expect(l.Many).toBe('Kids');
    expect(l.count(1)).toBe('1 kid');
    expect(l.count(3)).toBe('3 kids');
  });

  it('lowercases mid-sentence and capitalises standalone forms', () => {
    const l = makeLabels({ singular: 'Student', plural: 'STUDENTS' });
    expect(l.one).toBe('student');
    expect(l.many).toBe('students');
    expect(l.One).toBe('Student');
    expect(l.Many).toBe('Students');
  });

  it('trims, collapses whitespace, caps length and falls back when empty', () => {
    const n = normaliseLabels({ singular: '  dog  ', plural: 'x'.repeat(40) });
    expect(n.singular).toBe('dog');
    expect(n.plural).toHaveLength(LABEL_MAX);
    expect(normaliseLabels({ singular: '   ', plural: '' })).toEqual({ singular: 'kid', plural: 'kids' });
    expect(normaliseLabels(undefined)).toEqual({ singular: 'kid', plural: 'kids' });
  });

  it('is filled in by normaliseSettings for old backups', () => {
    const s = normaliseSettings({ appearance: 'dark' });
    expect(s.labels).toEqual({ singular: 'kid', plural: 'kids' });
    const t = normaliseSettings({ labels: { singular: 'pet', plural: 'pets' } });
    expect(t.labels).toEqual({ singular: 'pet', plural: 'pets' });
  });
});
