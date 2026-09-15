import type { ComponentChildren } from 'preact';

type Props = {
  title: string;
  /** Large left-aligned title (tab roots) or compact centered title (sub-screens). */
  variant?: 'large' | 'centered';
  left?: ComponentChildren;
  right?: ComponentChildren;
};

export function Header({ title, variant = 'large', left, right }: Props) {
  return (
    <header class={`header ${variant === 'centered' ? 'header--centered' : ''}`}>
      <div class="header__inner">
        {(left || variant === 'centered') && <div class="header__side">{left}</div>}
        <div class="header__title">
          <h1>{title}</h1>
        </div>
        {(right || variant === 'centered') && <div class="header__side header__side--end">{right}</div>}
      </div>
    </header>
  );
}
