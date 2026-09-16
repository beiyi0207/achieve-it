// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyFormat, renderMarkdown } from '../src/lib/markdown';

describe('renderMarkdown', () => {
  it('renders headings, lists and links', () => {
    const html = renderMarkdown('# Title\n\n- one\n- two\n\n[site](https://example.com)');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('strips scripts and event handlers', () => {
    const html = renderMarkdown('<script>alert(1)</script><a href="javascript:alert(1)" onclick="x()">x</a>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
  });

  it('returns empty for blank input', () => {
    expect(renderMarkdown('   ')).toBe('');
  });
});

describe('applyFormat', () => {
  it('toggles headings on the current line', () => {
    const r = applyFormat({ text: 'hello\nworld', start: 7, end: 7 }, 'h1');
    expect(r.text).toBe('hello\n# world');
    const back = applyFormat(r, 'h1');
    expect(back.text).toBe('hello\nworld');
  });

  it('wraps a selection in bold and toggles it off', () => {
    const r = applyFormat({ text: 'make this bold', start: 5, end: 9 }, 'bold');
    expect(r.text).toBe('make **this** bold');
    expect(r.text.slice(r.start, r.end)).toBe('this');
    const off = applyFormat(r, 'bold');
    expect(off.text).toBe('make this bold');
  });

  it('adds list markers to each selected line', () => {
    const r = applyFormat({ text: 'a\nb\nc', start: 0, end: 5 }, 'ol');
    expect(r.text).toBe('1. a\n2. b\n3. c');
    const ul = applyFormat({ text: 'a\nb', start: 0, end: 3 }, 'ul');
    expect(ul.text).toBe('- a\n- b');
  });

  it('inserts a link with the url selected', () => {
    const r = applyFormat({ text: 'see docs', start: 4, end: 8 }, 'link');
    expect(r.text).toBe('see [docs](https://)');
    expect(r.text.slice(r.start, r.end)).toBe('https://');
  });
});
