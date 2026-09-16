import { L, sortedChildren } from '../store';
import { cssHex } from '../lib/palette';
import { Avatar } from './Avatar';

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Allow several kids to be selected (one record is saved per kid). */
  multiple?: boolean;
};

export function ChildPicker({ value, onChange, multiple = false }: Props) {
  const kids = sortedChildren.value;
  if (kids.length === 0) {
    return (
      <p class="muted small">
        No {L.value.many} yet. <a href="#/kids/new">Add a {L.value.one}</a> first.
      </p>
    );
  }

  function toggle(id: string) {
    if (!multiple) {
      onChange([id]);
      return;
    }
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const allSelected = kids.every((k) => value.includes(k.id));

  return (
    <div class="child-picker" role={multiple ? 'group' : 'radiogroup'} aria-label={multiple ? 'Kids' : 'Kid'}>
      {kids.map((k) => {
        const on = value.includes(k.id);
        return (
          <button
            key={k.id}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            class="child-picker__item"
            style={{ '--ring': cssHex(k.avatar.background) } as Record<string, string>}
            onClick={() => toggle(k.id)}
          >
            <Avatar config={k.avatar} firstName={k.firstName} lastName={k.lastName} size={56} />
            <span class="truncate">{k.firstName}</span>
          </button>
        );
      })}
      {multiple && kids.length > 1 && (
        <button
          type="button"
          class="child-picker__item child-picker__all"
          aria-pressed={allSelected}
          onClick={() => onChange(allSelected ? [] : kids.map((k) => k.id))}
        >
          <span class="child-picker__all-circle">{allSelected ? 'None' : 'All'}</span>
          <span>{allSelected ? 'Clear' : 'Everyone'}</span>
        </button>
      )}
    </div>
  );
}
