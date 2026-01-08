import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
} catch (err: any) {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">React Init Error: ${err.message}</div>`;
  }
}

// Registrar Service Worker de forma segura
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW ok'))
    .catch(err => console.error('SW erro:', err));
}
