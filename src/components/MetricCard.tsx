import type { ComponentChildren } from 'preact';

type Props = {
  value: ComponentChildren;
  label: string;
  delta?: number | null;
  deltaLabel?: string;
  href?: string;
  onClick?: () => void;
};

export function MetricCard({ value, label, delta, deltaLabel, href, onClick }: Props) {
  const inner = (
    <>
      <span class="metric__value">{value}</span>
      <span class="metric__label">{label}</span>
      {delta !== undefined && delta !== null && (
        <span class={`metric__delta ${delta > 0 ? 'metric__delta--up' : delta < 0 ? 'metric__delta--down' : ''}`}>
          {delta > 0 ? '+' : ''}
          {delta} {deltaLabel ?? 'vs previous'}
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <a class="metric" href={href}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button class="metric" type="button" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div class="metric">{inner}</div>;
}
