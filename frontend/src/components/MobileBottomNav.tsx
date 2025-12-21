import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper, Box } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  SwapHoriz as TransactionsIcon,
  AccountBalance as BudgetIcon,
  Analytics as AnalyticsIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const routes = [
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/transactions', label: 'Transactions', icon: <TransactionsIcon /> },
    { path: '/budgets', label: 'Budgets', icon: <BudgetIcon /> },
    { path: '/analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
    { path: '/profile', label: 'Profile', icon: <PersonIcon /> },
  ];

  const currentRoute = routes.findIndex((route) => location.pathname.startsWith(route.path));
  const value = currentRoute === -1 ? 0 : currentRoute;

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        display: { xs: 'block', md: 'none' },
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
      }}
      elevation={3}
    >
      <BottomNavigation
        value={value}
        onChange={(_, newValue) => {
          navigate(routes[newValue].path);
        }}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 0',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.7rem',
            '&.Mui-selected': {
              fontSize: '0.75rem',
            },
          },
        }}
      >
        {routes.map((route) => (
          <BottomNavigationAction
            key={route.path}
            label={route.label}
            icon={route.icon}
            sx={{
              '&.Mui-selected': {
                color: 'primary.main',
              },
            }}
          />
        ))}
      </BottomNavigation>
      {/* Safe area for iOS notch */}
      <Box sx={{ height: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper' }} />
    </Paper>
  );
};

export default MobileBottomNav;
