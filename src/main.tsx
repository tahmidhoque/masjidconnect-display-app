import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import App from './App';
import './index.css';
import './pwa';
import logger, { setLastError } from './utils/logger';

/**
 * PersistGate error recovery.
 * If Redux Persist fails to rehydrate (corrupted storage), purge and reload.
 */
const handlePersistError = async () => {
  try {
    logger.warn('[Persist] Corrupted state detected, purging and reloading');
    await persistor.purge();
    window.location.reload();
  } catch (err) {
    logger.error('[Persist] Recovery failed', { error: err });
  }
};

/** Capture uncaught errors so they can be shown via ?debug=1 on next load. */
window.addEventListener('error', (event) => {
  const msg = event.message || String(event.error);
  const detail = event.error?.stack ? `${msg}\n${event.error.stack}` : msg;
  setLastError(detail);
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? String(event.reason ?? 'Unknown rejection');
  setLastError(msg);
  if (msg.includes('persist') || msg.includes('localStorage')) {
    event.preventDefault();
    handlePersistError();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate
        loading={null}
        persistor={persistor}
        onBeforeLift={() => logger.info('[Persist] State rehydrated')}
      >
        <App />
      </PersistGate>
    </Provider>
  </React.StrictMode>,
);
