/**
 * Tests for LoadingScreen component.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingScreen from './LoadingScreen';
import type { LoadingTask } from '@/hooks/useAppLoader';

const defaultTasks: LoadingTask[] = [
  { id: 'credentials', label: 'Checking credentials', status: 'complete', progress: 100 },
  { id: 'content', label: 'Loading content', status: 'loading', progress: 50 },
  { id: 'prayer-times', label: 'Fetching prayer times', status: 'pending', progress: 0 },
];

describe('LoadingScreen', () => {
  it('renders progress and message', () => {
    render(
      React.createElement(LoadingScreen, {
        progress: 45,
        message: 'Loading content…',
        tasks: defaultTasks,
      }),
    );
    expect(screen.getByText('Loading content…')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders task list with labels', () => {
    render(
      React.createElement(LoadingScreen, {
        progress: 0,
        message: 'Initialising…',
        tasks: defaultTasks,
      }),
    );
    expect(screen.getByText('Checking credentials')).toBeInTheDocument();
    expect(screen.getByText('Loading content')).toBeInTheDocument();
    expect(screen.getByText('Fetching prayer times')).toBeInTheDocument();
  });

  it('clamps progress to 0-100', () => {
    render(
      React.createElement(LoadingScreen, {
        progress: 150,
        message: 'Done',
        tasks: [],
      }),
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
