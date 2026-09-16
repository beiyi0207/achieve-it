import type { ComponentChildren } from 'preact';

export type HBarItem = {
  key: string;
  label: string;
  count: number;
  color: string;
  href: string;
  leading?: ComponentChildren;
  trailing?: ComponentChildren;
  muted?: boolean;
};

type Props = { items: HBarItem[]; max?: number };

/** Horizontal bars with counts; every row is a link. */
export function HBarList({ items, max }: Props) {
  const top = Math.max(1, max ?? Math.max(0, ...items.map((i) => i.count)));
  return (
    <div class="hbars">
      {items.map((i) => (
        <a key={i.key} class={`hbar ${i.muted ? 'hbar--muted' : ''}`} href={i.href}>
          {i.leading}
          <span class="hbar__body">
            <span class="hbar__top">
              <span class="hbar__label truncate">{i.label}</span>
              <span class="hbar__count">{i.count}</span>
            </span>
            <span class="hbar__track">
              <span class="hbar__fill" style={{ width: `${(i.count / top) * 100}%`, background: i.color }} />
            </span>
          </span>
          {i.trailing}
        </a>
      ))}
    </div>
  );
}
