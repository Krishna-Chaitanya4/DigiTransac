import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  LinearProgress,
  Avatar,
  Chip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Receipt,
  Category,
  AccountBalanceWallet,
} from '@mui/icons-material';

const Dashboard: React.FC = () => {
  // TODO: Fetch real data from API
  const stats = [
    {
      title: 'Total Expenses',
      value: '$2,450.00',
      change: '+12%',
      trend: 'up',
      icon: <Receipt sx={{ fontSize: 32 }} />,
      color: '#f44336',
      gradient: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)',
    },
    {
      title: 'This Month',
      value: '$850.00',
      change: '-5%',
      trend: 'down',
      icon: <AccountBalance sx={{ fontSize: 32 }} />,
      color: '#2196f3',
      gradient: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)',
    },
    {
      title: 'Budget Left',
      value: '$1,150.00',
      change: '+8%',
      trend: 'up',
      icon: <AccountBalanceWallet sx={{ fontSize: 32 }} />,
      color: '#4caf50',
      gradient: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
    },
    {
      title: 'Categories',
      value: '12',
      change: '+2',
      trend: 'up',
      icon: <Category sx={{ fontSize: 32 }} />,
      color: '#ff9800',
      gradient: 'linear-gradient(135deg, #ff9800 0%, #ffc107 100%)',
    },
  ];

  const recentTransactions = [
    { name: 'Groceries', amount: '$120.50', category: 'Food', date: 'Today', color: '#4caf50' },
    { name: 'Electricity Bill', amount: '$85.00', category: 'Utilities', date: 'Yesterday', color: '#2196f3' },
    { name: 'Coffee Shop', amount: '$12.30', category: 'Food', date: '2 days ago', color: '#4caf50' },
    { name: 'Gas', amount: '$45.00', category: 'Transport', date: '3 days ago', color: '#ff9800' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" fontWeight={800} gutterBottom sx={{ letterSpacing: '-0.02em' }}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
          Welcome back! Here's your expense overview.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'white'
                    : 'rgba(30, 30, 30, 0.8)',
                backdropFilter: 'blur(10px)',
                border: (theme) =>
                  theme.palette.mode === 'light'
                    ? '1px solid rgba(0,0,0,0.05)'
                    : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: `0 12px 40px ${stat.color}30`,
                },
                '&::before': {
                  content: '\"\"',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: stat.gradient,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                  <Avatar
                    sx={{
                      background: stat.gradient,
                      width: 56,
                      height: 56,
                      boxShadow: `0 4px 14px ${stat.color}40`,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                  <Chip
                    icon={stat.trend === 'up' ? <TrendingUp /> : <TrendingDown />}
                    label={stat.change}
                    size="small"
                    sx={{
                      background: stat.trend === 'up' 
                        ? 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)'
                        : 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      '& .MuiChip-icon': { color: 'white' },
                    }}
                  />
                </Box>
                <Typography variant="h4" fontWeight={800} sx={{ mb: 1, letterSpacing: '-0.02em' }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 4,
              height: 450,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? 'white'
                  : 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(10px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? '1px solid rgba(0,0,0,0.05)'
                  : '1px solid rgba(255,255,255,0.1)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              },
            }}
          >
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Spending Trends
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your expense patterns over time
            </Typography>
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              📊 Interactive chart coming soon
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 4,
              height: 450,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? 'white'
                  : 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(10px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? '1px solid rgba(0,0,0,0.05)'
                  : '1px solid rgba(255,255,255,0.1)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              },
            }}
          >
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Recent Activity
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Latest transactions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentTransactions.map((transaction, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: (theme) =>
                      theme.palette.mode === 'light'
                        ? 'rgba(0,0,0,0.02)'
                        : 'rgba(255,255,255,0.05)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateX(8px)',
                      background: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'rgba(0,0,0,0.04)'
                          : 'rgba(255,255,255,0.08)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body1" fontWeight={600}>
                      {transaction.name}
                    </Typography>
                    <Typography variant="body1" fontWeight={700} color={transaction.color}>
                      {transaction.amount}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip
                      label={transaction.category}
                      size="small"
                      sx={{
                        background: `${transaction.color}20`,
                        color: transaction.color,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {transaction.date}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
