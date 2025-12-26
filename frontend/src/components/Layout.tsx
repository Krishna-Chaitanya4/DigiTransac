import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
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
  Fade,
  TextField,
  InputAdornment,
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
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import MobileBottomNav from './MobileBottomNav';

const drawerWidth = 240;
const drawerWidthCollapsed = 70;

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
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : isTablet;
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeContext();

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Keyboard shortcut: Ctrl+B (or Cmd+B) to toggle sidebar
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (!isMobile) {
          setSidebarCollapsed((prev: boolean) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isMobile]);

  const currentWidth = sidebarCollapsed ? drawerWidthCollapsed : drawerWidth;

  const toggleSidebar = () => {
    setSidebarCollapsed((prev: boolean) => !prev);
  };

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

  // Filter menu items based on search
  const filteredMenuItems = menuItems.filter(item =>
    item.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      {/* Header with Logo and Toggle */}
      <Box sx={{ 
        p: sidebarCollapsed ? 1.5 : 2.5, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        minHeight: 64,
      }}>
        <Box 
          onClick={() => navigate('/dashboard')}
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              opacity: 0.8,
              transform: 'scale(1.02)',
            },
          }}
        >
          <Box
            sx={{
              background: '#14b8a6',
              borderRadius: 2,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <AccountBalance sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          {!sidebarCollapsed && (
            <Fade in={!sidebarCollapsed}>
              <Typography
                variant="h6"
                noWrap
                component="div"
                fontWeight={700}
                sx={{ color: 'text.primary' }}
              >
                DigiTransac
              </Typography>
            </Fade>
          )}
        </Box>
        {!isMobile && !sidebarCollapsed && (
          <IconButton
            onClick={toggleSidebar}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Expand Button When Collapsed */}
      {!isMobile && sidebarCollapsed && (
        <Box sx={{ px: 1.5, pb: 2 }}>
          <IconButton
            onClick={toggleSidebar}
            sx={{
              width: '100%',
              color: 'text.secondary',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Search Bar */}
      {!sidebarCollapsed && (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search or type a command..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2,
                bgcolor: 'action.hover',
                '& fieldset': { border: 'none' },
                '&:hover': { bgcolor: 'action.selected' },
                '&.Mui-focused': { 
                  bgcolor: 'action.selected',
                  boxShadow: '0 0 0 2px rgba(20, 184, 166, 0.2)',
                },
              },
            }}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: '0.875rem',
                py: 1.25,
              },
            }}
          />
        </Box>
      )}

      <Divider sx={{ opacity: 0.1 }} />

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, px: sidebarCollapsed ? 1 : 2, py: 2 }}>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip 
              title={sidebarCollapsed ? item.text : ''} 
              placement="right"
              arrow
              TransitionComponent={Fade}
            >
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) handleDrawerToggle();
                  setSearchQuery('');
                }}
                sx={{
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  minHeight: sidebarCollapsed ? 48 : 44,
                  py: 1.25,
                  px: sidebarCollapsed ? 1.5 : 2,
                  '&.Mui-selected': {
                    bgcolor: '#14b8a6',
                    color: 'white',
                    '&:hover': {
                      bgcolor: '#0d9488',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.path ? 'white' : 'text.secondary',
                    minWidth: sidebarCollapsed ? 0 : 40,
                    justifyContent: 'center',
                    '& .MuiSvgIcon-root': {
                      fontSize: '1.35rem',
                    },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!sidebarCollapsed && (
                  <Fade in={!sidebarCollapsed}>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: location.pathname === item.path ? 600 : 500,
                        fontSize: '0.9rem',
                      }}
                    />
                  </Fade>
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      {/* Profile Section at Bottom */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 2 }}>
        <Box
          onClick={handleMenuClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: sidebarCollapsed ? 1.5 : 1.5,
            borderRadius: 2,
            cursor: 'pointer',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <Avatar
            sx={{
              background: '#14b8a6',
              width: sidebarCollapsed ? 36 : 38,
              height: sidebarCollapsed ? 36 : 38,
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            {user?.fullName?.[0] || user?.username?.[0] || 'U'}
          </Avatar>
          {!sidebarCollapsed && (
            <Fade in={!sidebarCollapsed}>
              <Box sx={{ overflow: 'hidden', flex: 1 }}>
                <Typography fontSize="0.875rem" fontWeight={600} noWrap>
                  {user?.fullName || user?.username || 'User'}
                </Typography>
                <Typography fontSize="0.75rem" color="text.secondary" noWrap>
                  @{user?.username || user?.email || user?.phone || 'user'}
                </Typography>
              </Box>
            </Fade>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Mobile Menu Button - Floating */}
      {isMobile && (
        <IconButton
          onClick={handleDrawerToggle}
          sx={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1300,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}

      {/* Profile Menu */}
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
            minWidth: 200,
            mt: 1,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          },
        }}
      >
        <MenuItem onClick={handleProfileClick}>
          <ListItemIcon>
            <PersonIcon fontSize="small" sx={{ color: '#14b8a6' }} />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { toggleTheme(); handleMenuClose(); }}>
          <ListItemIcon>
            {mode === 'dark' ? (
              <LightModeIcon fontSize="small" sx={{ color: '#14b8a6' }} />
            ) : (
              <DarkModeIcon fontSize="small" sx={{ color: '#14b8a6' }} />
            )}
          </ListItemIcon>
          {mode === 'dark' ? 'Light' : 'Dark'} Mode
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: '#f43f5e' }} />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      <Box component="nav" sx={{ width: { md: currentWidth }, flexShrink: { md: 0 }, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
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
              width: currentWidth,
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
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
          width: { md: `calc(100% - ${currentWidth}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
