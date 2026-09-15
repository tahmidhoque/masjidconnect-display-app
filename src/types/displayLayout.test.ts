import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAYOUT_CONFIG,
  prayerStripHeightClassName,
  prayerStripHeightStyle,
  resolveContentZoneSize,
  resolveEffectiveZoneSize,
  sanitiseLayoutConfig,
  zoneSizeHint,
  type LayoutZone,
} from './displayLayout';

const baseConfig = () => JSON.parse(JSON.stringify(DEFAULT_LAYOUT_CONFIG));

describe('sanitiseLayoutConfig — masjid logo', () => {
  it('returns null logo when the config has none (older layouts)', () => {
    const result = sanitiseLayoutConfig(baseConfig());
    expect(result?.logo).toBeNull();
  });

  it('keeps a valid logo config', () => {
    const config = {
      ...baseConfig(),
      logo: { position: 'top-right', size: 'large', background: 'light' },
    };
    const result = sanitiseLayoutConfig(config);
    expect(result?.logo).toEqual({
      position: 'top-right',
      size: 'large',
      background: 'light',
    });
  });

  it('drops a logo config with an unknown position', () => {
    const config = {
      ...baseConfig(),
      logo: { position: 'bottom-middle', size: 'medium', background: 'none' },
    };
    const result = sanitiseLayoutConfig(config);
    expect(result?.logo).toBeNull();
  });

  it('falls back to defaults for invalid size and background', () => {
    const config = {
      ...baseConfig(),
      logo: { position: 'footer', size: 'huge', background: 'neon' },
    };
    const result = sanitiseLayoutConfig(config);
    expect(result?.logo).toEqual({
      position: 'footer',
      size: 'medium',
      background: 'none',
    });
  });
});

describe('sanitiseLayoutConfig — legacy zone options', () => {
  it('strips deprecated showMasjidName from header zone options', () => {
    const config = baseConfig();
    const headerZone = config.portrait.zones.find(
      (zone: { component: string }) => zone.component === 'header',
    );
    if (headerZone) {
      headerZone.options = { showMasjidName: true, showDate: false };
    }
    const result = sanitiseLayoutConfig(config);
    const sanitisedHeader = result?.portrait.zones.find((zone) => zone.component === 'header');
    expect(sanitisedHeader?.options?.showMasjidName).toBeUndefined();
    expect(sanitisedHeader?.options?.showDate).toBe(false);
  });
});

const zone = (
  component: LayoutZone['component'],
  extra: Partial<LayoutZone> = {},
): LayoutZone => ({
  id: `zone-${component}`,
  component,
  visible: true,
  size: 0,
  fontScale: 1,
  ...extra,
});

describe('resolveContentZoneSize', () => {
  it('leaves an explicit content weight unchanged', () => {
    const content = zone('content', { size: 5 });
    expect(resolveContentZoneSize(content, [content, zone('footer')])).toBe(5);
  });

  it('claims leftover space when Auto content is the only flexible zone', () => {
    const content = zone('content', { size: 0 });
    const zones = [
      content,
      zone('prayer-times', { size: 0 }),
      zone('jumuah-bar', { size: 3 }),
      zone('footer', { size: 0 }),
    ];
    expect(resolveContentZoneSize(content, zones)).toBe(1);
  });

  it('stays Auto when another non-jumuah zone is already flexible', () => {
    const content = zone('content', { size: 0 });
    const zones = [
      content,
      zone('prayer-times', { size: 3 }),
      zone('footer'),
    ];
    expect(resolveContentZoneSize(content, zones)).toBe(0);
  });
});

describe('resolveEffectiveZoneSize', () => {
  it('keeps the Jumu’ah bar intrinsic even when Small+ is selected', () => {
    const jumuah = zone('jumuah-bar', { size: 8 });
    const zones = [zone('content', { size: 5 }), jumuah, zone('footer')];
    expect(resolveEffectiveZoneSize(jumuah, zones, 'stack')).toBe(0);
  });

  it('maps Auto content to a flex weight of 1 in a typical landscape stack', () => {
    const content = zone('content', { size: 0 });
    const zones = [content, zone('prayer-times', { size: 0 }), zone('footer')];
    expect(resolveEffectiveZoneSize(content, zones, 'stack')).toBe(1);
  });
});

describe('prayerStripHeightClassName', () => {
  it('drops the tight clamp on Auto so the strip can sit at intrinsic height', () => {
    expect(prayerStripHeightClassName(0)).toBe('min-h-0');
    expect(prayerStripHeightStyle(0)).toBeUndefined();
  });

  it('maps Small/Medium/Large/Maximum to distinct height bands', () => {
    expect(prayerStripHeightClassName(3)).toBe('min-h-[6rem] max-h-[10rem]');
    expect(prayerStripHeightClassName(5)).toBe('min-h-[8rem] max-h-[12rem]');
    expect(prayerStripHeightClassName(8)).toBe('min-h-[10rem] max-h-[15rem]');
    expect(prayerStripHeightClassName(12)).toBe('min-h-[12rem] max-h-[18rem]');
    expect(prayerStripHeightStyle(3)).toEqual({ minHeight: '6rem', maxHeight: '10rem' });
    expect(prayerStripHeightStyle(12)).toEqual({ minHeight: '12rem', maxHeight: '18rem' });
  });

  it('snaps custom weights to the nearest preset band', () => {
    expect(prayerStripHeightClassName(4)).toBe('min-h-[6rem] max-h-[10rem]');
    expect(prayerStripHeightClassName(9)).toBe('min-h-[10rem] max-h-[15rem]');
  });
});

describe('zoneSizeHint', () => {
  it('tells admins the Jumu’ah bar is content-sized, not a flex grower', () => {
    expect(zoneSizeHint(8, 'jumuah-bar')).toMatch(/Jumu'ah times content/i);
  });

  it('mentions the prayer-bar height band for Small–Maximum', () => {
    expect(zoneSizeHint(5, 'prayer-times')).toMatch(/height band/i);
  });

  it('explains Auto content fills leftover space', () => {
    expect(zoneSizeHint(0, 'content')).toMatch(/leftover space/i);
  });
});
