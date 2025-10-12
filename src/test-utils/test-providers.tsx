/**
 * Test Providers
 * Wrapper components for testing with Redux, Router, and Theme providers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';

import type { RootState } from '../store';
import authReducer from '../store/slices/authSlice';
import contentReducer from '../store/slices/contentSlice';
import emergencyReducer from '../store/slices/emergencySlice';
import errorReducer from '../store/slices/errorSlice';
import uiReducer from '../store/slices/uiSlice';
import theme from '../theme/theme';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: Partial<RootState>;
  store?: ReturnType<typeof setupStore>;
}

// Create root reducer matching the actual store
const rootReducer = combineReducers({
  auth: authReducer,
  content: contentReducer,
  ui: uiReducer,
  emergency: emergencyReducer,
  errors: errorReducer, // Note: 'errors' not 'error' to match actual store
});

/**
 * Create a test store with optional preloaded state
 */
export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
}

/**
 * Wrapper component with all providers
 */
export function AllTheProviders({
  children,
  store,
}: {
  children: React.ReactNode;
  store?: ReturnType<typeof setupStore>;
}) {
  const testStore = store || setupStore();

  return (
    <Provider store={testStore}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <SnackbarProvider maxSnack={3}>
            {children}
          </SnackbarProvider>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}

export type TestStore = ReturnType<typeof setupStore>;

/**
 * Custom render function that includes all providers
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = setupStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <AllTheProviders store={store}>{children}</AllTheProviders>;
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/**
 * Render with only Redux provider (no router/theme)
 */
export function renderWithRedux(
  ui: ReactElement,
  {
    preloadedState,
    store = setupStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/**
 * Render with only Theme provider
 */
export function renderWithTheme(
  ui: ReactElement,
  renderOptions?: Omit<RenderOptions, 'queries'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

