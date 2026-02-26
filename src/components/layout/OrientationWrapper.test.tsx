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
        { rotationDegrees: 0 },
        React.createElement('span', null, 'Child content'),
      ),
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies rotated transform when rotationDegrees is 90', () => {
    const { container } = render(
      React.createElement(
        OrientationWrapper,
        { rotationDegrees: 90 },
        React.createElement('span', null, 'Portrait'),
      ),
    );
    const inner = container.querySelector('[style*="rotate"]');
    expect(inner).toBeInTheDocument();
    expect(inner?.getAttribute('style')).toContain('rotate(90deg)');
  });
});
