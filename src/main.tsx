import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {GlobalErrorBoundary} from './components/GlobalErrorBoundary.tsx';
import './index.css';

// Global Error Tracking (Tiêu chí 20): Bắt các lỗi runtime và Promise bị từ chối ngoài luồng React
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    try {
      sessionStorage.setItem(
        'bica_last_window_error',
        JSON.stringify({
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason || 'Unhandled Promise Rejection');
      sessionStorage.setItem(
        'bica_last_unhandled_rejection',
        JSON.stringify({
          reason,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
