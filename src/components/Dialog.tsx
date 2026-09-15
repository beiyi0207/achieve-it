import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** "center" for confirmations, "sheet" for bottom sheets. */
  variant?: 'center' | 'sheet';
  label?: string;
  children: ComponentChildren;
};

/** Native <dialog> wrapper. Closes on backdrop tap and Escape. */
export function Dialog({ open, onClose, variant = 'center', label, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      class={variant === 'sheet' ? 'sheet' : 'dialog'}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div class={variant === 'sheet' ? 'sheet__box' : 'dialog__box'}>
        {variant === 'sheet' && <div class="sheet__handle" aria-hidden="true" />}
        {open && children}
      </div>
    </dialog>
  );
}

export type ConfirmAction = {
  label: string;
  kind?: 'primary' | 'danger' | 'default';
  onClick: () => void | Promise<void>;
};

type ConfirmProps = {
  open: boolean;
  title: string;
  message?: ComponentChildren;
  actions: ConfirmAction[];
  cancelLabel?: string;
  onClose: () => void;
};

export function ConfirmDialog({ open, title, message, actions, cancelLabel = 'Cancel', onClose }: ConfirmProps) {
  return (
    <Dialog open={open} onClose={onClose} label={title}>
      <h2>{title}</h2>
      {message && <div class="muted small">{message}</div>}
      <div class="dialog__actions">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            class={`btn ${a.kind === 'primary' ? 'btn--primary' : a.kind === 'danger' ? 'btn--danger' : ''}`}
            onClick={async () => {
              await a.onClick();
              onClose();
            }}
          >
            {a.label}
          </button>
        ))}
        <button type="button" class="btn btn--ghost" onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </Dialog>
  );
}
