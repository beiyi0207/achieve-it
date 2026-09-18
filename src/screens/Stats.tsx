import { useMemo, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { MetricCard } from '../components/MetricCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { BarChart } from '../components/BarChart';
import { HBarList } from '../components/HBarList';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { TagChip } from '../components/TagChip';
import { IconCheck, IconX } from '../components/Icons';
import { L, achievements, childById, childName, children, settings, sortedChildren, tags } from '../store';
import { navigate, useRoute } from '../router';
import { computeStats, monthRange } from '../core/stats';
import { formatDate, monthLabel, rangeFor, type RangePreset } from '../core/dates';
import { recordsHref } from '../core/filters';
import { cssHex, tagHex } from '../core/palette';

type StatsRange = 'month' | 'term' | 'year' | 'all';

export function StatsScreen() {
  const route = useRoute();
  const s = settings.value;
  const hasTerm = !!s.termDates?.length;
  const childId = route.query.get('child') || null;
  const rawRange = route.query.get('range') as StatsRange | null;
  const range: StatsRange = rawRange && ['month', 'term', 'year', 'all'].includes(rawRange) ? rawRange : 'month';
  const [pickerOpen, setPickerOpen] = useState(false);

  const child = childId ? childById.value.get(childId) : undefined;
  const dateRange = useMemo(() => rangeFor(range as RangePreset, { terms: s.termDates }), [range, s.termDates]);

  const stats = useMemo(
    () => computeStats({ achievements: achievements.value, children: children.value, tags: tags.value, range: dateRange, childId: child?.id }),
    [achievements.value, children.value, tags.value, dateRange, child?.id],
  );

  function setQuery(patch: { child?: string | null; range?: StatsRange }) {
    const q = new URLSearchParams();
    const c = patch.child === undefined ? childId : patch.child;
    const r = patch.range ?? range;
    if (c) q.set('child', c);
    if (r !== 'month') q.set('range', r);
    const str = q.toString();
    navigate(`/stats${str ? `?${str}` : ''}`, { replace: true });
  }

  const baseFilter = { childIds: child ? [child.id] : [], range: range === 'all' ? undefined : (range as RangePreset) };
  const rangeLabel = range === 'month' ? 'this month' : range === 'term' ? 'this term' : range === 'year' ? 'this year' : 'all time';
  const prevLabel = range === 'month' ? 'vs last month' : range === 'term' ? 'vs last term' : range === 'year' ? 'vs last year' : '';

  const noData = achievements.value.length === 0;

  return (
    <>
      <Header
        title="Stats"
        right={
          <button type="button" class={`chip ${child ? 'chip--active' : ''}`} onClick={() => setPickerOpen(true)} aria-haspopup="dialog">
            {child ? (
              <>
                <Avatar config={child.avatar} firstName={child.firstName} lastName={child.lastName} size={22} />
                {child.firstName}
                <span
                  class="chip__x"
                  role="button"
                  aria-label={`Show all ${L.value.many}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery({ child: null });
                  }}
                >
                  <IconX size={14} />
                </span>
              </>
            ) : (
              `All ${L.value.many}`
            )}
          </button>
        }
      />
      <div class="container stack">
        <SegmentedControl<StatsRange>
          label="Range"
          value={range}
          onChange={(r) => setQuery({ range: r })}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'term', label: 'Term' },
            { value: 'year', label: 'Year' },
            { value: 'all', label: 'All' },
          ]}
        />
        {range === 'term' && !hasTerm && (
          <p class="muted small">
            No term dates set, so “Term” shows all time. <a href="#/settings/terms">Set term dates</a>
          </p>
        )}

        {noData ? (
          <EmptyState title="No stats yet" message="Record a few achievements and this screen will fill up." />
        ) : (
          <>
            <div class="metric-grid">
              <MetricCard value={stats.total} label={`Achievements ${rangeLabel}`} delta={stats.delta} deltaLabel={prevLabel} href={recordsHref(baseFilter)} />
              {child ? (
                <MetricCard value={stats.streak} label={stats.streak === 1 ? 'Month streak' : 'Month streak'} />
              ) : (
                <MetricCard value={stats.averagePerKid} label={`Average per ${L.value.one}`} />
              )}
              <MetricCard value={stats.tagsUsed} label="Tags used" />
              <MetricCard
                value={stats.mostActiveMonth ? monthLabel(stats.mostActiveMonth.key, 'short') : '–'}
                label="Most active month"
                href={stats.mostActiveMonth ? recordsHref({ ...baseFilter, range: 'custom', ...monthRange(stats.mostActiveMonth.key) }) : undefined}
              />
            </div>

            <section class="stack">
              <h2 class="section-title">Per month</h2>
              <div class="card">
                <BarChart
                  data={stats.perMonth}
                  color={child ? cssHex(child.avatar.background) : 'var(--accent)'}
                  hrefFor={(key) => recordsHref({ childIds: baseFilter.childIds, range: 'custom', ...monthRange(key) })}
                />
              </div>
            </section>

            <section class="stack">
              <h2 class="section-title">{child ? 'By tag, vs previous period' : 'By tag'}</h2>
              {stats.perTag.length === 0 ? (
                <p class="muted small">No tagged records in this range.</p>
              ) : (
                <HBarList
                  items={stats.perTag.map((t) => ({
                    key: t.tag.id,
                    label: t.tag.name,
                    count: t.count,
                    color: tagHex(t.tag.color),
                    href: recordsHref({ ...baseFilter, tagIds: [t.tag.id] }),
                    trailing:
                      child && stats.previousTotal !== null ? (
                        <span class={`growth ${t.count - t.previous > 0 ? 'growth--up' : t.count - t.previous < 0 ? 'growth--down' : ''}`}>
                          {t.count - t.previous > 0 ? '+' : ''}
                          {t.count - t.previous}
                        </span>
                      ) : undefined,
                  }))}
                />
              )}
            </section>

            {!child && (
              <section class="stack">
                <h2 class="section-title">By {L.value.one}</h2>
                <HBarList
                  items={stats.perKid.map((k) => ({
                    key: k.child.id,
                    label: childName(k.child),
                    count: k.count,
                    color: cssHex(k.child.avatar.background),
                    href: recordsHref({ ...baseFilter, childIds: [k.child.id] }),
                    leading: <Avatar config={k.child.avatar} firstName={k.child.firstName} lastName={k.child.lastName} size={32} />,
                  }))}
                />
                <p class="muted small">Listed alphabetically.</p>
              </section>
            )}

            {!child && stats.quietKids.length > 0 && (
              <section class="nudge">
                <h3>Quiet lately</h3>
                <p class="small">No records in the last 30 days for:</p>
                <div class="chip-row">
                  {stats.quietKids.map((k) => (
                    <a key={k.id} class="chip" href={`#/kids/${k.id}`}>
                      <Avatar config={k.avatar} firstName={k.firstName} lastName={k.lastName} size={22} />
                      {k.firstName}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {child && (
              <section class="stack">
                <h2 class="section-title">Firsts</h2>
                {stats.firsts.length === 0 ? (
                  <p class="muted small">No records tagged “First” in this range.</p>
                ) : (
                  <div class="list">
                    {stats.firsts.map((a) => (
                      <a key={a.id} class="list-row" href={`#/records/${a.id}`}>
                        <div class="grow">
                          <div class="list-row__title">{a.title}</div>
                          <div class="list-row__sub record-row__meta">
                            <span>{formatDate(a.date)}</span>
                            {a.tags
                              .map((id) => tags.value.find((t) => t.id === id))
                              .filter((t): t is NonNullable<typeof t> => !!t)
                              .map((t) => (
                                <TagChip key={t.id} tag={t} size="sm" />
                              ))}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} variant="sheet" label={`Choose ${L.value.one}`}>
        <h2>Show stats for</h2>
        <div class="list">
          <button
            type="button"
            class="list-row"
            onClick={() => {
              setQuery({ child: null });
              setPickerOpen(false);
            }}
          >
            <span class="grow">All {L.value.many}</span>
            {!child && <IconCheck />}
          </button>
          {sortedChildren.value.map((k) => (
            <button
              key={k.id}
              type="button"
              class="list-row"
              onClick={() => {
                setQuery({ child: k.id });
                setPickerOpen(false);
              }}
            >
              <Avatar config={k.avatar} firstName={k.firstName} lastName={k.lastName} size={36} />
              <span class="grow">{childName(k)}</span>
              {child?.id === k.id && <IconCheck />}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
