/**
 * Tests for OrientationWrapper component.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrientationWrapper from './OrientationWrapper';

describe('OrientationWrapper', () => {
  it('renders children when rotationDegrees is 0', () => {
    render(
      React.createElement(
        OrientationWrapper,
        { rotationDegrees: 0 } as React.ComponentProps<typeof OrientationWrapper>,
        React.createElement('span', null, 'Child content'),
      ),
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies rotated transform when rotationDegrees is 90', () => {
    const { container } = render(
      React.createElement(
        OrientationWrapper,
        { rotationDegrees: 90 } as React.ComponentProps<typeof OrientationWrapper>,
        React.createElement('span', null, 'Portrait'),
      ),
    );
    const inner = container.querySelector('[style*="rotate"]');
    expect(inner).toBeInTheDocument();
    expect(inner?.getAttribute('style')).toContain('rotate(90deg)');
  });

  it('applies theme CSS variables on an ancestor of the fullscreen portal root', () => {
    const themeStyle = {
      '--color-midnight': '#241546',
      '--color-gold': '#F0C674',
    } as React.CSSProperties;

    const { container } = render(
      React.createElement(
        OrientationWrapper,
        { rotationDegrees: 0, themeStyle } as React.ComponentProps<typeof OrientationWrapper>,
        React.createElement('span', null, 'Layout'),
      ),
    );

    const themeRoot = container.querySelector('[data-display-theme-root]');
    const portalRoot = container.querySelector('#orientation-portal-root');
    expect(themeRoot).toBeTruthy();
    expect(portalRoot).toBeTruthy();
    expect(themeRoot?.contains(portalRoot as Node)).toBe(true);
    expect(themeRoot).toHaveStyle({
      '--color-midnight': '#241546',
      '--color-gold': '#F0C674',
    });
  });

  it('keeps the portal root inside the themed wrapper when rotated', () => {
    const themeStyle = {
      '--color-midnight': '#3A1320',
    } as React.CSSProperties;

    const { container } = render(
      React.createElement(
        OrientationWrapper,
        { rotationDegrees: 90, themeStyle } as React.ComponentProps<typeof OrientationWrapper>,
        React.createElement('span', null, 'Portrait layout'),
      ),
    );

    const themeRoot = container.querySelector('[data-display-theme-root]');
    const portalRoot = container.querySelector('#orientation-portal-root');
    expect(themeRoot?.contains(portalRoot as Node)).toBe(true);
    expect(themeRoot).toHaveStyle({ '--color-midnight': '#3A1320' });
  });
});
