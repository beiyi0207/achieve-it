import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { initStore, replaceAllData, snapshot } from './store';
import './lib/install';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

registerSW({ immediate: true });

async function boot() {
  await initStore();
  if (import.meta.env.DEV && !location.search.includes('noseed')) {
    const s = snapshot();
    if (s.children.length === 0 && s.achievements.length === 0) {
      const { buildSeed } = await import('./seed');
      await replaceAllData(buildSeed());
    }
  }
  render(<App />, document.getElementById('app')!);
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('app')!.textContent = 'Could not open the local database. Check that your browser allows site data.';
});
