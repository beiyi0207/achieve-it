import { toastMessage } from '../store';

export function ToastHost() {
  const msg = toastMessage.value;
  if (!msg) return null;
  return (
    <div class="toast-host" role="status" aria-live="polite">
      <div class="toast">{msg}</div>
    </div>
  );
}
