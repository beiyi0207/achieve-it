import { describe, expect, it } from 'vitest';
import { parseSections, sectionBody } from '../src/core/sections';

describe('parseSections', () => {
  it('splits a template-shaped description into sections', () => {
    expect(parseSections('## Book\nMatilda\n\n## Thoughts\nLoved the ending\n- funny')).toEqual([
      { heading: 'Book', level: 2, body: 'Matilda' },
      { heading: 'Thoughts', level: 2, body: 'Loved the ending\n- funny' },
    ]);
  });

  it('keeps a preamble, keeps empty sections and handles nesting levels', () => {
    expect(parseSections('Intro line\n# Day\n## Morning\n## Afternoon\nswam')).toEqual([
      { heading: '', level: 0, body: 'Intro line' },
      { heading: 'Day', level: 1, body: '' },
      { heading: 'Morning', level: 2, body: '' },
      { heading: 'Afternoon', level: 2, body: 'swam' },
    ]);
  });

  it('ignores headings inside fenced code and strips closing hashes', () => {
    expect(parseSections('## Code ##\n```\n# not a heading\n```')).toEqual([{ heading: 'Code', level: 2, body: '```\n# not a heading\n```' }]);
  });

  it('returns nothing for an empty description, and plain text as one preamble', () => {
    expect(parseSections('')).toEqual([]);
    expect(parseSections('just text')).toEqual([{ heading: '', level: 0, body: 'just text' }]);
  });

  it('finds a section body by heading, case-insensitively', () => {
    expect(sectionBody('## Notes\nshared\n## Next\nx', 'notes')).toBe('shared');
    expect(sectionBody('## Notes\nshared', 'Missing')).toBeUndefined();
  });
});
