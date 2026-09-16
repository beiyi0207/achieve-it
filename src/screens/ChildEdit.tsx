import { useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/Dialog';
import { IconShuffle } from '../components/Icons';
import { L, achievements, addChild, childById, childName, removeChild, toast, updateChild } from '../store';
import { navigate } from '../router';
import { DEFAULT_STYLE, randomConfig, shuffleConfig } from '../lib/avatar';
import type { AvatarConfig } from '../types';

type Props = { childId?: string };

export function ChildEditScreen({ childId }: Props) {
  const existing = childId ? childById.value.get(childId) : undefined;
  const isEdit = !!childId;

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [age, setAge] = useState(existing ? String(existing.age) : '');
  const [avatar, setAvatar] = useState<AvatarConfig | null>(existing?.avatar ?? null);
  const [avatarTouched, setAvatarTouched] = useState(isEdit);
  const [errors, setErrors] = useState<{ firstName?: string; age?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Until the user shuffles or edits the avatar, a new child's avatar follows their name.
  const previewAvatar = avatarTouched && avatar ? avatar : randomConfig(DEFAULT_STYLE, `${firstName} ${lastName}`.trim() || 'new kid');

  const recordCount = existing ? achievements.value.filter((a) => a.childId === existing.id).length : 0;

  if (isEdit && !existing) {
    return (
      <>
        <Header variant="centered" title={`Edit ${L.value.one}`} left={<a class="text-btn" href="#/kids">Back</a>} />
        <div class="container">
          <p class="muted">This {L.value.one} no longer exists.</p>
        </div>
      </>
    );
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!firstName.trim()) e.firstName = 'First name is required.';
    const n = Number(age);
    if (age.trim() === '' || !Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 150) e.age = 'Enter an age between 0 and 150.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const data = { firstName: firstName.trim(), lastName: lastName.trim(), age: Number(age), avatar: previewAvatar };
      if (existing) {
        await updateChild({ ...existing, ...data });
        toast(`${L.value.One} updated`);
        navigate(`/kids/${existing.id}`, { replace: true });
      } else {
        const c = await addChild(data);
        toast(`${c.firstName} added`);
        navigate(`/kids/${c.id}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  }

  const cancelHref = existing ? `#/kids/${existing.id}` : '#/kids';

  return (
    <>
      <Header
        variant="centered"
        title={isEdit ? `Edit ${L.value.one}` : `New ${L.value.one}`}
        left={
          <a class="text-btn" href={cancelHref}>
            Cancel
          </a>
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
        <div class="stack" style={{ alignItems: 'center', paddingTop: 8 }}>
          <Avatar config={previewAvatar} firstName={firstName} lastName={lastName} size={128} />
          <div class="row">
            <button
              type="button"
              class="chip"
              onClick={() => {
                setAvatar(shuffleConfig(previewAvatar));
                setAvatarTouched(true);
              }}
            >
              <IconShuffle size={16} /> Shuffle
            </button>
            {existing && (
              <a class="chip" href={`#/kids/${existing.id}/avatar`}>
                Customise avatar
              </a>
            )}
          </div>
          {!existing && <p class="muted small">You can customise the avatar after saving.</p>}
        </div>

        <div class="field">
          <label for="firstName">First name</label>
          <input
            id="firstName"
            class="input"
            value={firstName}
            onInput={(e) => setFirstName((e.target as HTMLInputElement).value)}
            autocomplete="off"
            required
          />
          {errors.firstName && <div class="field__error">{errors.firstName}</div>}
        </div>

        <div class="field">
          <label for="lastName">Last name</label>
          <input id="lastName" class="input" value={lastName} onInput={(e) => setLastName((e.target as HTMLInputElement).value)} autocomplete="off" />
        </div>

        <div class="field">
          <label for="age">Age</label>
          <input
            id="age"
            class="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={150}
            value={age}
            onInput={(e) => setAge((e.target as HTMLInputElement).value)}
          />
          {errors.age && <div class="field__error">{errors.age}</div>}
        </div>

        <button type="submit" class="btn btn--primary" disabled={saving}>
          {isEdit ? 'Save changes' : `Add ${L.value.one}`}
        </button>

        {existing && (
          <button type="button" class="btn btn--danger" onClick={() => setConfirmDelete(true)}>
            Delete {L.value.one}
          </button>
        )}
      </form>

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${existing.firstName}?`}
          message={
            recordCount > 0
              ? `${childName(existing)} has ${recordCount} ${recordCount === 1 ? 'record' : 'records'}. Choose what happens to them.`
              : 'This cannot be undone.'
          }
          actions={
            recordCount > 0
              ? [
                  {
                    label: `Delete ${L.value.one} and records`,
                    kind: 'danger',
                    onClick: async () => {
                      await removeChild(existing.id, 'delete');
                      toast(`${L.value.One} and records deleted`);
                      navigate('/kids', { replace: true });
                    },
                  },
                  {
                    label: `Delete ${L.value.one}, keep records`,
                    onClick: async () => {
                      await removeChild(existing.id, 'keep');
                      toast(`${L.value.One} deleted. Records kept.`);
                      navigate('/kids', { replace: true });
                    },
                  },
                ]
              : [
                  {
                    label: `Delete ${L.value.one}`,
                    kind: 'danger',
                    onClick: async () => {
                      await removeChild(existing.id, 'delete');
                      toast(`${L.value.One} deleted`);
                      navigate('/kids', { replace: true });
                    },
                  },
                ]
          }
        />
      )}
    </>
  );
}
