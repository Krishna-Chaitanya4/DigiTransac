import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Receipt,
  Category,
  AccountBalanceWallet,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Pending as PendingIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface DashboardStats {
  totalSpent: number;
  monthSpent: number;
  budgetLeft: number;
  categoryCount: number;
  expenseCount: number;
  pendingReviews: number;
  avgDailySpending: number;
  percentChange: number;
}

interface RecentExpense {
  id: string;
  description: string;
  amount: number;
  categoryName: string;
  categoryColor: string;
  date: string;
  reviewStatus: string;
}

interface BudgetStatus {
  categoryName: string;
  spent: number;
  budget: number;
  percentage: number;
  isOver: boolean;
}

const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const params = new URLSearchParams({
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      });

      const [overviewRes, expensesRes, budgetsRes, reviewStatsRes] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/overview?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/expenses?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/budgets`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/review-queue-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const overview = overviewRes.data.overview;
      setStats({
        totalSpent: overview.totalSpent,
        monthSpent: overview.totalSpent,
        budgetLeft: overview.totalBudget - overview.totalSpent,
        categoryCount: 0, // Will be calculated from expenses
        expenseCount: overview.expenseCount,
        pendingReviews: reviewStatsRes.data.stats.pending,
        avgDailySpending: overview.avgExpense,
        percentChange: overview.budgetUsedPercent - 100,
      });

      // Process recent expenses
      const expenses = expensesRes.data.expenses || [];
      const categoriesRes = await axios.get(`${API_URL}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const categories = categoriesRes.data.categories || [];
      const categoryMap = new Map(categories.map((c: any) => [c.id, c]));

      setRecentExpenses(
        expenses.slice(0, 5).map((exp: any) => {
          const category = categoryMap.get(exp.categoryId);
          return {
            id: exp.id,
            description: exp.description,
            amount: exp.amount,
            categoryName: category?.name || 'Unknown',
            categoryColor: category?.color || '#667eea',
            date: exp.date,
            reviewStatus: exp.reviewStatus,
          };
        })
      );

      // Process budget status
      const budgets = budgetsRes.data.budgets || [];
      const budgetStatuses: BudgetStatus[] = [];
      
      for (const budget of budgets) {
        const category = categoryMap.get(budget.categoryId);
        const categoryExpenses = expenses.filter((e: any) => e.categoryId === budget.categoryId);
        const spent = categoryExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const percentage = Math.round((spent / budget.amount) * 100);
        
        budgetStatuses.push({
          categoryName: category?.name || 'Unknown',
          spent,
          budget: budget.amount,
          percentage,
          isOver: spent > budget.amount,
        });
      }

      setBudgetStatus(budgetStatuses.sort((a, b) => b.percentage - a.percentage).slice(0, 5));

      // Generate alerts
      const newAlerts: string[] = [];
      if (reviewStatsRes.data.stats.pending > 0) {
        newAlerts.push(`You have ${reviewStatsRes.data.stats.pending} expenses pending review`);
      }
      const overBudget = budgetStatuses.filter(b => b.isOver);
      if (overBudget.length > 0) {
        newAlerts.push(`${overBudget.length} categories are over budget`);
      }
      setAlerts(newAlerts);

      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    const daysAgo = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) return `${daysAgo} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const statCards = [
    {
      title: 'Month Spent',
      value: formatCurrency(stats?.monthSpent || 0),
      change: `${stats?.percentChange || 0}%`,
      trend: (stats?.percentChange || 0) > 0 ? 'up' : 'down',
      icon: <Receipt sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      title: 'Budget Left',
      value: formatCurrency(stats?.budgetLeft || 0),
      change: `${stats?.expenseCount || 0} expenses`,
      trend: (stats?.budgetLeft || 0) > 0 ? 'up' : 'down',
      icon: <AccountBalanceWallet sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: 'Pending Reviews',
      value: stats?.pendingReviews || 0,
      change: 'Need attention',
      trend: (stats?.pendingReviews || 0) > 0 ? 'up' : 'down',
      icon: <PendingIcon sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
      title: 'Avg Daily',
      value: formatCurrency(stats?.avgDailySpending || 0),
      change: 'This month',
      trend: 'up',
      icon: <TrendingUp sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h3" fontWeight={800} gutterBottom sx={{ letterSpacing: '-0.02em' }}>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
            Welcome back, {user?.name || 'User'}! Here's your expense overview.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/expenses')}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            px: 3,
            py: 1.5,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          Add Expense
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Box mb={3}>
          {alerts.map((alert, idx) => (
            <Alert
              key={idx}
              severity="warning"
              icon={<WarningIcon />}
              sx={{ mb: 1, borderRadius: 2 }}
              action={
                alert.includes('pending review') ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => navigate('/review-queue')}
                  >
                    Review
                  </Button>
                ) : null
              }
            >
              {alert}
            </Alert>
          ))}
        </Box>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        {statCards.map((stat, index) => (
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

      {/* Budget Status & Recent Activity */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={5}>
          <Paper
            sx={{
              p: 3,
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
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <LightbulbIcon color="primary" />
              <Typography variant="h5" fontWeight={700}>
                Budget Status
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Top 5 categories by usage
            </Typography>
            {budgetStatus.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxHeight: 320, overflowY: 'auto' }}>
                {budgetStatus.map((budget, index) => (
                  <Box key={index}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {budget.categoryName}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        fontWeight={600}
                        color={budget.isOver ? 'error.main' : 'text.primary'}
                      >
                        {budget.percentage}%
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: '100%',
                        height: 8,
                        bgcolor: 'rgba(0,0,0,0.1)',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          width: `${Math.min(budget.percentage, 100)}%`,
                          height: '100%',
                          background: budget.isOver 
                            ? 'linear-gradient(90deg, #f44336, #e91e63)'
                            : budget.percentage > 80
                            ? 'linear-gradient(90deg, #ff9800, #ffc107)'
                            : 'linear-gradient(90deg, #4caf50, #8bc34a)',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.budget)}
                      </Typography>
                      {budget.isOver && (
                        <Typography variant="caption" color="error.main" fontWeight={600}>
                          Over by {formatCurrency(budget.spent - budget.budget)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">
                  No budgets set yet
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/budgets')}
                  sx={{ mt: 2 }}
                >
                  Create Budget
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper
            sx={{
              p: 3,
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
            {recentExpenses.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
                {recentExpenses.map((transaction) => (
                  <Box
                    key={transaction.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      background: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'rgba(0,0,0,0.02)'
                          : 'rgba(255,255,255,0.05)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      border: '1px solid transparent',
                      '&:hover': {
                        transform: 'translateX(8px)',
                        background: (theme) =>
                          theme.palette.mode === 'light'
                            ? 'rgba(0,0,0,0.04)'
                            : 'rgba(255,255,255,0.08)',
                        borderColor: transaction.categoryColor + '40',
                      },
                    }}
                    onClick={() => navigate('/expenses')}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body1" fontWeight={600} noWrap sx={{ maxWidth: '60%' }}>
                        {transaction.description}
                      </Typography>
                      <Typography variant="body1" fontWeight={700} color={transaction.categoryColor}>
                        {formatCurrency(transaction.amount)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip
                        label={transaction.categoryName}
                        size="small"
                        sx={{
                          background: `${transaction.categoryColor}20`,
                          color: transaction.categoryColor,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                        }}
                      />
                      <Box display="flex" alignItems="center" gap={1}>
                        {transaction.reviewStatus === 'pending' && (
                          <Chip
                            label="Pending"
                            size="small"
                            icon={<PendingIcon sx={{ fontSize: '14px !important' }} />}
                            color="warning"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                        {transaction.reviewStatus === 'approved' && (
                          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(transaction.date)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">
                  No recent expenses
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/expenses')}
                  sx={{ mt: 2 }}
                >
                  Add Expense
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
