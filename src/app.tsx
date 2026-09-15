import { useRoute } from './router';
import { TabBar } from './components/TabBar';
import { Fab } from './components/Fab';
import { KidsScreen } from './screens/Kids';
import { RecordsScreen } from './screens/Records';
import { StatsScreen } from './screens/Stats';
import { SettingsScreen } from './screens/Settings';
import { NotFoundScreen } from './screens/NotFound';

function Screen() {
  const r = useRoute();
  const [root] = r.segments;
  switch (root) {
    case undefined:
    case '':
    case 'kids':
      return <KidsScreen />;
    case 'records':
      return <RecordsScreen />;
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
  const [root, , third] = segments;
  if (root === 'new' || root === 'edit') return true;
  if (root === 'kids' && (segments[1] === 'new' || third === 'edit' || third === 'avatar')) return true;
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
    </div>
  );
}
