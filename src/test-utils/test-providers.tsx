/**
 * Test provider wrapper — Redux Provider with configurable store for RTL.
 */

import React from 'react';
import { Provider } from 'react-redux';
import type { ReactElement, ReactNode } from 'react';
import type { TestRootState } from './mock-store';
import { createTestStore } from './mock-store';

interface AllTheProvidersProps {
  children: ReactNode;
  preloadedState?: Partial<TestRootState>;
}

/**
 * Wraps children with Redux Provider using a test store.
 */
function AllTheProviders({ children, preloadedState }: AllTheProvidersProps): ReactElement {
  const store = createTestStore(preloadedState);
  return <Provider store={store}>{children}</Provider>;
}

/**
 * Custom render that wraps UI with test providers.
 * Re-export render from RTL so tests can use wrapper.
 */
export { AllTheProviders, createTestStore };
export type { TestRootState };
