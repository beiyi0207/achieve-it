import { describe, expect, it } from 'vitest';
import { appendNote, findHints, hasRealContent, hintAt, hintsToBackdropHtml, hintsToPreviewMarkdown, removeHints, stripHints } from '../src/core/templateHints';

describe('findHints', () => {
  it('finds hints with their bounds', () => {
    expect(findHints('a [[one]] b [[two]]')).toEqual([
      { start: 2, end: 9, text: 'one' },
      { start: 12, end: 19, text: 'two' },
    ]);
  });

  it('skips escaped and unterminated or multi-line brackets', () => {
    expect(findHints('\\[[literal]] and [[real]]')).toEqual([{ start: 17, end: 25, text: 'real' }]);
    expect(findHints('[[never closed')).toEqual([]);
    expect(findHints('[[no\nnewlines]] [[ok]]')).toEqual([{ start: 16, end: 22, text: 'ok' }]);
  });

  it('hintAt finds the enclosing hint, inclusive of brackets', () => {
    const text = 'x [[hint]] y';
    expect(hintAt(text, 2)?.text).toBe('hint');
    expect(hintAt(text, 5)?.text).toBe('hint');
    expect(hintAt(text, 10)?.text).toBe('hint');
    expect(hintAt(text, 11)).toBeUndefined();
    expect(hintAt(text, 0)).toBeUndefined();
  });
});

describe('stripHints', () => {
  it('rule 1: removes every remaining hint and unescapes literal brackets', () => {
    expect(removeHints('Say [[something]] here')).toBe('Say  here');
    expect(stripHints('Keep \\[[this]] but not [[that]]')).toBe('Keep [[this]] but not');
  });

  it('rule 2: removes list items that are now empty', () => {
    expect(stripHints('## Practiced\n- [[songs]]\n- sang\n1. [[x]]\n2. did\n- [ ] [[todo]]')).toBe('## Practiced\n- sang\n2. did');
  });

  it('rule 3: removes empty table rows, never the header or separator', () => {
    const md = '| Word | Meaning |\n|---|---|\n| [[word]] | |\n| cat | 猫 |\n|  |  |';
    expect(stripHints(md)).toBe('| Word | Meaning |\n|---|---|\n| cat | 猫 |');
  });

  it('rule 3b: a table left with no data rows is removed with its section', () => {
    const md = '## Vocabulary\n| Word | Meaning |\n|---|---|\n| [[word]] | |\n\n## Notes\nreal';
    expect(stripHints(md)).toBe('## Notes\nreal');
  });

  it('rule 4: removes headings whose section is empty, including parents left empty', () => {
    expect(stripHints('## Book\n[[title]]\n\n## Thoughts\nLoved it')).toBe('## Thoughts\nLoved it');
    expect(stripHints('# Day\n## Morning\n[[x]]\n## Afternoon\nswam')).toBe('# Day\n\n## Afternoon\nswam');
    expect(stripHints('# Day\n## Morning\n[[x]]')).toBe('');
    // A heading followed by a lower-level heading with content is not empty.
    expect(stripHints('# A\n## B\ntext')).toBe('# A\n## B\ntext');
  });

  it('rule 5: collapses blank lines and trims the ends', () => {
    expect(stripHints('\n\nfirst\n\n\n\n\nsecond\n\n')).toBe('first\n\nsecond');
  });

  it('leaves a body with only hints empty, which is allowed', () => {
    expect(stripHints('## Skill\n[[what they did]]\n\n## Result\n[[time]]')).toBe('');
  });

  it('keeps partially filled starter bodies tidy', () => {
    const body = '## Vocabulary\n| Word | Pronunciation | Meaning |\n|---|---|---|\n| [[word]] | | |\n\n## Practiced\n- [[songs, games, writing…]]\n\n## Notes\n[[what clicked, what didn\'t]]';
    const filled = body.replace('| [[word]] | | |', '| 红 | hóng | red |').replace("[[what clicked, what didn't]]", 'Colours clicked.');
    expect(stripHints(filled)).toBe('## Vocabulary\n| Word | Pronunciation | Meaning |\n|---|---|---|\n| 红 | hóng | red |\n\n## Notes\nColours clicked.');
  });
});

describe('hasRealContent', () => {
  it('treats skeleton-only bodies as empty', () => {
    expect(hasRealContent('## Notes\n[[hint]]\n\n- [[x]]')).toBe(false);
    expect(hasRealContent('## Notes\nwrote this')).toBe(true);
    expect(hasRealContent('')).toBe(false);
  });
});

describe('rendering helpers', () => {
  it('preview swaps hints for faded spans with a screen-reader prefix', () => {
    expect(hintsToPreviewMarkdown('a [[b <c>]] d')).toBe('a <span class="md-hint"><span class="visually-hidden">Hint: </span>b &lt;c&gt;</span> d');
  });

  it('backdrop keeps the raw text, escaped, with hints marked', () => {
    expect(hintsToBackdropHtml('<x> [[y]]')).toBe('&lt;x&gt; <mark class="md-hint-mark">[[y]]</mark>');
  });
});

describe('appendNote', () => {
  it('adds a Notes section at the end when there is none', () => {
    expect(appendNote('## Skill\njumped', 'Great effort')).toBe('## Skill\njumped\n\n## Notes\nGreat effort');
    expect(appendNote('', 'Solo note')).toBe('## Notes\nSolo note');
    expect(appendNote('text', '   ')).toBe('text');
  });

  it('appends under an existing Notes heading and keeps later sections', () => {
    expect(appendNote('## Notes\nshared\n\n## Next\nmore', 'per kid')).toBe('## Notes\nshared\nper kid\n\n## Next\nmore');
    expect(appendNote('## Notes\n', 'only')).toBe('## Notes\nonly');
    expect(appendNote('## notes\n[[hint]]', 'x')).toBe('## notes\nx');
  });
});
