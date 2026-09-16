import { useRoute } from './router';
import { TabBar } from './components/TabBar';
import { Fab } from './components/Fab';
import { ToastHost } from './components/Toast';
import { KidsScreen } from './screens/Kids';
import { ChildEditScreen } from './screens/ChildEdit';
import { ChildProfileScreen } from './screens/ChildProfile';
import { RecordsScreen } from './screens/Records';
import { RecordDetailScreen } from './screens/RecordDetail';
import { AchievementEditorScreen } from './screens/AchievementEditor';
import { StatsScreen } from './screens/Stats';
import { SettingsScreen } from './screens/Settings';
import { NotFoundScreen } from './screens/NotFound';

function Screen() {
  const r = useRoute();
  const [root, second, third] = r.segments;
  switch (root) {
    case undefined:
    case '':
      return <KidsScreen />;
    case 'kids':
      if (!second) return <KidsScreen />;
      if (second === 'new') return <ChildEditScreen key="new" />;
      if (third === 'edit') return <ChildEditScreen key={second} childId={second} />;
      return <ChildProfileScreen childId={second} />;
    case 'records':
      if (second) return <RecordDetailScreen achievementId={second} />;
      return <RecordsScreen />;
    case 'new':
      return <AchievementEditorScreen key="new" />;
    case 'edit':
      if (!second) return <NotFoundScreen />;
      return <AchievementEditorScreen key={second} achievementId={second} />;
    case 'stats':
      return <StatsScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <NotFoundScreen />;
  }
}

/** Full-screen flows (editors, builders) hide the tab bar and FAB. */
function isFullScreen(segments: string[]): boolean {
  const [root, second, third] = segments;
  if (root === 'new' || root === 'edit') return true;
  if (root === 'kids' && (second === 'new' || third === 'edit' || third === 'avatar')) return true;
  return false;
}

export function App() {
  const r = useRoute();
  const full = isFullScreen(r.segments);
  return (
    <div class={`app ${full ? 'app--full' : ''}`}>
      <main class="screen">
        <Screen />
      </main>
      {!full && (
        <>
          <Fab />
          <TabBar />
        </>
      )}
      <ToastHost />
    </div>
  );
}
