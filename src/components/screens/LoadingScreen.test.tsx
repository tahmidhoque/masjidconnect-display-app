/**
 * Tests for LoadingScreen component.
 *
 * LoadingScreen embeds ConnectionBanner (Redux), so renders must use AllTheProviders.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingScreen from './LoadingScreen';
import type { LoadingTask } from '@/hooks/useAppLoader';
import { createTestStore, AllTheProviders } from '@/test-utils';

function renderLoadingScreen(props: React.ComponentProps<typeof LoadingScreen>) {
  const store = createTestStore();
  return render(
    React.createElement(
      AllTheProviders,
      { preloadedState: store.getState() } as React.ComponentProps<typeof AllTheProviders>,
      React.createElement(LoadingScreen, props),
    ),
  );
}

const defaultTasks: LoadingTask[] = [
  { id: 'credentials', label: 'Checking credentials', status: 'complete', progress: 100 },
  { id: 'content', label: 'Loading content', status: 'loading', progress: 50 },
  { id: 'prayer-times', label: 'Fetching prayer times', status: 'pending', progress: 0 },
];

describe('LoadingScreen', () => {
  it('renders progress and message', () => {
    renderLoadingScreen({
      progress: 45,
      message: 'Loading content…',
      tasks: defaultTasks,
    });
    expect(screen.getByText('Loading content…')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders task list with labels', () => {
    renderLoadingScreen({
      progress: 0,
      message: 'Initialising…',
      tasks: defaultTasks,
    });
    expect(screen.getByText('Checking credentials')).toBeInTheDocument();
    expect(screen.getByText('Loading content')).toBeInTheDocument();
    expect(screen.getByText('Fetching prayer times')).toBeInTheDocument();
  });

  it('clamps progress to 0-100', () => {
    renderLoadingScreen({
      progress: 150,
      message: 'Done',
      tasks: [],
    });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
