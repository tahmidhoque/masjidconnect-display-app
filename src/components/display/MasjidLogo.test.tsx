import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContentLogoFrame, FooterLeadingLogo, LogoRail } from './MasjidLogo';
import type { DisplayLogoConfig } from '@/types/displayLayout';

const topLeftConfig: DisplayLogoConfig = {
  position: 'top-left',
  size: 'medium',
  background: 'light',
};

const footerConfig: DisplayLogoConfig = {
  position: 'footer',
  size: 'small',
  background: 'none',
};

describe('LogoRail', () => {
  it('renders a layout-flow brand rail aligned to the configured corner', () => {
    render(<LogoRail src="/logo.png" config={topLeftConfig} />);
    const rail = document.querySelector('[data-logo-rail]');
    expect(rail).toBeTruthy();
    expect(rail?.className).toContain('justify-start');
    expect(screen.getByAltText('Masjid logo')).toHaveAttribute('src', '/logo.png');
  });

  it('centres the mark in portrait mode', () => {
    render(<LogoRail src="/logo.png" config={topLeftConfig} portrait />);
    const rail = document.querySelector('[data-logo-rail]');
    expect(rail?.getAttribute('data-logo-position')).toBe('top-centre');
    expect(rail?.className).toContain('justify-center');
  });

  it('does not render for footer position', () => {
    render(<LogoRail src="/logo.png" config={footerConfig} />);
    expect(document.querySelector('[data-logo-rail]')).toBeNull();
  });

  it('uses compact in-flow height for large size', () => {
    render(
      <LogoRail
        src="/logo.png"
        config={{ ...topLeftConfig, size: 'large' }}
      />,
    );
    const badge = screen.getByAltText('Masjid logo').parentElement;
    expect(badge?.className).toContain('h-12');
    expect(screen.getByAltText('Masjid logo').className).toContain('max-w-44');
  });
});

describe('ContentLogoFrame', () => {
  it('stacks logo above content without affecting sibling zones', () => {
    render(
      <ContentLogoFrame logo={<div data-testid="logo-slot" />}>
        <div data-testid="content-slot" />
      </ContentLogoFrame>,
    );
    expect(screen.getByTestId('logo-slot')).toBeTruthy();
    expect(screen.getByTestId('content-slot')).toBeTruthy();
  });
});

describe('FooterLeadingLogo', () => {
  it('renders only for footer position', () => {
    const { rerender } = render(<FooterLeadingLogo src="/logo.png" config={footerConfig} />);
    expect(screen.getByAltText('Masjid logo')).toBeTruthy();

    rerender(<FooterLeadingLogo src="/logo.png" config={topLeftConfig} />);
    expect(screen.queryByAltText('Masjid logo')).toBeNull();
  });
});
