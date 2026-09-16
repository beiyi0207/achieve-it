import { useMemo, useRef, useState } from 'preact/hooks';
import { applyFormat, renderMarkdown, type FormatKind } from '../lib/markdown';
import { SegmentedControl } from './SegmentedControl';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
};

const TOOLS: { kind: FormatKind; label: string; title: string }[] = [
  { kind: 'h1', label: 'H1', title: 'Heading 1' },
  { kind: 'h2', label: 'H2', title: 'Heading 2' },
  { kind: 'bold', label: 'B', title: 'Bold' },
  { kind: 'italic', label: 'I', title: 'Italic' },
  { kind: 'ul', label: '•', title: 'Bullet list' },
  { kind: 'ol', label: '1.', title: 'Numbered list' },
  { kind: 'link', label: 'Link', title: 'Link' },
];

export function MarkdownEditor({ value, onChange, placeholder, id }: Props) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const ref = useRef<HTMLTextAreaElement>(null);
  const html = useMemo(() => (mode === 'preview' ? renderMarkdown(value) : ''), [mode, value]);

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
            {TOOLS.map((t) => (
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
          <textarea
            id={id}
            ref={ref}
            class="textarea"
            value={value}
            placeholder={placeholder}
            onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
          />
        </>
      ) : html ? (
        <div class="markdown card" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div class="card muted">Nothing to preview yet.</div>
      )}
    </div>
  );
}
