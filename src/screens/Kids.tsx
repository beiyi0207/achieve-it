import { useMemo, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { MetricCard } from '../components/MetricCard';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/Dialog';
import { SwipeRow } from '../components/SwipeRow';
import { IconAddPerson, IconChevron, IconSearch, IconX } from '../components/Icons';
import { L, achievements, childName, removeChild, sortedChildren, toast } from '../store';
import { monthKey, todayIso } from '../lib/dates';
import type { Child } from '../types';

export function KidsScreen() {
  const kids = sortedChildren.value;
  const all = achievements.value;
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState<Child | null>(null);

  const countByChild = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of all) m.set(a.childId, (m.get(a.childId) ?? 0) + 1);
    return m;
  }, [all]);

  const thisMonth = useMemo(() => {
    const k = monthKey(todayIso());
    return all.filter((a) => monthKey(a.date) === k).length;
  }, [all]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return kids;
    return kids.filter((k) => childName(k).toLowerCase().includes(needle));
  }, [kids, q]);

  const pendingCount = pending ? countByChild.get(pending.id) ?? 0 : 0;

  return (
    <>
      <Header
        title={`Your ${L.value.many}`}
        right={
          <>
            <button
              type="button"
              class="icon-btn"
              aria-label={searchOpen ? 'Close search' : `Search ${L.value.many}`}
              aria-pressed={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v);
                setQ('');
              }}
            >
              {searchOpen ? <IconX size={22} /> : <IconSearch />}
            </button>
            <a class="icon-btn" href="#/kids/new" aria-label={`Add ${L.value.one}`}>
              <IconAddPerson />
            </a>
          </>
        }
      />
      <div class="container stack">
        {searchOpen && (
          <label class="search">
            <IconSearch size={18} />
            <input
              type="search"
              placeholder="Search by name"
              value={q}
              onInput={(e) => setQ((e.target as HTMLInputElement).value)}
              autoFocus
            />
          </label>
        )}

        <div class="metric-grid">
          <MetricCard value={kids.length} label={kids.length === 1 ? L.value.One : L.value.Many} />
          <MetricCard value={thisMonth} label="Achievements this month" href="#/records?range=month" />
        </div>

        {kids.length === 0 ? (
          <EmptyState
            title={`No ${L.value.many} yet`}
            message={`Add the first ${L.value.one} to start recording their achievements.`}
            action={
              <a class="btn btn--primary" href="#/kids/new" style={{ width: 'auto' }}>
                Add a {L.value.one}
              </a>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState title="No matches" message="Try a different name." />
        ) : (
          <div class="list">
            {visible.map((k) => (
              <SwipeRow key={k.id} onAction={() => setPending(k)}>
                <a class="list-row" href={`#/kids/${k.id}`}>
                  <Avatar config={k.avatar} firstName={k.firstName} lastName={k.lastName} size={48} />
                  <div class="grow">
                    <div class="list-row__title truncate">{childName(k)}</div>
                    <div class="list-row__sub">
                      {countByChild.get(k.id) ?? 0} {countByChild.get(k.id) === 1 ? 'achievement' : 'achievements'}
                    </div>
                  </div>
                  <IconChevron class="chevron" />
                </a>
              </SwipeRow>
            ))}
          </div>
        )}
        {kids.length > 0 && <p class="muted small" style={{ textAlign: 'center' }}>Swipe left on a {L.value.one} to delete.</p>}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `Delete ${pending.firstName}?` : ''}
        message={
          pendingCount > 0
            ? `${childName(pending ?? undefined)} has ${pendingCount} ${pendingCount === 1 ? 'record' : 'records'}. Choose what happens to them.`
            : 'This cannot be undone.'
        }
        actions={
          pendingCount > 0
            ? [
                {
                  label: `Delete ${L.value.one} and records`,
                  kind: 'danger',
                  onClick: async () => {
                    await removeChild(pending!.id, 'delete');
                    toast(`${L.value.One} and records deleted`);
                  },
                },
                {
                  label: `Delete ${L.value.one}, keep records`,
                  onClick: async () => {
                    await removeChild(pending!.id, 'keep');
                    toast(`${L.value.One} deleted. Records kept.`);
                  },
                },
              ]
            : [
                {
                  label: `Delete ${L.value.one}`,
                  kind: 'danger',
                  onClick: async () => {
                    await removeChild(pending!.id, 'delete');
                    toast(`${L.value.One} deleted`);
                  },
                },
              ]
        }
      />
    </>
  );
}
