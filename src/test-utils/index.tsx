/**
 * Test utilities — re-exports and custom render for React Testing Library.
 */

export {
  render,
  screen,
  within,
  waitFor,
  waitForElementToBeRemoved,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';

export { default as userEvent } from '@testing-library/user-event';

export { renderHook } from '@testing-library/react';

export { AllTheProviders, createTestStore } from './test-providers';
export type { TestRootState } from './test-providers';

export * from './mocks';
