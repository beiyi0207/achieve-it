import { useMemo, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { Dialog, ConfirmDialog } from '../components/Dialog';
import { TagChip } from '../components/TagChip';
import { EmptyState } from '../components/EmptyState';
import { IconBack, IconChevron } from '../components/Icons';
import { achievements, findTagByName, mergeTags, removeTag, sortedTags, toast, updateTag } from '../store';
import { TAG_PALETTE } from '../core/palette';
import type { Tag } from '../types';

export function ManageTagsScreen() {
  const tags = sortedTags.value;
  const all = achievements.value;
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [error, setError] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Tag | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of all) for (const t of a.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [all]);

  function open(t: Tag) {
    setEditing(t);
    setName(t.name);
    setColor(t.color);
    setError('');
  }

  async function save() {
    if (!editing) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the tag a name.');
      return;
    }
    const clash = findTagByName(trimmed);
    if (clash && clash.id !== editing.id) {
      setError(`“${clash.name}” already exists. Use Merge to combine them.`);
      return;
    }
    await updateTag({ ...editing, name: trimmed, color });
    toast('Tag updated');
    setEditing(null);
  }

  const editCount = editing ? counts.get(editing.id) ?? 0 : 0;

  return (
    <>
      <Header
        variant="centered"
        title="Manage tags"
        left={
          <a class="icon-btn" href="#/settings" aria-label="Back to settings">
            <IconBack />
          </a>
        }
      />
      <div class="container stack">
        {tags.length === 0 ? (
          <EmptyState title="No tags yet" message="Tags are created when you add them to an achievement." />
        ) : (
          <>
            <p class="muted small">Tap a tag to rename, recolour, merge or delete it.</p>
            <div class="list">
              {tags.map((t) => (
                <button key={t.id} type="button" class="list-row" onClick={() => open(t)}>
                  <TagChip tag={t} />
                  <span class="grow muted small" style={{ textAlign: 'right' }}>
                    {counts.get(t.id) ?? 0} {counts.get(t.id) === 1 ? 'record' : 'records'}
                  </span>
                  <IconChevron class="chevron" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={editing !== null && !mergeOpen && !confirmDelete} onClose={() => setEditing(null)} variant="sheet" label="Edit tag">
        {editing && (
          <>
            <h2>Edit tag</h2>
            <div class="field">
              <label for="tag-name">Name</label>
              <input id="tag-name" class="input" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} autocomplete="off" />
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
              <div>
                <TagChip tag={{ ...editing, name: name.trim() || editing.name, color }} />
              </div>
            </div>
            <button type="button" class="btn btn--primary" onClick={save}>
              Save
            </button>
            <button type="button" class="btn" onClick={() => setMergeOpen(true)} disabled={tags.length < 2}>
              Merge into another tag
            </button>
            <button type="button" class="btn btn--danger" onClick={() => setConfirmDelete(true)}>
              Delete tag
            </button>
          </>
        )}
      </Dialog>

      <Dialog open={mergeOpen && editing !== null} onClose={() => setMergeOpen(false)} variant="sheet" label="Merge tag">
        {editing && (
          <>
            <h2>Merge “{editing.name}” into</h2>
            <p class="muted small">
              Records tagged “{editing.name}” will get the tag you choose instead, and “{editing.name}” will be deleted.
            </p>
            <div class="list">
              {tags
                .filter((t) => t.id !== editing.id)
                .map((t) => (
                  <button key={t.id} type="button" class="list-row" onClick={() => setMergeTarget(t)}>
                    <TagChip tag={t} />
                    <span class="grow muted small" style={{ textAlign: 'right' }}>
                      {counts.get(t.id) ?? 0}
                    </span>
                    <IconChevron class="chevron" />
                  </button>
                ))}
            </div>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={mergeTarget !== null && editing !== null}
        onClose={() => setMergeTarget(null)}
        title={editing && mergeTarget ? `Merge “${editing.name}” into “${mergeTarget.name}”?` : ''}
        message={editing ? `${editCount} ${editCount === 1 ? 'record' : 'records'} will be retagged. This cannot be undone.` : ''}
        actions={[
          {
            label: 'Merge tags',
            kind: 'primary',
            onClick: async () => {
              await mergeTags(editing!.id, mergeTarget!.id);
              toast(`Merged into ${mergeTarget!.name}`);
              setMergeOpen(false);
              setEditing(null);
            },
          },
        ]}
      />

      <ConfirmDialog
        open={confirmDelete && editing !== null}
        onClose={() => setConfirmDelete(false)}
        title={editing ? `Delete “${editing.name}”?` : ''}
        message={
          editCount > 0
            ? `The tag will be removed from ${editCount} ${editCount === 1 ? 'record' : 'records'}. The records themselves are kept.`
            : 'This tag is not used by any record.'
        }
        actions={[
          {
            label: 'Delete tag',
            kind: 'danger',
            onClick: async () => {
              await removeTag(editing!.id);
              toast('Tag deleted');
              setEditing(null);
            },
          },
        ]}
      />
    </>
  );
}
