import { useMemo } from 'preact/hooks';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { TagChip } from '../components/TagChip';
import { IconBack, IconCopy, IconEdit } from '../components/Icons';
import { L, achievements, childById, childName, tagById } from '../store';
import { back } from '../router';
import { formatDate, formatDateTime } from '../lib/dates';
import { renderMarkdown } from '../lib/markdown';

type Props = { achievementId: string };

export function RecordDetailScreen({ achievementId }: Props) {
  const a = achievements.value.find((x) => x.id === achievementId);
  const html = useMemo(() => (a ? renderMarkdown(a.description) : ''), [a?.description]);

  if (!a) {
    return (
      <>
        <Header
          variant="centered"
          title="Record"
          left={
            <a class="icon-btn" href="#/records" aria-label="Back">
              <IconBack />
            </a>
          }
        />
        <div class="container">
          <p class="muted">This record no longer exists.</p>
        </div>
      </>
    );
  }

  const child = childById.value.get(a.childId);
  const tags = a.tags.map((id) => tagById.value.get(id)).filter((t): t is NonNullable<typeof t> => !!t);

  return (
    <>
      <Header
        variant="centered"
        title="Achievement"
        left={
          <button type="button" class="icon-btn" aria-label="Back" onClick={() => back('/records')}>
            <IconBack />
          </button>
        }
        right={
          <>
            <a class="icon-btn" href={`#/new?from=${a.id}`} aria-label="Duplicate achievement" title="Duplicate">
              <IconCopy />
            </a>
            <a class="icon-btn" href={`#/edit/${a.id}`} aria-label="Edit achievement" title="Edit">
              <IconEdit />
            </a>
          </>
        }
      />
      <div class="container stack">
        <h1 style={{ fontSize: 24 }}>{a.title}</h1>
        <a class="row" href={child ? `#/kids/${child.id}` : undefined} style={{ color: 'inherit' }}>
          <Avatar config={child?.avatar} firstName={child?.firstName} lastName={child?.lastName} size={40} />
          <div class="grow">
            <div class="list-row__title">{childName(child)}</div>
            <div class="list-row__sub">{formatDate(a.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </a>
        {tags.length > 0 && (
          <div class="chip-row">
            {tags.map((t) => (
              <TagChip key={t.id} tag={t} href={`#/records?tag=${t.id}`} />
            ))}
          </div>
        )}
        {html ? <div class="markdown card" dangerouslySetInnerHTML={{ __html: html }} /> : <p class="muted">No description.</p>}
        <a class="btn" href={`#/new?from=${a.id}`}>
          <IconCopy size={18} /> Duplicate for another {L.value.one} or day
        </a>
        <p class="muted small">
          Added {formatDateTime(a.createdAt)}
          {a.updatedAt !== a.createdAt && <> · Updated {formatDateTime(a.updatedAt)}</>}
        </p>
      </div>
    </>
  );
}
