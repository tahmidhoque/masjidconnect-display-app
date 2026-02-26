/**
 * LandscapeLayout component tests.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandscapeLayout from './LandscapeLayout';

describe('LandscapeLayout', () => {
  it('renders header, content, sidebar, and footer', () => {
    render(
      <LandscapeLayout
        header={<span data-testid="header">Header</span>}
        content={<span data-testid="content">Content</span>}
        sidebar={<span data-testid="sidebar">Sidebar</span>}
        footer={<span data-testid="footer">Footer</span>}
      />,
    );
    expect(screen.getByTestId('header')).toHaveTextContent('Header');
    expect(screen.getByTestId('content')).toHaveTextContent('Content');
    expect(screen.getByTestId('sidebar')).toHaveTextContent('Sidebar');
    expect(screen.getByTestId('footer')).toHaveTextContent('Footer');
  });

  it('renders background when provided', () => {
    render(
      <LandscapeLayout
        header={<span>H</span>}
        content={<span>C</span>}
        sidebar={<span>S</span>}
        footer={<span>F</span>}
        background={<span data-testid="bg">Background</span>}
      />,
    );
    expect(screen.getByTestId('bg')).toHaveTextContent('Background');
  });

  it('has main and footer structure', () => {
    const { container } = render(
      <LandscapeLayout
        header={<span>H</span>}
        content={<span>C</span>}
        sidebar={<span>S</span>}
        footer={<span>F</span>}
      />,
    );
    expect(container.querySelector('main')).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeInTheDocument();
    expect(container.querySelector('aside')).toBeInTheDocument();
  });
});
