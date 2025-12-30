import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { InstallPrompt } from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import Layout from './components/Layout';
import Loading from './components/Loading';
import ErrorBoundary from './components/ErrorBoundary';
import { ROUTE_PATHS } from './config/routes.config';

// Lazy load pages for better performance and smaller initial bundle
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Categories = lazy(() => import('./pages/Categories'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Profile = lazy(() => import('./pages/Profile'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Transactions = lazy(() => import('./pages/Transactions'));

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <InstallPrompt />
        <OfflineIndicator />
        <Box sx={{ minHeight: '100vh' }}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route
                path={ROUTE_PATHS.LOGIN}
                element={isAuthenticated ? <Navigate to={ROUTE_PATHS.DASHBOARD} /> : <Login />}
              />
              <Route
                path={ROUTE_PATHS.REGISTER}
                element={isAuthenticated ? <Navigate to={ROUTE_PATHS.DASHBOARD} /> : <Register />}
              />

              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="categories" element={<Categories />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="budgets" element={<Budgets />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="profile" element={<Profile />} />
              </Route>

              <Route path="*" element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />} />
            </Routes>
          </Suspense>
        </Box>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
