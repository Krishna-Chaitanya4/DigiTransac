import { Suspense, lazy, ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import OfflineIndicator from './components/OfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load pages for better initial load performance
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const ChatsPage = lazy(() => import('./pages/ChatsPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const LabelsPage = lazy(() => import('./pages/LabelsPage'));
const InsightsPage = lazy(() => import('./pages/InsightsPage'));
const BudgetsPage = lazy(() => import('./pages/BudgetsPage'));
const SpendingMapPage = lazy(() => import('./pages/SpendingMapPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

/**
 * Wraps a page component with an error boundary for granular error handling.
 * This prevents errors in one page from crashing the entire app.
 */
function PageBoundary({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ErrorBoundary name={`Page:${name}`}>
      {children}
    </ErrorBoundary>
  );
}

// Loading spinner for Suspense fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/chats" replace /> : <PageBoundary name="Login"><LoginPage /></PageBoundary>} />
          <Route path="/register" element={user ? <Navigate to="/chats" replace /> : <PageBoundary name="Register"><RegisterPage /></PageBoundary>} />
          <Route path="/forgot-password" element={user ? <Navigate to="/chats" replace /> : <PageBoundary name="ForgotPassword"><ForgotPasswordPage /></PageBoundary>} />
          
          {/* Protected routes with Layout */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/chats" element={<PageBoundary name="Chats"><ChatsPage /></PageBoundary>} />
            <Route path="/accounts" element={<PageBoundary name="Accounts"><AccountsPage /></PageBoundary>} />
            <Route path="/insights" element={<PageBoundary name="Insights"><InsightsPage /></PageBoundary>} />
            <Route path="/budgets" element={<PageBoundary name="Budgets"><BudgetsPage /></PageBoundary>} />
            <Route path="/map" element={<PageBoundary name="SpendingMap"><SpendingMapPage /></PageBoundary>} />
            <Route path="/transactions" element={<PageBoundary name="Transactions"><TransactionsPage /></PageBoundary>} />
            <Route path="/labels" element={<PageBoundary name="Labels"><LabelsPage /></PageBoundary>} />
            <Route path="/settings" element={<PageBoundary name="Settings"><SettingsPage /></PageBoundary>} />
          </Route>

          {/* Redirect old dashboard route to chats */}
          <Route path="/dashboard" element={<Navigate to="/chats" replace />} />
          <Route path="/" element={<Navigate to={user ? "/chats" : "/login"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      
      {/* PWA Components */}
      <OfflineIndicator />
      <InstallPrompt />
    </>
  );
}

export default App;
