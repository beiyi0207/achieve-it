import type { ComponentChildren } from 'preact';

type Props = {
  title: string;
  message?: string;
  action?: ComponentChildren;
};

export function EmptyState({ title, message, action }: Props) {
  return (
    <div class="empty">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
