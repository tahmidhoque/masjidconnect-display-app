/**
 * Tests for CountdownDisplay component.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CountdownDisplay from './CountdownDisplay';

describe('CountdownDisplay', () => {
  it('renders numbers and unit labels for a valid countdown string', () => {
    render(<CountdownDisplay value="5h 19m 20s" />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
    expect(screen.getByText('s')).toBeInTheDocument();
  });

  it('applies countdown-unit class to unit labels', () => {
    const { container } = render(<CountdownDisplay value="1h 0m" />);
    const units = container.querySelectorAll('.countdown-unit');
    expect(units).toHaveLength(2);
    expect(units[0].textContent).toBe('h');
    expect(units[1].textContent).toBe('m');
  });

  it('renders empty string when value is empty', () => {
    render(<CountdownDisplay value="" />);
    const wrapper = document.body.querySelector('.countdown-stable');
    expect(wrapper).not.toBeInTheDocument();
    expect(document.body.textContent).toBe('');
  });

  it('falls back to raw string when value does not match countdown pattern', () => {
    render(<CountdownDisplay value="--:--" />);
    expect(screen.getByText('--:--')).toBeInTheDocument();
  });

  it('applies optional className to wrapper', () => {
    const { container } = render(
      <CountdownDisplay value="2h 30m" className="text-gold font-bold" />,
    );
    const span = container.querySelector('span.countdown-stable');
    expect(span).toHaveClass('text-gold');
    expect(span).toHaveClass('font-bold');
  });
});
