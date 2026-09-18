import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { hintsToPreviewMarkdown } from '../core/templateHints';

marked.use({ gfm: true, breaks: true });

if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * Markdown → sanitised HTML. Always use this; never render raw markdown output.
 * With `hints`, template `[[hints]]` render faded without their brackets.
 */
export function renderMarkdown(md: string, opts: { hints?: boolean } = {}): string {
  if (!md.trim()) return '';
  const source = opts.hints ? hintsToPreviewMarkdown(md) : md;
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'img'] });
}

export type FormatKind = 'h1' | 'h2' | 'bold' | 'italic' | 'ul' | 'ol' | 'link' | 'table' | 'hint';

const TABLE_SKELETON = '| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n|  |  |  |';

export type TextSelection = { text: string; start: number; end: number };

function lineBounds(text: string, start: number, end: number): { from: number; to: number } {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const nl = text.indexOf('\n', end);
  const to = nl === -1 ? text.length : nl;
  return { from, to };
}

/** Apply a toolbar action to a textarea's value and selection. Pure; returns the new state. */
export function applyFormat(sel: TextSelection, kind: FormatKind): TextSelection {
  const { text, start, end } = sel;
  switch (kind) {
    case 'h1':
    case 'h2': {
      const prefix = kind === 'h1' ? '# ' : '## ';
      const { from, to } = lineBounds(text, start, end);
      const lines = text.slice(from, to).split('\n');
      const allHave = lines.every((l) => l.startsWith(prefix));
      const next = lines.map((l) => {
        const stripped = l.replace(/^#{1,6}\s+/, '');
        return allHave ? stripped : prefix + stripped;
      });
      const replaced = next.join('\n');
      return { text: text.slice(0, from) + replaced + text.slice(to), start: from, end: from + replaced.length };
    }
    case 'bold':
    case 'italic': {
      const mark = kind === 'bold' ? '**' : '_';
      const selected = text.slice(start, end) || (kind === 'bold' ? 'bold text' : 'italic text');
      const before = text.slice(start - mark.length, start);
      const after = text.slice(end, end + mark.length);
      if (before === mark && after === mark) {
        // Toggle off.
        return { text: text.slice(0, start - mark.length) + selected + text.slice(end + mark.length), start: start - mark.length, end: end - mark.length };
      }
      const replaced = mark + selected + mark;
      return { text: text.slice(0, start) + replaced + text.slice(end), start: start + mark.length, end: start + mark.length + selected.length };
    }
    case 'ul':
    case 'ol': {
      const { from, to } = lineBounds(text, start, end);
      const lines = text.slice(from, to).split('\n');
      const isUl = (l: string) => /^\s*[-*]\s+/.test(l);
      const isOl = (l: string) => /^\s*\d+\.\s+/.test(l);
      const allHave = kind === 'ul' ? lines.every(isUl) : lines.every(isOl);
      const next = lines.map((l, i) => {
        const stripped = l.replace(/^\s*([-*]|\d+\.)\s+/, '');
        if (allHave) return stripped;
        return kind === 'ul' ? `- ${stripped}` : `${i + 1}. ${stripped}`;
      });
      const replaced = next.join('\n');
      return { text: text.slice(0, from) + replaced + text.slice(to), start: from, end: from + replaced.length };
    }
    case 'link': {
      const label = text.slice(start, end) || 'link text';
      const url = 'https://';
      const replaced = `[${label}](${url})`;
      const urlStart = start + label.length + 3;
      return { text: text.slice(0, start) + replaced + text.slice(end), start: urlStart, end: urlStart + url.length };
    }
    case 'table': {
      // Insert a 3-column skeleton as its own block, with the first header cell selected.
      const before = text.slice(0, start);
      const after = text.slice(end);
      const prefix = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      const suffix = after === '' ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
      const selStart = start + prefix.length + 2;
      return { text: before + prefix + TABLE_SKELETON + suffix + after, start: selStart, end: selStart + 'Column 1'.length };
    }
    case 'hint': {
      const selected = text.slice(start, end) || 'hint';
      const replaced = `[[${selected}]]`;
      return { text: text.slice(0, start) + replaced + text.slice(end), start: start + 2, end: start + 2 + selected.length };
    }
  }
}
