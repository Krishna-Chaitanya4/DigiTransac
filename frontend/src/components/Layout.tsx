import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CategoryIcon from '@mui/icons-material/Category';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PieChartIcon from '@mui/icons-material/PieChart';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 260;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', available: true },
    { text: 'Categories', icon: <CategoryIcon />, path: '/categories', available: true },
    { text: 'Accounts', icon: <AccountBalanceWalletIcon />, path: '/accounts', available: false },
    { text: 'Transactions', icon: <ReceiptLongIcon />, path: '/transactions', available: false },
    { text: 'Budgets', icon: <PieChartIcon />, path: '/budgets', available: false },
    { text: 'Analytics', icon: <PieChartIcon />, path: '/analytics', available: false },
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Brand */}
      <Box
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          DigiTransac
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          Personal Finance Manager
        </Typography>
      </Box>

      <Divider />

      {/* User Profile */}
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 48,
              height: 48,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
              {user?.fullName || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ flex: 1, pt: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ px: 1.5, mb: 0.5 }}>
              <ListItemButton
                onClick={() => item.available && navigate(item.path)}
                disabled={!item.available}
                sx={{
                  borderRadius: 2,
                  minHeight: 48,
                  bgcolor: isActive ? 'primary.main' : 'transparent',
                  color: isActive ? 'white' : 'text.primary',
                  '&:hover': {
                    bgcolor: isActive ? 'primary.dark' : 'action.hover',
                  },
                  '&.Mui-disabled': {
                    opacity: 0.5,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? 'white' : 'primary.main',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                  }}
                />
                {!item.available && (
                  <Typography variant="caption" sx={{ opacity: 0.6, fontSize: 10 }}>
                    Soon
                  </Typography>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* Logout Button */}
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'error.main',
            color: 'error.main',
            '&:hover': {
              bgcolor: 'error.main',
              color: 'white',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 600 }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar - Mobile only */}
      {isMobile && (
        <AppBar
          position="fixed"
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
              DigiTransac
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Drawer - Persistent on desktop, temporary on mobile */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                border: 'none',
                boxShadow: '4px 0 12px rgba(0,0,0,0.08)',
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: '#f5f7fa',
          pt: { xs: 8, md: 0 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
