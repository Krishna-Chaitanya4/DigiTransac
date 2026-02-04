import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './context/AuthContext'
import { CurrencyProvider } from './context/CurrencyContext'
import { ThemeProvider } from './context/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ToastProvider'
import { initSentry } from './services/sentry'
import { initAnalytics } from './services/analytics'
import i18n from './i18n'
import App from './App'
import './index.css'

// Initialize error monitoring
initSentry();

// Initialize analytics (PostHog)
initAnalytics();

// Lazy load React Query Devtools only in development
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((mod) => ({
    default: mod.ReactQueryDevtools,
  }))
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <BrowserRouter>
                <AuthProvider>
                  <CurrencyProvider>
                    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                      <App />
                    </Suspense>
                  </CurrencyProvider>
                </AuthProvider>
              </BrowserRouter>
            </ToastProvider>
          </ThemeProvider>
          {import.meta.env.DEV && (
            <Suspense fallback={null}>
              <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
            </Suspense>
          )}
        </QueryClientProvider>
      </I18nextProvider>
    </ErrorBoundary>
  </StrictMode>,
)
