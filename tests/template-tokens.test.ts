import { describe, expect, it } from 'vitest';
import { customTokens, hasTokens, parseTokens, resolveTitle, tidyTitle, tokenDate, tokenLabel } from '../src/lib/templateTokens';

describe('parseTokens', () => {
  it('lists unique tokens in order of first appearance', () => {
    expect(parseTokens('{language}: {topic} ({date}) {language}')).toEqual(['language', 'topic', 'date']);
    expect(customTokens('{child} read {book} on {date}')).toEqual(['book']);
    expect(parseTokens('no tokens {bad token} {}')).toEqual([]);
  });

  it('labels tokens in sentence case', () => {
    expect(tokenLabel('topic')).toBe('Topic');
    expect(tokenLabel('piece_name')).toBe('Piece name');
  });

  it('detects tokens', () => {
    expect(hasTokens('Chinese: {topic}')).toBe(true);
    expect(hasTokens('Chinese: Colors')).toBe(false);
    expect(hasTokens('{a}')).toBe(true); // regex state must reset between calls
    expect(hasTokens('{a}')).toBe(true);
  });
});

describe('resolveTitle', () => {
  it('fills tokens and tidies separators', () => {
    expect(resolveTitle('Chinese: {topic}', { topic: 'Colors' })).toBe('Chinese: Colors');
    expect(resolveTitle('Chinese: {topic}', {})).toBe('Chinese');
    expect(resolveTitle('{language}: {topic}', { topic: 'Colors' })).toBe('Colors');
    expect(resolveTitle('{language}: {topic}', {})).toBe('');
    expect(resolveTitle('{a} - {b} - {c}', { a: 'x', c: 'z' })).toBe('x - z');
    expect(resolveTitle('Read {book}', { book: '  Matilda  ' })).toBe('Read Matilda');
  });

  it('keeps tokens passed through literally', () => {
    expect(resolveTitle('{child} · {skill}', { child: '{child}', skill: 'Cartwheel' })).toBe('{child} · Cartwheel');
  });

  it('tidyTitle leaves normal hyphens alone', () => {
    expect(tidyTitle('Well-known  words ')).toBe('Well-known words');
  });

  it('formats the date token short', () => {
    expect(tokenDate('2026-09-15')).toMatch(/Sep/);
    expect(tokenDate('2026-09-15')).toMatch(/15/);
  });
});
