import { signal } from '@preact/signals';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: BeforeInstallPromptEvent | null = null;

/** True when the browser has offered an install prompt we can trigger. */
export const installAvailable = signal(false);
export const installed = signal(false);

/** iOS Safari never fires beforeinstallprompt; installing is a manual "Add to Home Screen". */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

if (typeof window !== 'undefined') {
  installed.value = isStandalone();
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    installAvailable.value = true;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installAvailable.value = false;
    installed.value = true;
  });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null;
  installAvailable.value = false;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  if (outcome === 'dismissed') {
    // Chrome allows re-prompting later; keep the event so the button stays visible.
    deferred = ev;
    installAvailable.value = true;
  }
  return outcome;
}
