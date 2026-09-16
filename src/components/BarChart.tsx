import { monthShort } from '../lib/dates';
import type { MonthCount } from '../lib/stats';

type Props = {
  data: MonthCount[];
  hrefFor: (key: string) => string;
  color?: string;
};

/** Achievements per month. Bars are links so every bar is tappable. */
export function BarChart({ data, hrefFor, color = 'var(--accent)' }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const wide = data.length > 8;
  return (
    <div class={`barchart ${wide ? 'barchart--scroll' : ''}`} role="img" aria-label="Achievements per month">
      <div class="barchart__inner" style={wide ? { minWidth: `${data.length * 40}px` } : undefined}>
        {data.map((d) => {
          const showYear = d.key.endsWith('-01') || data.length <= 1;
          return (
            <a key={d.key} class="bar" href={hrefFor(d.key)} aria-label={`${monthShort(d.key)} ${d.key.slice(0, 4)}: ${d.count}`}>
              <span class="bar__value">{d.count > 0 ? d.count : ''}</span>
              <span class="bar__track">
                <span class="bar__fill" style={{ height: `${(d.count / max) * 100}%`, background: color }} />
              </span>
              <span class="bar__label">
                {monthShort(d.key)}
                {showYear && wide && <small>{d.key.slice(2, 4)}</small>}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
