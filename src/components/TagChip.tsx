import type { Tag } from '../types';
import { tagHex } from '../core/palette';
import { IconX } from './Icons';

type Props = {
  tag: Tag;
  size?: 'sm' | 'md';
  count?: number;
  onRemove?: () => void;
  onClick?: () => void;
  href?: string;
  active?: boolean;
};

export function TagChip({ tag, size = 'md', count, onRemove, onClick, href, active }: Props) {
  const style = { '--tag': tagHex(tag.color) } as Record<string, string>;
  const cls = `chip tag-chip ${size === 'sm' ? 'chip--sm' : ''} ${active ? 'tag-chip--active' : ''}`;
  const inner = (
    <>
      <span class="truncate">{tag.name}</span>
      {count !== undefined && <span class="chip__count">{count}</span>}
      {onRemove && (
        <span
          class="chip__x"
          role="button"
          aria-label={`Remove ${tag.name}`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
        >
          <IconX size={14} />
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <a class={cls} style={style} href={href}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" class={cls} style={style} onClick={onClick} aria-pressed={active}>
        {inner}
      </button>
    );
  }
  return (
    <span class={cls} style={style}>
      {inner}
    </span>
  );
}
