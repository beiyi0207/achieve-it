import { useMemo, useState } from 'preact/hooks';
import { addTag, sortedTags, tagById } from '../store';
import { TagChip } from './TagChip';
import { IconPlus } from './Icons';

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  id?: string;
};

/** Chip input with autocomplete from existing tags; creates new tags inline. */
export function TagInput({ value, onChange, id }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const all = sortedTags.value;
  const byId = tagById.value;

  const selected = value.map((i) => byId.get(i)).filter((t): t is NonNullable<typeof t> => !!t);
  const q = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    const unselected = all.filter((t) => !value.includes(t.id));
    if (!q) return unselected.slice(0, 8);
    return unselected
      .filter((t) => t.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)))
      .slice(0, 8);
  }, [all, value, q]);

  const exact = all.find((t) => t.name.toLowerCase() === q);
  const canCreate = q.length > 0 && !exact;

  function select(idToAdd: string) {
    if (!value.includes(idToAdd)) onChange([...value, idToAdd]);
    setQuery('');
  }

  async function commit() {
    if (!q) return;
    if (exact) {
      select(exact.id);
      return;
    }
    const t = await addTag(query.trim());
    select(t.id);
  }

  return (
    <div class="tag-input-wrap">
      <div class="tag-input" onClick={() => document.getElementById(id ?? 'tag-input')?.focus()}>
        {selected.map((t) => (
          <TagChip key={t.id} tag={t} size="sm" onRemove={() => onChange(value.filter((v) => v !== t.id))} />
        ))}
        <input
          id={id ?? 'tag-input'}
          value={query}
          placeholder={selected.length ? '' : 'Add tags'}
          autocomplete="off"
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && !query && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
      </div>
      {focused && (suggestions.length > 0 || canCreate) && (
        <div class="suggestions" role="listbox">
          {suggestions.map((t) => (
            <button key={t.id} type="button" role="option" onMouseDown={(e) => e.preventDefault()} onClick={() => select(t.id)}>
              <TagChip tag={t} size="sm" />
            </button>
          ))}
          {canCreate && (
            <button type="button" role="option" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
              <IconPlus size={16} /> Create “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
