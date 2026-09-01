import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/globals.css';

window.addEventListener('error', (e) => {
  console.error('[Window Error]:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Rejection]:', e.reason);
});

console.log('[Main] Mounting React root...');
const rootElem = document.getElementById('root');
if (rootElem) {
  ReactDOM.createRoot(rootElem).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log('[Main] React render triggered successfully');
} else {
  console.error('[Main] #root element not found!');
}
