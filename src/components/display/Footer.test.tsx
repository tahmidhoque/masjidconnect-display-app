/**
 * Tests for Footer component.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';
import { AllTheProviders } from '@/test-utils';

vi.mock('@/hooks/useConnectionStatus', () => ({
  __esModule: true,
  default: () => ({ status: 'connected', message: '' }),
}));

describe('Footer', () => {
  it('renders without crashing', () => {
    render(
      React.createElement(AllTheProviders, null, React.createElement(Footer)),
    );
    expect(document.body.textContent).toBeTruthy();
  });

  it('shows MasjidConnect branding', () => {
    render(
      React.createElement(AllTheProviders, null, React.createElement(Footer)),
    );
    expect(screen.getByLabelText('MasjidConnect')).toBeInTheDocument();
  });
});
