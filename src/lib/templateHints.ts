/**
 * Template hints: `[[text]]` marks placeholder guidance inside a markdown body.
 * A literal "[[" is written "\[[". Hints are never saved; see `stripHints`.
 */

/** A hint occurrence. `start`/`end` cover the brackets; `text` is what is inside them. */
export type HintSpan = { start: number; end: number; text: string };

/** Every unescaped, single-line `[[hint]]` in the text, in document order. */
export function findHints(text: string): HintSpan[] {
  const out: HintSpan[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('[[', i);
    if (open === -1) break;
    if (open > 0 && text[open - 1] === '\\') {
      i = open + 2;
      continue;
    }
    const close = text.indexOf(']]', open + 2);
    if (close === -1) break;
    const inner = text.slice(open + 2, close);
    if (inner.includes('\n')) {
      i = open + 2;
      continue;
    }
    out.push({ start: open, end: close + 2, text: inner });
    i = close + 2;
  }
  return out;
}

/** The hint that contains `pos` (inclusive of its brackets), if any. Used for tap-to-select. */
export function hintAt(text: string, pos: number): HintSpan | undefined {
  return findHints(text).find((h) => h.start <= pos && pos <= h.end);
}

/** Remove every `[[hint]]`, leaving escaped ones alone. */
export function removeHints(text: string): string {
  const spans = findHints(text);
  let out = text;
  for (let i = spans.length - 1; i >= 0; i--) out = out.slice(0, spans[i].start) + out.slice(spans[i].end);
  return out;
}

/** Turn the `\[[` escape back into a literal `[[`. */
export function unescapeHints(text: string): string {
  return text.replace(/\\\[\[/g, '[[');
}

const EMPTY_LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s*(?:\[[ xX]\]\s*)?$/;
const HEADING = /^(#{1,6})\s+\S/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

const isBlank = (line: string) => line.trim() === '';
const isPipeRow = (line: string) => !isBlank(line) && line.includes('|');

function removeEmptyListItems(lines: string[]): string[] {
  return lines.filter((l) => !EMPTY_LIST_ITEM.test(l));
}

function cellsOf(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * Drop table rows whose cells are all empty. The header and separator rows are kept
 * unless nothing is left below them, in which case the whole table goes: a table with
 * no data rows is no content.
 */
function removeEmptyTableRows(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    if (isPipeRow(line) && next !== undefined && TABLE_SEPARATOR.test(next) && next.includes('|')) {
      const header = line;
      const sep = next;
      const rows: string[] = [];
      let j = i + 2;
      while (j < lines.length && isPipeRow(lines[j])) {
        if (cellsOf(lines[j]).some((c) => c !== '')) rows.push(lines[j]);
        j++;
      }
      if (rows.length) out.push(header, sep, ...rows);
      i = j;
      continue;
    }
    out.push(line);
    i++;
  }
  return out;
}

/**
 * Remove a heading whose section is empty: no non-blank line before the next heading
 * of the same or a higher level, or the end of the document. Runs bottom-up so a
 * parent whose only child section was just removed is removed too.
 */
function removeEmptySections(lines: string[]): string[] {
  const out = [...lines];
  for (let i = out.length - 1; i >= 0; i--) {
    const m = HEADING.exec(out[i]);
    if (!m) continue;
    const level = m[1].length;
    let empty = true;
    for (let j = i + 1; j < out.length; j++) {
      const h = HEADING.exec(out[j]);
      if (h && h[1].length <= level) break;
      if (!isBlank(out[j])) {
        empty = false;
        break;
      }
    }
    if (empty) out.splice(i, 1);
  }
  return out;
}

/** Collapse runs of blank lines to a single blank line and trim blank lines at both ends. */
export function collapseBlankLines(text: string): string {
  return text
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/**
 * The save-time clean-up for a description that came from a template:
 * 1. remove every remaining `[[hint]]`,
 * 2. remove list items that are now empty,
 * 3. remove table rows whose cells are all empty (and tables left with no rows),
 * 4. remove headings whose section is now empty,
 * 5. collapse blank lines,
 * then turn `\[[` back into a literal `[[`.
 */
export function stripHints(md: string): string {
  let lines = removeHints(md).split('\n');
  lines = removeEmptyListItems(lines);
  lines = removeEmptyTableRows(lines);
  lines = removeEmptySections(lines);
  return unescapeHints(collapseBlankLines(lines.join('\n')));
}

/** True if the description holds anything other than template skeleton (hints, empty sections, empty rows). */
export function hasRealContent(md: string): boolean {
  return stripHints(md).trim() !== '';
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * For preview: swap each hint for a faded span (no brackets), announced as "Hint: …".
 * The result is still markdown; feed it to `renderMarkdown`, which sanitises the output.
 */
export function hintsToPreviewMarkdown(md: string): string {
  const spans = findHints(md);
  let out = '';
  let pos = 0;
  for (const h of spans) {
    out += md.slice(pos, h.start);
    out += `<span class="md-hint"><span class="visually-hidden">Hint: </span>${escapeHtml(h.text)}</span>`;
    pos = h.end;
  }
  return out + md.slice(pos);
}

/**
 * For the Write mode backdrop: the raw text, HTML-escaped, with hints wrapped so they
 * can be styled muted. Character count is preserved so it lines up under the textarea.
 */
export function hintsToBackdropHtml(text: string): string {
  const spans = findHints(text);
  let out = '';
  let pos = 0;
  for (const h of spans) {
    out += escapeHtml(text.slice(pos, h.start));
    out += `<mark class="md-hint-mark">${escapeHtml(text.slice(h.start, h.end))}</mark>`;
    pos = h.end;
  }
  return out + escapeHtml(text.slice(pos));
}

/**
 * Add a per-kid note (class mode). Appended under an existing "## Notes" heading,
 * replacing its hint if the section is otherwise untouched; otherwise a new
 * "## Notes" section goes at the end. Call after `stripHints`.
 */
export function appendNote(description: string, note: string): string {
  const clean = note.trim();
  if (!clean) return description;
  const lines = description.split('\n');
  const idx = lines.findIndex((l) => /^##\s+notes\s*$/i.test(l));
  if (idx === -1) {
    const base = description.trim();
    return base ? `${base}\n\n## Notes\n${clean}` : `## Notes\n${clean}`;
  }
  let end = idx + 1;
  while (end < lines.length && !HEADING.test(lines[end])) end++;
  const section = lines.slice(idx + 1, end);
  const body = removeHints(section.join('\n')).trim();
  const nextSection = body ? `${body}\n${clean}` : clean;
  const rebuilt = [...lines.slice(0, idx + 1), nextSection, ...(end < lines.length ? ['', ...lines.slice(end)] : [])];
  return collapseBlankLines(rebuilt.join('\n'));
}
