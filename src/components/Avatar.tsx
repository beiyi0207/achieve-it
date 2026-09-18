import { useMemo } from 'preact/hooks';
import type { AvatarConfig } from '../types';
import { initials, renderAvatarSvg } from '../lib/avatar';
import { cssHex } from '../core/palette';

type Props = {
  config?: AvatarConfig;
  firstName?: string;
  lastName?: string;
  size?: number;
  class?: string;
};

/**
 * Renders a child's avatar from its config. The SVG is generated on demand
 * (memoised only for the lifetime of this component instance) and never persisted.
 */
export function Avatar({ config, firstName = '', lastName = '', size = 44, class: cls = '' }: Props) {
  const svg = useMemo(() => {
    if (!config) return null;
    try {
      return renderAvatarSvg(config);
    } catch {
      return null;
    }
  }, [config]);

  const style = { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` };

  if (!svg) {
    return (
      <div class={`avatar ${cls}`} style={{ ...style, background: cssHex(config?.background ?? '') }} aria-hidden="true">
        {initials(firstName, lastName)}
      </div>
    );
  }
  return <div class={`avatar ${cls}`} style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
