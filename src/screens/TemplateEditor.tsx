import { useRef, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { ConfirmDialog, Dialog } from '../components/Dialog';
import { TagInput } from '../components/TagInput';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { DEFAULT_TEMPLATE_ICON, TEMPLATE_ICONS, TemplateIcon, TemplateTile, templateIconLabel } from '../components/TemplateIcons';
import { IconCopy } from '../components/Icons';
import { addTemplate, duplicateTemplate, findTemplateByName, removeTemplate, templateById, templates, toast, updateTemplate } from '../store';
import { navigate } from '../router';
import { TAG_PALETTE, nextTagColor } from '../lib/palette';
import { customTokens } from '../lib/templateTokens';

type Props = { templateId?: string };

const QUICK_TOKENS = ['topic', 'date', 'child'];

export function TemplateEditorScreen({ templateId }: Props) {
  const existing = templateId ? templateById.value.get(templateId) : undefined;
  const isEdit = !!templateId;

  const initial = useRef({
    name: existing?.name ?? '',
    icon: existing?.icon ?? DEFAULT_TEMPLATE_ICON,
    color: existing?.color ?? nextTagColor(templates.value.map((t) => t.color)),
    tagIds: existing?.tagIds ?? [],
    suggestOnTag: existing?.suggestOnTag ?? true,
    titlePattern: existing?.titlePattern ?? '',
    body: existing?.body ?? '',
  });
  const [name, setName] = useState(initial.current.name);
  const [icon, setIcon] = useState(initial.current.icon);
  const [color, setColor] = useState(initial.current.color);
  const [tagIds, setTagIds] = useState<string[]>(initial.current.tagIds);
  const [suggestOnTag, setSuggestOnTag] = useState(initial.current.suggestOnTag);
  const [titlePattern, setTitlePattern] = useState(initial.current.titlePattern);
  const [body, setBody] = useState(initial.current.body);
  const [error, setError] = useState('');
  const [iconOpen, setIconOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const patternRef = useRef<HTMLInputElement>(null);

  if (isEdit && !existing) {
    return (
      <>
        <Header variant="centered" title="Edit template" left={<a class="text-btn" href="#/settings/templates">Back</a>} />
        <div class="container">
          <p class="muted">This template no longer exists.</p>
        </div>
      </>
    );
  }

  const i = initial.current;
  const dirty =
    name !== i.name ||
    icon !== i.icon ||
    color !== i.color ||
    suggestOnTag !== i.suggestOnTag ||
    titlePattern !== i.titlePattern ||
    body !== i.body ||
    tagIds.join(',') !== i.tagIds.join(',');

  function leave() {
    navigate('/settings/templates', { replace: true });
  }

  function cancel() {
    if (dirty) setConfirmDiscard(true);
    else leave();
  }

  async function save() {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the template a name.');
      return;
    }
    const clash = findTemplateByName(trimmed);
    if (clash && clash.id !== existing?.id) {
      setError(`“${clash.name}” already exists.`);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const input = { name: trimmed, icon, color, tagIds, suggestOnTag, titlePattern: titlePattern.trim(), body };
      if (existing) {
        await updateTemplate({ ...existing, ...input });
        toast('Template updated');
      } else {
        await addTemplate(input);
        toast('Template created');
      }
      leave();
    } finally {
      setSaving(false);
    }
  }

  function insertToken(token: string) {
    const el = patternRef.current;
    const start = el?.selectionStart ?? titlePattern.length;
    const end = el?.selectionEnd ?? titlePattern.length;
    const before = titlePattern.slice(0, start);
    const after = titlePattern.slice(end);
    const gap = before && !/\s$/.test(before) ? ' ' : '';
    const next = `${before}${gap}{${token}}${after}`;
    setTitlePattern(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = before.length + gap.length + token.length + 2;
      el.setSelectionRange(pos, pos);
    });
  }

  const tokens = customTokens(titlePattern);

  return (
    <>
      <Header
        variant="centered"
        title={isEdit ? 'Edit template' : 'New template'}
        left={
          <button type="button" class="text-btn" onClick={cancel}>
            Cancel
          </button>
        }
        right={
          <button type="button" class="text-btn" onClick={save} disabled={saving}>
            Save
          </button>
        }
      />
      <form
        class="container stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div class="field">
          <label for="tpl-name">Name</label>
          <div class="row">
            <button type="button" class="tpl-tile-btn" onClick={() => setIconOpen(true)} aria-label={`Icon: ${templateIconLabel(icon)}. Change icon`}>
              <TemplateTile template={{ icon, color }} size={48} />
            </button>
            <input
              id="tpl-name"
              class="input grow"
              value={name}
              placeholder="Chinese class"
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              autocomplete="off"
            />
          </div>
          {error && <div class="field__error">{error}</div>}
        </div>

        <div class="field">
          <span class="field__label">Colour</span>
          <div class="chip-row">
            {TAG_PALETTE.map((p) => (
              <button
                key={p.id}
                type="button"
                class={`swatch ${color === p.id ? 'swatch--on' : ''}`}
                style={{ background: p.hex }}
                aria-label={p.name}
                aria-pressed={color === p.id}
                onClick={() => setColor(p.id)}
              />
            ))}
          </div>
        </div>

        <div class="field">
          <label for="tpl-tags">Linked tags</label>
          <TagInput id="tpl-tags" value={tagIds} onChange={setTagIds} />
          <p class="muted small">Added to every record made with this template.</p>
        </div>

        <div class="list">
          <div class="list-row">
            <div class="grow">
              <div class="list-row__title">Suggest when a linked tag is added</div>
              <div class="list-row__sub">Offer this template as soon as one of its tags goes on a new record.</div>
            </div>
            <button type="button" role="switch" class="toggle" aria-checked={suggestOnTag} aria-label="Suggest when a linked tag is added" onClick={() => setSuggestOnTag((v) => !v)} />
          </div>
        </div>

        <div class="field">
          <label for="tpl-pattern">Title pattern</label>
          <input
            id="tpl-pattern"
            ref={patternRef}
            class="input"
            value={titlePattern}
            placeholder="Chinese: {topic}"
            onInput={(e) => setTitlePattern((e.target as HTMLInputElement).value)}
            autocomplete="off"
            autoCapitalize="off"
          />
          <div class="chip-row">
            {QUICK_TOKENS.map((t) => (
              <button key={t} type="button" class="chip" onClick={() => insertToken(t)}>
                + {`{${t}}`}
              </button>
            ))}
          </div>
          <p class="muted small">
            Words in {'{curly braces}'} become inputs when the template is used{tokens.length ? `: ${tokens.map((t) => `{${t}}`).join(', ')}` : ''}. {'{date}'} and{' '}
            {'{child}'} fill in by themselves. Leave empty for a plain title.
          </p>
        </div>

        <div class="field">
          <label for="tpl-body">Description</label>
          <MarkdownEditor id="tpl-body" value={body} onChange={setBody} hints hintTool placeholder="## Section&#10;[[what to write here]]" />
          <p class="muted small">
            <code>[[ ]]</code> marks a hint. Tapping it selects it so typing replaces it. Hints that are left untouched are removed when the record is saved.
          </p>
        </div>

        <button type="submit" class="btn btn--primary" disabled={saving}>
          {isEdit ? 'Save changes' : 'Create template'}
        </button>

        {existing && (
          <>
            <button
              type="button"
              class="btn"
              onClick={async () => {
                const copy = await duplicateTemplate(existing.id);
                if (copy) {
                  toast(`Duplicated as ${copy.name}`);
                  navigate(`/settings/templates/${copy.id}`, { replace: true });
                }
              }}
            >
              <IconCopy size={18} /> Duplicate template
            </button>
            <button type="button" class="btn btn--danger" onClick={() => setConfirmDelete(true)}>
              Delete template
            </button>
          </>
        )}
      </form>

      <Dialog open={iconOpen} onClose={() => setIconOpen(false)} variant="sheet" label="Choose an icon">
        <h2>Icon</h2>
        <div class="icon-grid" role="group" aria-label="Icons">
          {TEMPLATE_ICONS.map((ic) => (
            <button
              key={ic.key}
              type="button"
              aria-label={ic.label}
              title={ic.label}
              aria-pressed={icon === ic.key}
              onClick={() => {
                setIcon(ic.key);
                setIconOpen(false);
              }}
            >
              <TemplateIcon name={ic.key} size={26} />
            </button>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard changes?"
        message="Your edits to this template will be lost."
        cancelLabel="Keep editing"
        actions={[{ label: 'Discard', kind: 'danger', onClick: leave }]}
      />

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${existing.name}?`}
          message="Records made with it keep their content."
          actions={[
            {
              label: 'Delete template',
              kind: 'danger',
              onClick: async () => {
                await removeTemplate(existing.id);
                toast('Template deleted');
                leave();
              },
            },
          ]}
        />
      )}
    </>
  );
}
