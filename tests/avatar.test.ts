import { describe, expect, it } from 'vitest';
import { NONE, STYLES, randomConfig, renderAvatarSvg, switchStyle, toDicebearOptions } from '../src/lib/avatar';

describe('avatar', () => {
  it('randomConfig is deterministic for a seed', () => {
    const a = randomConfig('lorelei', 'Maya Okafor');
    const b = randomConfig('lorelei', 'Maya Okafor');
    expect(a).toEqual(b);
    expect(a.hair).toMatch(/^variant\d\d$/);
    expect(a.background).toMatch(/^[0-9a-f]{6}$/);
  });

  it('only fills slots the style supports', () => {
    const n = randomConfig('notionists', 'x');
    expect(n.skin).toBe('');
    expect(n.hairColor).toBe('');
    expect(n.hair).not.toBe('');
  });

  it('maps extras to probability options', () => {
    const cfg = { ...randomConfig('lorelei', 'x'), extras: NONE };
    expect(toDicebearOptions(cfg).glassesProbability).toBe(0);
    const withGlasses = { ...cfg, extras: 'variant02' };
    const o = toDicebearOptions(withGlasses);
    expect(o.glassesProbability).toBe(100);
    expect(o.glasses).toEqual(['variant02']);
  });

  it('renders SVG for every style', () => {
    for (const s of STYLES) {
      const svg = renderAvatarSvg(randomConfig(s.id, 'Leo'), 64);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('</svg>');
    }
  });

  it('switchStyle keeps the background accent', () => {
    const a = randomConfig('lorelei', 'Priya');
    const b = switchStyle(a, 'openPeeps');
    expect(b.style).toBe('openPeeps');
    expect(b.background).toBe(a.background);
  });
});
