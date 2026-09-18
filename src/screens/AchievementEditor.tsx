import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { ChildPicker } from '../components/ChildPicker';
import { TagInput } from '../components/TagInput';
import { TagChip } from '../components/TagChip';
import { Avatar } from '../components/Avatar';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { ConfirmDialog, Dialog } from '../components/Dialog';
import { TemplateTile } from '../components/TemplateIcons';
import { IconSearch, IconX } from '../components/Icons';
import {
  L,
  achievements,
  addAchievement,
  addAchievements,
  childById,
  recordTemplateUsage,
  removeAchievement,
  sortedChildren,
  tagById,
  templates,
  templatesByRecency,
  toast,
  updateAchievement,
} from '../store';
import { back, navigate, useRoute } from '../router';
import { formatDate, isValidIsoDate, todayIso } from '../lib/dates';
import { uuid } from '../lib/ids';
import { appendNote, hasRealContent, stripHints } from '../lib/templateHints';
import { customTokens, hasTokens, resolveTitle, tokenDate, tokenLabel } from '../lib/templateTokens';
import { bodyOutline } from '../lib/starterTemplates';
import type { Template } from '../types';

type Props = { achievementId?: string };

/** Everything "Undo" restores after a template is applied. */
type Snapshot = { title: string; tagIds: string[]; description: string; applied: Template | null; tokenValues: Record<string, string>; titleEdited: boolean };

const START_FROM_LIMIT = 5;
const UNDO_MS = 10_000;

