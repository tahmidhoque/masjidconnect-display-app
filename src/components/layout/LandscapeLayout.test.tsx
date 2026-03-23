/**
 * LandscapeLayout component tests.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandscapeLayout from './LandscapeLayout';

describe('LandscapeLayout', () => {
  it('renders content, prayer strip, and footer', () => {
    render(
      <LandscapeLayout
        content={<span data-testid="content">Content</span>}
        prayerStrip={<span data-testid="prayer-strip">Prayer Strip</span>}
        footer={<span data-testid="footer">Footer</span>}
      />,
    );
    expect(screen.getByTestId('content')).toHaveTextContent('Content');
    expect(screen.getByTestId('prayer-strip')).toHaveTextContent('Prayer Strip');
    expect(screen.getByTestId('footer')).toHaveTextContent('Footer');
  });

  it('renders topBar above main when provided', () => {
    const { container } = render(
      <LandscapeLayout
        topBar={<span data-testid="top-bar">Top</span>}
        content={<span data-testid="content">Content</span>}
        prayerStrip={<span data-testid="prayer-strip">Prayer Strip</span>}
        footer={<span data-testid="footer">Footer</span>}
      />,
    );
    expect(screen.getByTestId('top-bar')).toHaveTextContent('Top');
    const stack = container.querySelector('.relative.z-10.flex.flex-col');
    expect(stack).toBeTruthy();
    const children = stack?.children;
    expect(children?.[0]).toContainElement(screen.getByTestId('top-bar'));
    expect(children?.[1]).toContainElement(screen.getByTestId('content'));
  });

  it('renders background when provided', () => {
    render(
      <LandscapeLayout
        content={<span>C</span>}
        prayerStrip={<span>PS</span>}
        footer={<span>F</span>}
        background={<span data-testid="bg">Background</span>}
      />,
    );
    expect(screen.getByTestId('bg')).toHaveTextContent('Background');
  });

  it('has main, aside, and footer structure', () => {
    const { container } = render(
      <LandscapeLayout
        content={<span>C</span>}
        prayerStrip={<span>PS</span>}
        footer={<span>F</span>}
      />,
    );
    expect(container.querySelector('main')).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeInTheDocument();
    expect(container.querySelector('aside')).toBeInTheDocument();
  });
});
