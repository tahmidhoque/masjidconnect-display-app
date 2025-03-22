import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for offline functionality
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // When an update is available, show some indicator to the user
    console.log('New version available! Ready to update.');
    
    // Notify the user that a new version is available
    // This is a display app with no user interaction, so we'll auto-update
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Reload the page to use the new version
    window.location.reload();
  },
  onSuccess: (registration) => {
    console.log('Service worker registered successfully');
    
    // Listen for controller change (SW activation)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service worker controller changed - new version activated');
    });
    
    // Prefetch and cache critical assets on successful registration
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_CRITICAL_ASSETS'
      });
    }
  }
});

// Report web vitals
reportWebVitals(); 