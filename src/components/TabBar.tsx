import { useRoute } from '../router';
import { L } from '../store';
import { IconKids, IconRecords, IconStats, IconSettings } from './Icons';

const tabs = [
  { id: 'kids', label: 'Kids', href: '#/kids', Icon: IconKids },
  { id: 'records', label: 'Records', href: '#/records', Icon: IconRecords },
  { id: 'stats', label: 'Stats', href: '#/stats', Icon: IconStats },
  { id: 'settings', label: 'Settings', href: '#/settings', Icon: IconSettings },
];

export function TabBar() {
  const r = useRoute();
  const active = r.segments[0] || 'kids';
  return (
    <nav class="tabbar" aria-label="Main">
      <div class="tabbar__inner">
        {tabs.map((t, i) => (
          <>
            {i === 2 && <div aria-hidden="true" />}
            <a
              key={t.id}
              class="tab"
              href={t.href}
              aria-current={active === t.id ? 'page' : undefined}
            >
              <t.Icon size={24} />
              <span>{t.id === 'kids' ? L.value.Many : t.label}</span>
            </a>
          </>
        ))}
      </div>
    </nav>
  );
}
