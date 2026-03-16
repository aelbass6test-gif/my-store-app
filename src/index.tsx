
import React from 'react';
import { createRoot } from 'react-dom/client';
// FIX: The App component should be the default export which is the AppWrapper.
import App from './App';
import reportWebVitals from './reportWebVitals';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals(console.log);

// AI Studio always uses an `index.tsx` file for all project types.