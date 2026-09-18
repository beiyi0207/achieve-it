import { formatDate } from './dates';

/** `{token}` in a title pattern. Names are letters, digits and underscores. */
const TOKEN_RE = /\{([A-Za-z0-9_]+)\}/g;

export const BUILTIN_TOKENS = ['date', 'child'] as const;

/** Unique token names in order of first appearance. */
export function parseTokens(pattern: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of pattern.matchAll(TOKEN_RE)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

/** Tokens that need an input from the user (everything except {date} and {child}). */
export function customTokens(pattern: string): string[] {
  return parseTokens(pattern).filter((t) => !(BUILTIN_TOKENS as readonly string[]).includes(t));
}

/** "first_word" -> "First word". */
export function tokenLabel(name: string): string {
  const words = name.replace(/_+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Short locale date for {date}, e.g. "Sep 15". */
export function tokenDate(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric' });
}

/** Collapse double spaces and strip stray separators (":", "-", "·") at the ends or doubled up. */
export function tidyTitle(s: string): string {
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/([:\-·])(?:\s*[:\-·])+/g, '$1')
    .replace(/^[\s:\-·]+/, '')
    .replace(/[\s:\-·]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Fill a pattern with values and tidy the result. Missing values resolve to "".
 * Tokens the caller wants to keep literal (for example {child} in a class-mode preview)
 * can be passed through as their own placeholder: `{ child: '{child}' }`.
 */
export function resolveTitle(pattern: string, values: Record<string, string | undefined>): string {
  return tidyTitle(pattern.replace(TOKEN_RE, (_m, name: string) => values[name] ?? ''));
}

/** Does the pattern (or hand-edited title) still contain a token to resolve at save time? */
export function hasTokens(s: string): boolean {
  TOKEN_RE.lastIndex = 0;
  return TOKEN_RE.test(s);
}
