import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';

type Props = {
  children: ComponentChildren;
  actionLabel?: string;
  onAction: () => void;
};

const ACTION_W = 88;

/** Swipe-left-to-reveal row. Tapping the revealed action fires onAction. */
export function SwipeRow({ children, actionLabel = 'Delete', onAction }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; open: boolean; horizontal: boolean | null } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, open: offset !== 0, horizontal: null };
    setDragging(true);
  };

  const onTouchMove = (e: TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.horizontal === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!s.horizontal) return;
    const base = s.open ? -ACTION_W : 0;
    const next = Math.min(0, Math.max(-ACTION_W, base + dx));
    setOffset(next);
  };

  const onTouchEnd = () => {
    setDragging(false);
    setOffset((o) => (o < -ACTION_W / 2 ? -ACTION_W : 0));
    start.current = null;
  };

  return (
    <div class={`swipe-row ${dragging ? 'swipe-row--dragging' : ''}`}>
      <button
        type="button"
        class="swipe-row__action"
        tabIndex={offset === 0 ? -1 : 0}
        aria-hidden={offset === 0}
        onClick={() => {
          setOffset(0);
          onAction();
        }}
      >
        {actionLabel}
      </button>
      <div
        class="swipe-row__content"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={(e) => {
          // A tap while open just closes the row instead of navigating.
          if (offset !== 0) {
            e.preventDefault();
            e.stopPropagation();
            setOffset(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
