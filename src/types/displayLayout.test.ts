import { describe, it, expect } from 'vitest';
import { DEFAULT_LAYOUT_CONFIG, sanitiseLayoutConfig } from './displayLayout';

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
