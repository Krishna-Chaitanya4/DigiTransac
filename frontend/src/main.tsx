import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { registerServiceWorker } from './utils/pwa';
import { offlineDB } from './utils/offline/db';
import { syncManager } from './utils/offline/sync';
import { setupAxiosInterceptors } from './utils/axiosConfig';
import { queryClient } from './utils/queryClient';
import './index.css';

// Setup axios interceptors
setupAxiosInterceptors();

// Initialize offline support
offlineDB
  .init()
  .then(() => {
    console.log('Offline database initialized');
    // Start auto-sync
    syncManager.startAutoSync();
  })
  .catch((error) => {
    console.error('Failed to initialize offline database:', error);
  });

// Register service worker for PWA (always enabled for testing)
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SnackbarProvider
              maxSnack={3}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              autoHideDuration={3000}
            >
              <CssBaseline />
              <App />
            </SnackbarProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
