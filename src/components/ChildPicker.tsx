import { sortedChildren } from '../store';
import { cssHex } from '../lib/palette';
import { Avatar } from './Avatar';

type Props = {
  value: string | null;
  onChange: (id: string) => void;
};

export function ChildPicker({ value, onChange }: Props) {
  const kids = sortedChildren.value;
  if (kids.length === 0) {
    return (
      <p class="muted small">
        No kids yet. <a href="#/kids/new">Add a kid</a> first.
      </p>
    );
  }
  return (
    <div class="child-picker" role="radiogroup" aria-label="Kid">
      {kids.map((k) => (
        <button
          key={k.id}
          type="button"
          role="radio"
          aria-checked={value === k.id}
          class="child-picker__item"
          style={{ '--ring': cssHex(k.avatar.background) } as Record<string, string>}
          onClick={() => onChange(k.id)}
        >
          <Avatar config={k.avatar} firstName={k.firstName} lastName={k.lastName} size={56} />
          <span class="truncate">{k.firstName}</span>
        </button>
      ))}
    </div>
  );
}
