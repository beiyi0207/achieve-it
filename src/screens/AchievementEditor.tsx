import { useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { ChildPicker } from '../components/ChildPicker';
import { TagInput } from '../components/TagInput';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { ConfirmDialog } from '../components/Dialog';
import { L, achievements, addAchievement, childById, removeAchievement, toast, updateAchievement } from '../store';
import { back, navigate, useRoute } from '../router';
import { isValidIsoDate, todayIso } from '../lib/dates';
import { recordsHref } from '../lib/filters';

type Props = { achievementId?: string };

export function AchievementEditorScreen({ achievementId }: Props) {
  const route = useRoute();
  const existing = achievementId ? achievements.value.find((a) => a.id === achievementId) : undefined;
  const isEdit = !!achievementId;

  // "Duplicate" opens the editor as a new record pre-filled from another one.
  const fromId = !isEdit ? route.query.get('from') : null;
  const source = fromId ? achievements.value.find((a) => a.id === fromId) : undefined;
  const template = existing ?? source;

  const initialChildren = (): string[] => {
    if (existing) return [existing.childId];
    const preset = route.query.get('child');
    if (preset && childById.value.has(preset)) return [preset];
    if (source && childById.value.has(source.childId)) return [source.childId];
    return [];
  };

  const [childIds, setChildIds] = useState<string[]>(initialChildren);
  const [title, setTitle] = useState(template?.title ?? '');
  const [date, setDate] = useState(template?.date ?? todayIso());
  const [tagIds, setTagIds] = useState<string[]>(template?.tags ?? []);
  const [description, setDescription] = useState(template?.description ?? '');
  const [errors, setErrors] = useState<{ title?: string; child?: string; date?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

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

  function validate(): boolean {
    const e: typeof errors = {};
    if (!title.trim()) e.title = 'Give this achievement a title.';
    if (childIds.length === 0) e.child = isEdit ? `Choose a ${L.value.one}.` : `Choose at least one ${L.value.one}.`;
    if (!isValidIsoDate(date)) e.date = 'Enter a valid date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const base = { title: title.trim(), date, tags: tagIds, description };
      if (existing) {
        await updateAchievement({ ...existing, ...base, childId: childIds[0] });
        toast('Achievement updated');
        navigate(`/records/${existing.id}`, { replace: true });
        return;
      }
      const created = [];
      for (const childId of childIds) created.push(await addAchievement({ ...base, childId }));
      if (created.length === 1) {
        toast('Achievement saved');
        navigate(`/records/${created[0].id}`, { replace: true });
      } else {
        toast(`Saved for ${L.value.count(created.length)}`);
        navigate(recordsHref({ childIds, range: 'custom', from: date, to: date }).slice(1), { replace: true });
      }
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (existing) navigate(`/records/${existing.id}`, { replace: true });
    else if (source) navigate(`/records/${source.id}`, { replace: true });
    else back('/records');
  }

  const saveLabel = isEdit ? 'Save changes' : childIds.length > 1 ? `Save for ${childIds.length} kids` : 'Save achievement';

  return (
    <>
      <Header
        variant="centered"
        title={isEdit ? 'Edit achievement' : source ? 'Duplicate achievement' : 'New achievement'}
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
          <span class="field__label">{isEdit ? L.value.One : L.value.Many}</span>
          <ChildPicker value={childIds} onChange={setChildIds} multiple={!isEdit} />
          {!isEdit && childIds.length > 1 && <p class="muted small">A separate record is saved for each kid.</p>}
          {errors.child && <div class="field__error">{errors.child}</div>}
        </div>

        <div class="field">
          <label for="title">Title</label>
          <input
            id="title"
            class="input"
            value={title}
            placeholder="What did they achieve?"
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
            autocomplete="off"
          />
          {errors.title && <div class="field__error">{errors.title}</div>}
        </div>

        <div class="field">
          <label for="date">Date</label>
          <input id="date" class="input" type="date" value={date} max="9999-12-31" onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
          {errors.date && <div class="field__error">{errors.date}</div>}
        </div>

        <div class="field">
          <label for="tag-input">Tags</label>
          <TagInput id="tag-input" value={tagIds} onChange={setTagIds} />
        </div>

        <div class="field">
          <label for="description">Description</label>
          <MarkdownEditor id="description" value={description} onChange={setDescription} placeholder="Details, in markdown if you like." />
        </div>

        <button type="submit" class="btn btn--primary" disabled={saving}>
          {saveLabel}
        </button>

        {existing && (
          <button type="button" class="btn btn--danger" onClick={() => setConfirmDelete(true)}>
            Delete record
          </button>
        )}
      </form>

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
