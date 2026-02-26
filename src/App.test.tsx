/**
 * Tests for App root and ErrorFallback.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App';
import { AllTheProviders } from '@/test-utils';

vi.mock('./hooks/useAppLoader', () => ({
  __esModule: true,
  default: () => ({
    phase: 'loading',
    overallProgress: 50,
    currentTask: 'Loading content',
    tasks: [],
    hasPairingCode: false,
  }),
}));

vi.mock('./hooks/useDevKeyboard', () => ({
  __esModule: true,
  default: () => {},
  ORIENTATION_FORCE_EVENT: 'orientation-force-change',
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(
      React.createElement(AllTheProviders, null, React.createElement(App)),
    );
    expect(document.body).toBeTruthy();
  });
});

describe('ErrorFallback', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  const Fallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <div>
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Reload</button>
    </div>
  );

  it('shows error message and reload button when boundary catches', () => {
    render(
      React.createElement(
        ErrorBoundary,
        {
          FallbackComponent: Fallback,
          onReset: () => {},
        },
        React.createElement(ThrowError),
      ),
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});
