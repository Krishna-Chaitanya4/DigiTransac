import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Category as CategoryIcon,
  AccountBalance as BudgetIcon,
  Analytics as AnalyticsIcon,
  Person as PersonIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  AccountBalance,
  AccountBalanceWallet as AccountsIcon,
  SwapHoriz as TransactionsIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import MobileBottomNav from './MobileBottomNav';

const drawerWidth = 240;

interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
}

const menuItems: MenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Transactions', icon: <TransactionsIcon />, path: '/transactions' },
  { text: 'Accounts', icon: <AccountsIcon />, path: '/accounts' },
  { text: 'Categories', icon: <CategoryIcon />, path: '/categories' },
  { text: 'Budgets', icon: <BudgetIcon />, path: '/budgets' },
  { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
];

const Layout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeContext();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
    navigate('/login');
  };

  const handleProfileClick = () => {
    navigate('/profile');
    handleMenuClose();
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ py: 3, px: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
          <Box
            sx={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
              borderRadius: 2.5,
              p: 1.2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(20, 184, 166, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05) rotate(-5deg)',
                boxShadow: '0 6px 20px rgba(20, 184, 166, 0.5)',
              },
            }}
          >
            <AccountBalance sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Typography
            variant="h6"
            noWrap
            component="div"
            fontWeight={800}
            sx={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}
          >
            DigiTransac
          </Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ opacity: 0.1 }} />
      <List sx={{ flexGrow: 1, px: 2, py: 3 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1.5 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) handleDrawerToggle();
              }}
              sx={{
                borderRadius: 2.5,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  background: 'linear-gradient(180deg, #14b8a6 0%, #06b6d4 100%)',
                  opacity: 0,
                  transition: 'opacity 0.3s ease',
                },
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                  color: 'white',
                  boxShadow: '0 8px 16px rgba(20, 184, 166, 0.3)',
                  '&::before': {
                    opacity: 1,
                  },
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
                    transform: 'translateX(6px) scale(1.02)',
                    boxShadow: '0 10px 24px rgba(20, 184, 166, 0.4)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                    transform: 'scale(1.1)',
                  },
                },
                '&:hover': {
                  background: (theme) =>
                    theme.palette.mode === 'light'
                      ? 'rgba(20, 184, 166, 0.08)'
                      : 'rgba(20, 184, 166, 0.15)',
                  transform: 'translateX(6px)',
                  '& .MuiListItemIcon-root': {
                    transform: 'scale(1.1) rotate(5deg)',
                    color: '#14b8a6',
                  },
                },
                py: 1.75,
                px: 2,
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? 'white' : 'inherit',
                  minWidth: 44,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontWeight: location.pathname === item.path ? 700 : 500,
                  fontSize: '0.95rem',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          background: (theme) =>
            theme.palette.mode === 'light' 
              ? 'rgba(255, 255, 255, 0.85)' 
              : 'rgba(30, 30, 30, 0.85)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          borderBottom: (theme) =>
            theme.palette.mode === 'light'
              ? '1px solid rgba(20, 184, 166, 0.1)'
              : '1px solid rgba(20, 184, 166, 0.2)',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ py: 1.5, minHeight: '70px' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2, 
              display: { md: 'none' },
              '&:hover': {
                background: 'rgba(20, 184, 166, 0.1)',
                transform: 'scale(1.1)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
            <IconButton
              onClick={toggleTheme}
              sx={{
                mr: 2,
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(20, 184, 166, 0.1)'
                    : 'rgba(20, 184, 166, 0.2)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                  color: 'white',
                  transform: 'rotate(180deg) scale(1.1)',
                  boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)',
                },
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Account settings">
            <IconButton onClick={handleMenuClick} sx={{ p: 0.5 }}>
              <Avatar
                sx={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                  width: 42,
                  height: 42,
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'scale(1.15)',
                    boxShadow: '0 6px 20px rgba(20, 184, 166, 0.5)',
                  },
                }}
              >
                {user?.firstName?.[0] || 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            sx={{
              '& .MuiPaper-root': {
                borderRadius: 2,
                minWidth: 180,
                mt: 1.5,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                '& .MuiMenuItem-root': {
                  borderRadius: 1,
                  mx: 1,
                  my: 0.5,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'rgba(20, 184, 166, 0.1)',
                    transform: 'translateX(4px)',
                  },
                },
              },
            }}
          >
            <MenuItem onClick={handleProfileClick}>
              <ListItemIcon>
                <PersonIcon fontSize="small" sx={{ color: '#14b8a6' }} />
              </ListItemIcon>
              Profile
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" sx={{ color: '#f43f5e' }} />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          mb: { xs: 8, md: 0 }, // Add bottom margin on mobile for bottom nav
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Outlet />
      </Box>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </Box>
  );
};

export default Layout;
