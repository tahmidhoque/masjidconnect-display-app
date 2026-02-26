/**
 * PortraitLayout component tests.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortraitLayout from './PortraitLayout';

describe('PortraitLayout', () => {
  it('renders header, prayerSection, content, and footer', () => {
    render(
      <PortraitLayout
        header={<span data-testid="header">Header</span>}
        prayerSection={<span data-testid="prayer">Prayer</span>}
        content={<span data-testid="content">Content</span>}
        footer={<span data-testid="footer">Footer</span>}
      />,
    );
    expect(screen.getByTestId('header')).toHaveTextContent('Header');
    expect(screen.getByTestId('prayer')).toHaveTextContent('Prayer');
    expect(screen.getByTestId('content')).toHaveTextContent('Content');
    expect(screen.getByTestId('footer')).toHaveTextContent('Footer');
  });

  it('renders background when provided', () => {
    render(
      <PortraitLayout
        header={<span>H</span>}
        prayerSection={<span>P</span>}
        content={<span>C</span>}
        footer={<span>F</span>}
        background={<span data-testid="bg">Background</span>}
      />,
    );
    expect(screen.getByTestId('bg')).toHaveTextContent('Background');
  });
});
