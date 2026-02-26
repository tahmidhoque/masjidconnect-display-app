/**
 * Tests for Header component.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from './Header';

describe('Header', () => {
  it('renders without crashing', () => {
    render(React.createElement(Header));
    expect(document.body.textContent).toBeTruthy();
  });

  it('shows time and date elements', () => {
    render(React.createElement(Header));
    // Header shows day name, date, and time
    const el = document.querySelector('[class*="grid"]');
    expect(el).toBeInTheDocument();
  });

  it('shows Ramadan text when isRamadan and ramadanDay provided', () => {
    render(React.createElement(Header, { isRamadan: true, ramadanDay: 15 }));
    expect(screen.getByText(/Ramadan Mubarak — Day 15/)).toBeInTheDocument();
  });
});
