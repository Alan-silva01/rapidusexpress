import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import ErrorBoundary from './components/ErrorBoundary';
console.log('🔧 Starting Rapidus Delivery app (index.tsx)');

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  }
} catch (err: any) {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">React Init Error: ${err.message}</div>`;
  }
}



