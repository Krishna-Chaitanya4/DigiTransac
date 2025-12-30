import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper, Box } from '@mui/material';
import { getMobileNavRoutes } from '../config/routes.config';

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const routes = getMobileNavRoutes();

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
        {routes.map((route) => {
          const IconComponent = route.icon;
          return (
          <BottomNavigationAction
            key={route.path}
            label={route.label}
            icon={<IconComponent />}
            sx={{
              '&.Mui-selected': {
                color: 'primary.main',
              },
            }}
          />
        );
        })}
      </BottomNavigation>
      {/* Safe area for iOS notch */}
      <Box sx={{ height: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper' }} />
    </Paper>
  );
};

export default React.memo(MobileBottomNav);
