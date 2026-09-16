import { useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { ChildPicker } from '../components/ChildPicker';
import { TagInput } from '../components/TagInput';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { ConfirmDialog } from '../components/Dialog';
import { achievements, addAchievement, removeAchievement, toast, updateAchievement } from '../store';
import { back, navigate, useRoute } from '../router';
import { isValidIsoDate, todayIso } from '../lib/dates';

type Props = { achievementId?: string };

export function AchievementEditorScreen({ achievementId }: Props) {
  const route = useRoute();
  const existing = achievementId ? achievements.value.find((a) => a.id === achievementId) : undefined;
  const isEdit = !!achievementId;

  const [childId, setChildId] = useState<string | null>(existing?.childId ?? route.query.get('child') ?? null);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [tagIds, setTagIds] = useState<string[]>(existing?.tags ?? []);
  const [description, setDescription] = useState(existing?.description ?? '');
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
    if (!childId) e.child = 'Choose a kid.';
    if (!isValidIsoDate(date)) e.date = 'Enter a valid date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const data = { childId: childId!, title: title.trim(), date, tags: tagIds, description };
      if (existing) {
        await updateAchievement({ ...existing, ...data });
        toast('Achievement updated');
        navigate(`/records/${existing.id}`, { replace: true });
      } else {
        const a = await addAchievement(data);
        toast('Achievement saved');
        navigate(`/records/${a.id}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (existing) navigate(`/records/${existing.id}`, { replace: true });
    else back('/records');
  }

  return (
    <>
      <Header
        variant="centered"
        title={isEdit ? 'Edit achievement' : 'New achievement'}
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
          <span class="field__label">Kid</span>
          <ChildPicker value={childId} onChange={setChildId} />
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
          {isEdit ? 'Save changes' : 'Save achievement'}
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
