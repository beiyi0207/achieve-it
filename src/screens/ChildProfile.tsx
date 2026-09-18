import { useMemo } from 'preact/hooks';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { TagChip } from '../components/TagChip';
import { IconBack, IconEdit, IconPlus } from '../components/Icons';
import { L, achievements, childById, childName, tagById } from '../store';
import { back } from '../router';
import { formatDate, monthKey, monthLabel } from '../lib/dates';
import { cssHex, tagHex } from '../lib/palette';
import { recordsHref } from '../lib/filters';
import type { Achievement, Tag } from '../types';

type Props = { childId: string };

export function ChildProfileScreen({ childId }: Props) {
  const child = childById.value.get(childId);
  const all = achievements.value;
  const tags = tagById.value;

  const mine = useMemo(
    () => all.filter((a) => a.childId === childId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt))),
    [all, childId],
  );

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of mine) for (const t of a.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()]
      .map(([id, count]) => ({ tag: tags.get(id), count }))
      .filter((x): x is { tag: Tag; count: number } => !!x.tag)
      .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name));
  }, [mine, tags]);

  const months = useMemo(() => {
    const out: { key: string; items: Achievement[] }[] = [];
    for (const a of mine) {
      const k = monthKey(a.date);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(a);
      else out.push({ key: k, items: [a] });
    }
    return out;
  }, [mine]);

  if (!child) {
    return (
      <>
        <Header
          variant="centered"
          title={L.value.One}
          left={
            <a class="icon-btn" href="#/kids" aria-label="Back">
              <IconBack />
            </a>
          }
        />
        <div class="container">
          <p class="muted">This {L.value.one} no longer exists.</p>
        </div>
      </>
    );
  }

  const accent = cssHex(child.avatar.background);

  return (
    <>
      <Header
        variant="centered"
        title={childName(child)}
        left={
          <button type="button" class="icon-btn" aria-label="Back" onClick={() => back('/kids')}>
            <IconBack />
          </button>
        }
        right={
          <a class="icon-btn" href={`#/kids/${child.id}/edit`} aria-label="Edit kid">
            <IconEdit />
          </a>
        }
      />
      <div class="container stack">
        <div class="profile-hero" style={{ '--ring': accent } as Record<string, string>}>
          <Avatar config={child.avatar} firstName={child.firstName} lastName={child.lastName} size={112} />
          <h2>{childName(child)}</h2>
          <p class="muted">
            {mine.length} {mine.length === 1 ? 'achievement' : 'achievements'}
          </p>
        </div>

        {tagCounts.length > 0 && (
          <div class="chip-row" style={{ justifyContent: 'center' }}>
            {tagCounts.map(({ tag, count }) => (
              <TagChip key={tag.id} tag={tag} count={count} href={recordsHref({ childIds: [child.id], tagIds: [tag.id] })} />
            ))}
          </div>
        )}

        <a class="btn btn--primary" href={`#/new?child=${child.id}`}>
          <IconPlus size={20} /> Add achievement for {child.firstName}
        </a>

        {months.length === 0 ? (
          <p class="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
            No achievements recorded yet.
          </p>
        ) : (
          months.map((m) => (
            <section key={m.key} class="timeline">
              <h3 class="section-title">{monthLabel(m.key)}</h3>
              <div class="list">
                {m.items.map((a) => {
                  const primary = a.tags.map((id) => tags.get(id)).find((t): t is Tag => !!t);
                  const rowTags = a.tags.map((id) => tags.get(id)).filter((t): t is Tag => !!t);
                  return (
                    <a
                      key={a.id}
                      class="list-row timeline-row"
                      href={`#/records/${a.id}`}
                      style={{ '--bar': primary ? tagHex(primary.color) : accent } as Record<string, string>}
                    >
                      <div class="grow">
                        <div class="list-row__title">{a.title}</div>
                        <div class="list-row__sub record-row__meta">
                          <span>{formatDate(a.date)}</span>
                          {rowTags.map((t) => (
                            <TagChip key={t.id} tag={t} size="sm" />
                          ))}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
