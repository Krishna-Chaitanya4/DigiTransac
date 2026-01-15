import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CategoryIcon from '@mui/icons-material/Category';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const stats = [
    {
      title: 'Total Balance',
      value: '$0.00',
      change: '+0%',
      trend: 'up',
      icon: <AccountBalanceWalletIcon sx={{ fontSize: 40 }} />,
      color: '#667eea',
    },
    {
      title: 'Income',
      value: '$0.00',
      change: '+0%',
      trend: 'up',
      icon: <TrendingUpIcon sx={{ fontSize: 40 }} />,
      color: '#4caf50',
    },
    {
      title: 'Expenses',
      value: '$0.00',
      change: '+0%',
      trend: 'down',
      icon: <TrendingDownIcon sx={{ fontSize: 40 }} />,
      color: '#f44336',
    },
    {
      title: 'Categories',
      value: '0',
      change: 'Active',
      trend: 'neutral',
      icon: <CategoryIcon sx={{ fontSize: 40 }} />,
      color: '#764ba2',
    },
  ];

  const quickActions = [
    { title: 'Categories', route: '/categories', available: true, color: '#667eea' },
    { title: 'Transactions', route: '/transactions', available: false, color: '#764ba2' },
    { title: 'Budgets', route: '/budgets', available: false, color: '#f093fb' },
    { title: 'Analytics', route: '/analytics', available: false, color: '#4facfe' },
  ];

  return (
    <Layout>
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Container maxWidth="xl">
          {/* Welcome Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#1a1a2e' }}>
              Welcome back, {user?.fullName?.split(' ')[0] || 'User'}! 👋
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Here's what's happening with your finances today
            </Typography>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {stats.map((stat, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'white',
                    borderRadius: 3,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1, fontWeight: 500 }}
                        >
                          {stat.title}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                          {stat.value}
                        </Typography>
                        <Chip
                          label={stat.change}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 11,
                            fontWeight: 600,
                            bgcolor:
                              stat.trend === 'up'
                                ? 'rgba(76, 175, 80, 0.1)'
                                : stat.trend === 'down'
                                ? 'rgba(244, 67, 54, 0.1)'
                                : 'rgba(158, 158, 158, 0.1)',
                            color:
                              stat.trend === 'up'
                                ? '#4caf50'
                                : stat.trend === 'down'
                                ? '#f44336'
                                : '#9e9e9e',
                          }}
                        />
                      </Box>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: `${stat.color}15`,
                          color: stat.color,
                        }}
                      >
                        {stat.icon}
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Quick Actions */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1a1a2e' }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              {quickActions.map((action, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                  <Card
                    onClick={() => action.available && navigate(action.route)}
                    sx={{
                      cursor: action.available ? 'pointer' : 'default',
                      background: action.available
                        ? `linear-gradient(135deg, ${action.color} 0%, ${action.color}dd 100%)`
                        : '#e0e0e0',
                      color: 'white',
                      borderRadius: 3,
                      boxShadow: action.available ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
                      transition: 'all 0.3s ease',
                      opacity: action.available ? 1 : 0.6,
                      '&:hover': action.available
                        ? {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                          }
                        : {},
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {action.title}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {action.available ? 'Click to open' : 'Coming Soon'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Placeholder for Recent Activity */}
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}
          >
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                📊 Analytics Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Coming soon: Transaction history, budget insights, and spending analytics
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Layout>
  );
};
