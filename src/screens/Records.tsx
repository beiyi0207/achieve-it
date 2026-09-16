import { useMemo, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { TagChip } from '../components/TagChip';
import { SegmentedControl } from '../components/SegmentedControl';
import { EmptyState } from '../components/EmptyState';
import { Dialog } from '../components/Dialog';
import { IconCheck, IconChevron, IconFilter, IconSearch, IconSort, IconX } from '../components/Icons';
import { L, achievements, childById, childName, settings, sortedChildren, sortedTags, tagById } from '../store';
import { navigate, useRoute } from '../router';
import { filterAchievements, groupAchievements, queryFromView, sortAchievements, viewFromQuery, type RecordFilter, type RecordView } from '../lib/filters';
import { formatDate, type RangePreset } from '../lib/dates';
import type { GroupBy, SortDirection, SortKey } from '../types';

const RANGE_LABELS: Record<RangePreset, string> = {
  week: 'This week',
  month: 'This month',
  term: 'This term',
  year: 'This year',
  all: 'All dates',
  custom: 'Custom range',
};

export function RecordsScreen() {
  const route = useRoute();
  const s = settings.value;
  const view = useMemo(() => viewFromQuery(route.query, s), [route.query, s]);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const ctx = useMemo(
    () => ({ children: childById.value, tags: tagById.value, terms: s.termDates, unknownChildLabel: `Unknown ${L.value.one}` }),
    [childById.value, tagById.value, s.termDates, L.value],
  );

  const all = achievements.value;
  const results = useMemo(() => sortAchievements(filterAchievements(all, view.filter, ctx), view.sort, ctx), [all, view, ctx]);
  const sections = useMemo(() => groupAchievements(results, view.groupBy, ctx), [results, view.groupBy, ctx]);

  function update(next: RecordView) {
    const q = queryFromView(next, s).toString();
    navigate(`/records${q ? `?${q}` : ''}`, { replace: true });
  }
  const setFilter = (patch: Partial<RecordFilter>) => update({ ...view, filter: { ...view.filter, ...patch } });

  const f = view.filter;
  const hasTerm = !!s.termDates?.length;
  const activeChips: { key: string; label: string; onClear: () => void }[] = [
    ...f.childIds.map((id) => ({
      key: `c-${id}`,
      label: childById.value.get(id)?.firstName ?? `Unknown ${L.value.one}`,
      onClear: () => setFilter({ childIds: f.childIds.filter((x) => x !== id) }),
    })),
    ...f.tagIds.map((id) => ({
      key: `t-${id}`,
      label: tagById.value.get(id)?.name ?? 'Unknown tag',
      onClear: () => setFilter({ tagIds: f.tagIds.filter((x) => x !== id) }),
    })),
    ...(f.range !== 'all'
      ? [
          {
            key: 'range',
            label:
              f.range === 'custom'
                ? `${f.from ? formatDate(f.from) : 'Start'} – ${f.to ? formatDate(f.to) : 'now'}`
                : RANGE_LABELS[f.range],
            onClear: () => setFilter({ range: 'all', from: undefined, to: undefined }),
          },
        ]
      : []),
  ];

  return (
    <>
      <Header
        title="Records"
        right={
          <>
            <button type="button" class="icon-btn" aria-label="Sort" onClick={() => setSortOpen(true)}>
              <IconSort />
            </button>
            <button type="button" class={`icon-btn ${activeChips.length ? 'icon-btn--active' : ''}`} aria-label="Filter" onClick={() => setFilterOpen(true)}>
              <IconFilter />
            </button>
          </>
        }
      />
      <div class="container stack">
        <label class="search">
          <IconSearch size={18} />
          <input
            type="search"
            placeholder="Search title or description"
            value={f.q}
            onInput={(e) => setFilter({ q: (e.target as HTMLInputElement).value })}
          />
        </label>

        {activeChips.length > 0 && (
          <div class="chip-scroll">
            {activeChips.map((c) => (
              <button key={c.key} type="button" class="chip chip--active" onClick={c.onClear} aria-label={`Clear ${c.label}`}>
                {c.label}
                <span class="chip__x">
                  <IconX size={14} />
                </span>
              </button>
            ))}
            {activeChips.length > 1 && (
              <button type="button" class="chip" onClick={() => setFilter({ childIds: [], tagIds: [], range: 'all', from: undefined, to: undefined })}>
                Clear all
              </button>
            )}
          </div>
        )}

        <SegmentedControl<GroupBy>
          label="Group by"
          value={view.groupBy}
          onChange={(g) => update({ ...view, groupBy: g })}
          options={[
            { value: 'date', label: 'Date' },
            { value: 'child', label: L.value.One },
            { value: 'tag', label: 'Tag' },
            { value: 'none', label: 'None' },
          ]}
        />

        {all.length === 0 ? (
          <EmptyState
            title="No records yet"
            message="Tap the plus button to record the first achievement."
            action={
              <a class="btn btn--primary" href="#/new" style={{ width: 'auto' }}>
                New achievement
              </a>
            }
          />
        ) : results.length === 0 ? (
          <EmptyState title="Nothing matches" message="Try clearing a filter or changing the search." />
        ) : (
          sections.map((sec) => (
            <section key={sec.key} class="group">
              <div class="group__head" style={{ '--group': sec.color } as Record<string, string>}>
                <span class="group__dot" />
                {sec.href ? <a href={sec.href}>{sec.title}</a> : <span>{sec.title}</span>}
                <span class="group__count">{sec.items.length}</span>
              </div>
              <div class="list">
                {sec.items.map((a) => {
                  const child = childById.value.get(a.childId);
                  const tags = a.tags.map((id) => tagById.value.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
                  return (
                    <a key={a.id} class="list-row record-row" href={`#/records/${a.id}`}>
                      <Avatar config={child?.avatar} firstName={child?.firstName} lastName={child?.lastName} size={36} />
                      <div class="grow">
                        <div class="list-row__title truncate">{a.title}</div>
                        <div class="list-row__sub record-row__meta">
                          <span>
                            {childName(child)} · {formatDate(a.date)}
                          </span>
                          {tags.map((t) => (
                            <TagChip key={t.id} tag={t} size="sm" />
                          ))}
                        </div>
                      </div>
                      <IconChevron class="chevron" />
                    </a>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <Dialog open={sortOpen} onClose={() => setSortOpen(false)} variant="sheet" label="Sort records">
        <h2>Sort by</h2>
        <div class="list">
          {(
            [
              ['date', 'Date'],
              ['child', L.value.One],
              ['tag', 'Tag'],
            ] as [SortKey, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" class="list-row" onClick={() => update({ ...view, sort: { ...view.sort, sort: k } })}>
              <span class="grow">{label}</span>
              {view.sort.sort === k && <IconCheck />}
            </button>
          ))}
        </div>
        <h2>Direction</h2>
        <SegmentedControl<SortDirection>
          value={view.sort.direction}
          onChange={(d) => update({ ...view, sort: { ...view.sort, direction: d } })}
          options={[
            { value: 'desc', label: view.sort.sort === 'date' ? 'Newest first' : 'Z to A' },
            { value: 'asc', label: view.sort.sort === 'date' ? 'Oldest first' : 'A to Z' },
          ]}
        />
        <button type="button" class="btn btn--primary" onClick={() => setSortOpen(false)}>
          Done
        </button>
      </Dialog>

      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} variant="sheet" label="Filter records">
        <h2>{L.value.Many}</h2>
        <div class="chip-row">
          {sortedChildren.value.map((k) => {
            const on = f.childIds.includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                class={`chip ${on ? 'chip--active' : ''}`}
                aria-pressed={on}
                onClick={() => setFilter({ childIds: on ? f.childIds.filter((x) => x !== k.id) : [...f.childIds, k.id] })}
              >
                <Avatar config={k.avatar} firstName={k.firstName} lastName={k.lastName} size={22} />
                {k.firstName}
              </button>
            );
          })}
          {sortedChildren.value.length === 0 && <span class="muted small">No {L.value.many} yet.</span>}
        </div>

        <h2>Tags</h2>
        <div class="chip-row">
          {sortedTags.value.map((t) => {
            const on = f.tagIds.includes(t.id);
            return (
              <TagChip
                key={t.id}
                tag={t}
                active={on}
                onClick={() => setFilter({ tagIds: on ? f.tagIds.filter((x) => x !== t.id) : [...f.tagIds, t.id] })}
              />
            );
          })}
          {sortedTags.value.length === 0 && <span class="muted small">No tags yet.</span>}
        </div>

        <h2>Dates</h2>
        <div class="chip-row">
          {(['week', 'month', 'term', 'year', 'all', 'custom'] as RangePreset[]).map((r) => {
            const on = f.range === r;
            const disabled = r === 'term' && !hasTerm;
            return (
              <button
                key={r}
                type="button"
                class={`chip ${on ? 'chip--active' : ''}`}
                aria-pressed={on}
                disabled={disabled}
                title={disabled ? 'Set term dates in Settings' : undefined}
                onClick={() => setFilter({ range: r })}
              >
                {RANGE_LABELS[r]}
              </button>
            );
          })}
        </div>
        {!hasTerm && (
          <p class="muted small">
            “This term” needs term dates. <a href="#/settings/terms">Set them in Settings.</a>
          </p>
        )}
        {f.range === 'custom' && (
          <div class="row">
            <div class="field grow">
              <label for="from">From</label>
              <input id="from" class="input" type="date" value={f.from ?? ''} onInput={(e) => setFilter({ from: (e.target as HTMLInputElement).value || undefined })} />
            </div>
            <div class="field grow">
              <label for="to">To</label>
              <input id="to" class="input" type="date" value={f.to ?? ''} onInput={(e) => setFilter({ to: (e.target as HTMLInputElement).value || undefined })} />
            </div>
          </div>
        )}

        <div class="row">
          <button type="button" class="btn btn--ghost" onClick={() => setFilter({ childIds: [], tagIds: [], range: 'all', from: undefined, to: undefined })}>
            Clear
          </button>
          <button type="button" class="btn btn--primary" onClick={() => setFilterOpen(false)}>
            Show {results.length} {results.length === 1 ? 'record' : 'records'}
          </button>
        </div>
      </Dialog>
    </>
  );
}