export function AchievementEditorScreen({ achievementId }: Props) {
  const route = useRoute();
  const existing = achievementId ? achievements.value.find((a) => a.id === achievementId) : undefined;
  const isEdit = !!achievementId;

  // "Duplicate" opens the editor as a new record pre-filled from another one.
  const fromId = !isEdit ? route.query.get('from') : null;
  const source = fromId ? achievements.value.find((a) => a.id === fromId) : undefined;
  const preset = existing ?? source;

  const initialChildren = (): string[] => {
    if (existing) return [existing.childId];
    const kid = route.query.get('child');
    if (kid && childById.value.has(kid)) return [kid];
    if (source && childById.value.has(source.childId)) return [source.childId];
    return [];
  };

  const [childIds, setChildIds] = useState<string[]>(initialChildren);
  const [title, setTitle] = useState(preset?.title ?? '');
  const [date, setDate] = useState(preset?.date ?? todayIso());
  const [tagIds, setTagIds] = useState<string[]>(preset?.tags ?? []);
  const [description, setDescription] = useState(preset?.description ?? '');
  const [errors, setErrors] = useState<{ title?: string; child?: string; date?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Templates
  const [applied, setApplied] = useState<Template | null>(null);
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});
  const [titleEdited, setTitleEdited] = useState(false);
  const [undo, setUndo] = useState<Snapshot | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();
  const [conflict, setConflict] = useState<Template | null>(null);
  const [suggestion, setSuggestion] = useState<Template[] | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreQuery, setMoreQuery] = useState('');

  // Class mode
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const isClass = !isEdit && childIds.length > 1;
  const pattern = applied?.titlePattern ?? '';
  const tokens = customTokens(pattern);
  const singleChild = childIds.length === 1 ? childById.value.get(childIds[0]) : undefined;
  const builtin = { date: tokenDate(isValidIsoDate(date) ? date : todayIso()), child: singleChild ? singleChild.firstName : '{child}' };
  const generatedTitle = pattern ? resolveTitle(pattern, { ...tokenValues, ...builtin }) : '';

  // While the title comes from the pattern, keep it in sync with the token inputs.
  useEffect(() => {
    if (pattern && !titleEdited) setTitle(generatedTitle);
  }, [pattern, titleEdited, generatedTitle]);

  const startFrom = templatesByRecency.value;
  const allTemplates = templates.value;

  const moreResults = useMemo(() => {
    const q = moreQuery.trim().toLowerCase();
    return q ? startFrom.filter((t) => t.name.toLowerCase().includes(q)) : startFrom;
  }, [startFrom, moreQuery]);

  if (isEdit && !existing) {
    return (
      <>
        <Header variant="centered" title="Edit achievement" left={<a class="text-btn" href="#/records">Back</a>} />
        <div class="container">
          <p class="muted">This record no longer exists.</p>
        </div>
      </>
    );
  }

  /* ---------- Undo ---------- */

  function clearUndo() {
    if (undo) setUndo(null);
    clearTimeout(undoTimer.current);
  }

  function snapshotNow(): Snapshot {
    return { title, tagIds, description, applied, tokenValues, titleEdited };
  }

  function restore(s: Snapshot) {
    setTitle(s.title);
    setTagIds(s.tagIds);
    setDescription(s.description);
    setApplied(s.applied);
    setTokenValues(s.tokenValues);
    setTitleEdited(s.titleEdited);
    clearUndo();
  }

  function armUndo(s: Snapshot) {
    setUndo(s);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  /* ---------- Templates ---------- */

  function applyTemplate(t: Template, mode: 'replace' | 'append') {
    armUndo(snapshotNow());
    setApplied(t);
    setTokenValues({});
    setTitleEdited(false);
    const known = t.tagIds.filter((id) => tagById.value.has(id));
    setTagIds(Array.from(new Set([...tagIds, ...known])));
    setDescription(mode === 'replace' || !description.trim() ? t.body : `${description.trimEnd()}\n\n${t.body}`);
    setSuggestion(null);
    setConflict(null);
    setMoreOpen(false);
  }

  function clearTemplate() {
    if (!applied) return;
    armUndo(snapshotNow());
    setApplied(null);
    setTokenValues({});
    setTitleEdited(false);
    if (!hasRealContent(description)) setDescription('');
  }

  /** Chip tap. Asks before replacing text the user has written. */
  function chooseTemplate(t: Template | null) {
    if (t === null) {
      clearTemplate();
      return;
    }
    if (applied?.id === t.id) return;
    if (hasRealContent(description)) {
      setConflict(t);
      setMoreOpen(false);
      return;
    }
    applyTemplate(t, 'replace');
  }

  function onTagsChange(next: string[]) {
    const added = next.filter((id) => !tagIds.includes(id));
    setTagIds(next);
    clearUndo();
    if (isEdit || applied || suggestionDismissed || added.length === 0) return;
    const matches = templatesByRecency.value.filter((t) => t.suggestOnTag && t.tagIds.some((id) => added.includes(id)));
    if (matches.length) setSuggestion(matches);
  }

  /* ---------- Children / class mode ---------- */

  function onChildrenChange(next: string[]) {
    // Back down to one kid: fold that kid's note into the shared description.
    if (childIds.length > 1 && next.length === 1) {
      const note = notes[next[0]];
      if (note?.trim()) {
        setDescription((d) => appendNote(d, note));
        setNotes({ ...notes, [next[0]]: '' });
      }
    }
    setChildIds(next);
    clearUndo();
  }

  /* ---------- Save ---------- */

  function titleFor(childId: string): string {
    const child = childById.value.get(childId);
    const values = { ...tokenValues, date: builtin.date, child: child?.firstName ?? '' };
    if (hasTokens(title)) return resolveTitle(title, values);
    return title.trim();
  }

  function validate(): boolean {
    const e: typeof errors = {};
    const anyTitle = childIds.length ? childIds.some((id) => titleFor(id)) : !!title.trim();
    if (!anyTitle) e.title = pattern && !titleEdited ? 'Fill in the title fields above.' : 'Give this achievement a title.';
    if (childIds.length === 0) e.child = isEdit ? `Choose a ${L.value.one}.` : `Choose at least one ${L.value.one}.`;
    if (!isValidIsoDate(date)) e.date = 'Enter a valid date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const cleanDescription = stripHints(description);
      if (existing) {
        await updateAchievement({ ...existing, title: title.trim(), date, tags: tagIds, description: cleanDescription, childId: childIds[0] });
        toast('Achievement updated');
        navigate(`/records/${existing.id}`, { replace: true });
        return;
      }
      const stamp = applied
        ? { templateId: applied.id, templateVersion: applied.version }
        : source?.templateId
          ? { templateId: source.templateId, templateVersion: source.templateVersion }
          : {};
      if (childIds.length === 1) {
        const created = await addAchievement({ title: titleFor(childIds[0]), date, tags: tagIds, description: cleanDescription, childId: childIds[0], ...stamp });
        if (applied) await recordTemplateUsage(applied.id);
        toast('Achievement saved');
        navigate(`/records/${created.id}`, { replace: true });
        return;
      }
      const batchId = uuid();
      const created = await addAchievements(
        childIds.map((childId) => ({
          childId,
          title: titleFor(childId),
          date,
          tags: tagIds,
          description: appendNote(cleanDescription, notes[childId] ?? ''),
          batchId,
          ...stamp,
        })),
      );
      if (applied) await recordTemplateUsage(applied.id);
      toast(`${created.length} records saved`);
      navigate(`/records?batch=${batchId}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (existing) navigate(`/records/${existing.id}`, { replace: true });
    else if (source) navigate(`/records/${source.id}`, { replace: true });
    else back('/records');
  }

  /* ---------- Render ---------- */

  const headerTitle = isEdit ? 'Edit achievement' : isClass ? title.trim() || 'New achievement' : source ? 'Duplicate achievement' : 'New achievement';
  const saveLabel = isEdit ? 'Save changes' : isClass ? `Save ${childIds.length}` : 'Save achievement';
  const kids = sortedChildren.value;
  const allSelected = kids.length > 0 && kids.every((k) => childIds.includes(k.id));
  const selectedTags = tagIds.map((id) => tagById.value.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
  const outline = bodyOutline(description);
  const showStartFrom = !isEdit && allTemplates.length > 0;
  const chips = startFrom.slice(0, START_FROM_LIMIT);
  const appliedOffChips = applied && !chips.some((t) => t.id === applied.id) ? applied : null;

  const templateChip = (t: Template) => {
    const on = applied?.id === t.id;
    return (
      <button key={t.id} type="button" class={`chip tpl-chip ${on ? 'chip--active' : ''}`} aria-pressed={on} onClick={() => chooseTemplate(t)}>
        <TemplateTile template={t} size={20} />
        <span class="truncate">{t.name}</span>
      </button>
    );
  };

  return (
    <>
      <Header
        variant="centered"
        title={headerTitle}
        left={
          <button type="button" class="text-btn" onClick={cancel}>
            Cancel
          </button>
        }
        right={
          <button type="button" class="text-btn" onClick={save} disabled={saving}>
            {isClass ? `Save ${childIds.length}` : 'Save'}
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
          <div class="row" style={{ justifyContent: 'space-between' }}>
            <span class="field__label">{isEdit ? L.value.One : L.value.Many}</span>
            {!isEdit && kids.length > 1 && (
              <button type="button" class="text-btn small" style={{ minHeight: 32 }} onClick={() => onChildrenChange(allSelected ? [] : kids.map((k) => k.id))}>
                {allSelected ? 'Clear' : 'Select all'}
              </button>
            )}
          </div>
          <ChildPicker value={childIds} onChange={onChildrenChange} multiple={!isEdit} />
          {isClass && <p class="muted small">Class mode: the same record is saved for each {L.value.one}, with an optional note each.</p>}
          {errors.child && <div class="field__error">{errors.child}</div>}
        </div>

        {showStartFrom && (
          <div class="field">
            <span class="field__label" id="start-from-label">
              Start from
            </span>
            <div class="chip-scroll" role="group" aria-labelledby="start-from-label">
              {chips.map(templateChip)}
              {appliedOffChips && templateChip(appliedOffChips)}
              {startFrom.length > START_FROM_LIMIT && (
                <button type="button" class="chip" onClick={() => setMoreOpen(true)}>
                  More
                </button>
              )}
              <button type="button" class={`chip ${!applied ? 'chip--active' : ''}`} aria-pressed={!applied} onClick={() => chooseTemplate(null)}>
                Blank
              </button>
            </div>
          </div>
        )}

        {undo && (
          <div class="banner banner--info" role="status">
            <span class="grow">{applied ? `${applied.name} template applied` : 'Template removed'}</span>
            <button type="button" class="text-btn" onClick={() => restore(undo)}>
              Undo
            </button>
          </div>
        )}

        {pattern &&
          tokens.map((name) => (
            <div key={name} class="field">
              <label for={`token-${name}`}>{tokenLabel(name)}</label>
              <input
                id={`token-${name}`}
                class="input"
                value={tokenValues[name] ?? ''}
                onInput={(e) => {
                  setTokenValues({ ...tokenValues, [name]: (e.target as HTMLInputElement).value });
                  clearUndo();
                }}
                autocomplete="off"
              />
            </div>
          ))}

        <div class="field">
          <label for="title">Title</label>
          {pattern && !titleEdited && (
            <p class="muted small" style={{ margin: 0 }}>
              Title will be: <strong>{generatedTitle || '…'}</strong>
            </p>
          )}
          <input
            id="title"
            class="input"
            value={title}
            placeholder={pattern ? 'Fill in the fields above' : 'What did they achieve?'}
            onInput={(e) => {
              setTitle((e.target as HTMLInputElement).value);
              if (pattern) setTitleEdited(true);
              clearUndo();
            }}
            autocomplete="off"
          />
          {pattern && titleEdited && (
            <p class="muted small" style={{ margin: 0 }}>
              Edited by hand.{' '}
              <button type="button" class="link-btn" onClick={() => setTitleEdited(false)}>
                Reset to pattern
              </button>
            </p>
          )}
          {isClass && hasTokens(title) && <p class="muted small">{'{child}'} is filled in with each {L.value.one}'s name.</p>}
          {errors.title && <div class="field__error">{errors.title}</div>}
        </div>

        <div class="field">
          <label for="date">Date</label>
          <input
            id="date"
            class="input"
            type="date"
            value={date}
            max="9999-12-31"
            onInput={(e) => {
              setDate((e.target as HTMLInputElement).value);
              clearUndo();
            }}
          />
          {errors.date && <div class="field__error">{errors.date}</div>}
        </div>

        <div class="field">
          <label for="tag-input">Tags</label>
          <TagInput id="tag-input" value={tagIds} onChange={onTagsChange} />
          {suggestion && !applied && (
            <div class="suggest" role="status">
              <span class="grow">Use {suggestion[0].name} template?</span>
              <button type="button" class="text-btn" onClick={() => chooseTemplate(suggestion[0])}>
                Use
              </button>
              {suggestion.length > 1 && (
                <button type="button" class="text-btn" onClick={() => setMoreOpen(true)}>
                  More
                </button>
              )}
              <button
                type="button"
                class="icon-btn"
                style={{ width: 32, height: 32 }}
                aria-label="Dismiss suggestion"
                onClick={() => {
                  setSuggestion(null);
                  setSuggestionDismissed(true);
                }}
              >
                <IconX size={16} />
              </button>
            </div>
          )}
        </div>

        <div class="field">
          <label for="description">Description</label>
          <MarkdownEditor
            id="description"
            value={description}
            onChange={(v) => {
              setDescription(v);
              clearUndo();
            }}
            placeholder="Details, in markdown if you like."
            hints
          />
        </div>

        {isClass && (
          <>
            <div class="card stack" style={{ gap: 8 }}>
              <div class="list-row__title">Shared by all {childIds.length} {L.value.many}</div>
              <div class="small">
                <span class="muted">Title</span> {title.trim() || '—'}
              </div>
              <div class="small">
                <span class="muted">Date</span> {isValidIsoDate(date) ? formatDate(date) : '—'}
              </div>
              <div class="small row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span class="muted">Tags</span>
                {selectedTags.length ? selectedTags.map((t) => <TagChip key={t.id} tag={t} size="sm" />) : '—'}
              </div>
              <div class="small">
                <span class="muted">Description</span> {outline.length ? outline.join(' · ') : description.trim() ? 'Shared text' : 'None'}
              </div>
            </div>

            <div class="field">
              <span class="field__label">Notes per {L.value.one} (optional)</span>
              <div class="list">
                {childIds.map((id) => {
                  const kid = childById.value.get(id);
                  if (!kid) return null;
                  return (
                    <label key={id} class="list-row" style={{ minHeight: 56 }}>
                      <Avatar config={kid.avatar} firstName={kid.firstName} lastName={kid.lastName} size={36} />
                      <input
                        class="input grow"
                        style={{ minHeight: 40 }}
                        value={notes[id] ?? ''}
                        placeholder={`Note for ${kid.firstName}`}
                        aria-label={`Note for ${kid.firstName}`}
                        onInput={(e) => setNotes({ ...notes, [id]: (e.target as HTMLInputElement).value })}
                        autocomplete="off"
                      />
                    </label>
                  );
                })}
              </div>
              <p class="muted small">Added under a “Notes” heading in that {L.value.one}'s record.</p>
            </div>
          </>
        )}

        <button type="submit" class="btn btn--primary" disabled={saving}>
          {saveLabel}
        </button>

        {existing && (
          <button type="button" class="btn btn--danger" onClick={() => setConfirmDelete(true)}>
            Delete record
          </button>
        )}
      </form>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} variant="sheet" label="All templates">
        <h2>Templates</h2>
        <label class="search">
          <IconSearch size={18} />
          <input type="search" placeholder="Search templates" value={moreQuery} onInput={(e) => setMoreQuery((e.target as HTMLInputElement).value)} />
        </label>
        <div class="list">
          {moreResults.map((t) => (
            <button key={t.id} type="button" class="list-row" aria-pressed={applied?.id === t.id} onClick={() => chooseTemplate(t)}>
              <TemplateTile template={t} size={36} />
              <div class="grow" style={{ minWidth: 0 }}>
                <div class="list-row__title truncate">{t.name}</div>
                <div class="list-row__sub truncate">{bodyOutline(t.body).join(' · ') || 'No sections'}</div>
              </div>
              {applied?.id === t.id && <span class="muted small">Applied</span>}
            </button>
          ))}
          {moreResults.length === 0 && <div class="list-row muted small">No templates match.</div>}
        </div>
        <a class="btn" href="#/settings/templates/new">
          New template
        </a>
      </Dialog>

      <Dialog open={conflict !== null} onClose={() => setConflict(null)} variant="sheet" label="Apply template">
        {conflict && (
          <>
            <h2>Apply {conflict.name}?</h2>
            <p class="muted small">The description already has text. What should happen to it?</p>
            <div class="dialog__actions">
              <button type="button" class="btn btn--primary" onClick={() => applyTemplate(conflict, 'replace')}>
                Replace
              </button>
              <button type="button" class="btn" onClick={() => applyTemplate(conflict, 'append')}>
                Add below
              </button>
              <button type="button" class="btn btn--ghost" onClick={() => setConflict(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Dialog>

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Delete this record?"
          message="This cannot be undone."
          actions={[
            {
              label: 'Delete record',
              kind: 'danger',
              onClick: async () => {
                await removeAchievement(existing.id);
                toast('Record deleted');
                navigate('/records', { replace: true });
              },
            },
          ]}
        />
      )}
    </>
  );
}
