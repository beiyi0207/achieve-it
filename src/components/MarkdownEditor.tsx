import { useMemo, useRef, useState } from 'preact/hooks';
import { applyFormat, renderMarkdown, type FormatKind } from '../lib/markdown';
import { hintAt, hintsToBackdropHtml } from '../core/templateHints';
import { SegmentedControl } from './SegmentedControl';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  /** Render template `[[hints]]` muted in Write mode (tap selects them) and faded in Preview. */
  hints?: boolean;
  /** Show the Hint toolbar button (template editor only). */
  hintTool?: boolean;
};

const TOOLS: { kind: FormatKind; label: string; title: string }[] = [
  { kind: 'h1', label: 'H1', title: 'Heading 1' },
  { kind: 'h2', label: 'H2', title: 'Heading 2' },
  { kind: 'bold', label: 'B', title: 'Bold' },
  { kind: 'italic', label: 'I', title: 'Italic' },
  { kind: 'ul', label: '•', title: 'Bullet list' },
  { kind: 'ol', label: '1.', title: 'Numbered list' },
  { kind: 'link', label: 'Link', title: 'Link' },
  { kind: 'table', label: 'Table', title: 'Table' },
];

const HINT_TOOL = { kind: 'hint' as FormatKind, label: '[[ ]]', title: 'Hint' };

export function MarkdownEditor({ value, onChange, placeholder, id, hints = false, hintTool = false }: Props) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const ref = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => (mode === 'preview' ? renderMarkdown(value, { hints }) : ''), [mode, value, hints]);
  // The backdrop is in normal flow and sizes the editor, so the textarea never has to be
  // measured or resized (which would collapse it for a moment and jump the page scroll).
  // The trailing space keeps a final empty line the same height as in the textarea.
  const backdrop = useMemo(() => (hints && mode === 'write' ? hintsToBackdropHtml(value) + ' ' : ''), [hints, mode, value]);
  const tools = hintTool ? [...TOOLS, HINT_TOOL] : TOOLS;

  function format(kind: FormatKind) {
    const ta = ref.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const next = applyFormat({ text: value, start, end }, kind);
    onChange(next.text);
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(next.start, next.end);
    });
  }

  /** Tapping inside a [[hint]] selects the whole thing so typing replaces it. */
  function selectHintAtCaret() {
    const ta = ref.current;
    if (!hints || !ta || ta.selectionStart !== ta.selectionEnd) return;
    const h = hintAt(value, ta.selectionStart);
    if (h) ta.setSelectionRange(h.start, h.end);
  }

  const textarea = (
    <textarea
      id={id}
      ref={ref}
      class={`textarea ${hints ? 'textarea--hints' : ''}`}
      value={value}
      placeholder={placeholder}
      onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      onClick={selectHintAtCaret}
    />
  );

  return (
    <div class="md-editor">
      <SegmentedControl
        value={mode}
        onChange={(m) => setMode(m)}
        options={[
          { value: 'write', label: 'Write' },
          { value: 'preview', label: 'Preview' },
        ]}
        label="Editor mode"
      />
      {mode === 'write' ? (
        <>
          <div class="md-toolbar" role="toolbar" aria-label="Formatting">
            {tools.map((t) => (
              <button
                key={t.kind}
                type="button"
                title={t.title}
                aria-label={t.title}
                class={`md-tool md-tool--${t.kind}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => format(t.kind)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {hints ? (
            <div class="md-write">
              <div class="md-backdrop" aria-hidden="true" dangerouslySetInnerHTML={{ __html: backdrop }} />
              {textarea}
            </div>
          ) : (
            textarea
          )}
        </>
      ) : html ? (
        <div class="markdown card" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div class="card muted">Nothing to preview yet.</div>
      )}
    </div>
  );
}
