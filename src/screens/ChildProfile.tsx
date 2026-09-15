import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { IconBack, IconEdit } from '../components/Icons';
import { childById, childName } from '../store';
import { back } from '../router';

type Props = { childId: string };

export function ChildProfileScreen({ childId }: Props) {
  const child = childById.value.get(childId);
  if (!child) {
    return (
      <>
        <Header variant="centered" title="Kid" left={<a class="icon-btn" href="#/kids" aria-label="Back"><IconBack /></a>} />
        <div class="container">
          <p class="muted">This kid no longer exists.</p>
        </div>
      </>
    );
  }
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
      <div class="container stack" style={{ alignItems: 'center', paddingTop: 8 }}>
        <Avatar config={child.avatar} firstName={child.firstName} lastName={child.lastName} size={112} />
        <h2>{childName(child)}</h2>
        <p class="muted">Age {child.age}</p>
        <p class="muted small">Timeline coming soon.</p>
      </div>
    </>
  );
}
