/** A record description split at its headings. Templates write `##` sections, so this is how a reader gets structure back. */
export type Section = {
  /** Heading text, or "" for text before the first heading. */
  heading: string;
  /** 1–6, or 0 for the preamble. */
  level: number;
  /** Markdown between this heading and the next, trimmed. */
  body: string;
};

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/** Split markdown into sections. Fenced code blocks are left alone. Empty sections are kept so a reader sees the outline. */
export function parseSections(md: string): Section[] {
  const out: Section[] = [];
  let current: Section = { heading: '', level: 0, body: '' };
  const lines: string[] = [];
  let inFence = false;
  const flush = () => {
    current.body = lines.join('\n').trim();
    if (current.level > 0 || current.body) out.push(current);
    lines.length = 0;
  };
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence ? HEADING.exec(line) : null;
    if (m) {
      flush();
      current = { heading: m[2], level: m[1].length, body: '' };
    } else {
      lines.push(line);
    }
  }
  flush();
  return out;
}

/** The body under the first section with this heading (case-insensitive), if any. */
export function sectionBody(md: string, heading: string): string | undefined {
  const h = heading.trim().toLowerCase();
  return parseSections(md).find((s) => s.heading.toLowerCase() === h)?.body;
}
