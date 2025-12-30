import React, { useMemo, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Alert,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  AccountBalanceWallet,
  Warning as WarningIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  ArrowUpward,
  ArrowDownward,
  CalendarMonth,
  Category as CategoryIcon,
  PieChart,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { ROUTE_PATHS } from '../config/routes.config';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { getTimeBasedGreeting, getTimeEmoji } from '../utils/greetings';
import { useTransactions, useCategories, useBudgets, useAccounts } from '../hooks/useApi';

// Add keyframe animation for refresh icon
const styles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Greeting and emoji
  const greeting = getTimeBasedGreeting();
  const emoji = getTimeEmoji();

  // Fetch data for current month
  const startDate = dayjs().startOf('month').toISOString();
  const endDate = dayjs().endOf('month').toISOString();
  
  const { data: transactionsData, isLoading: loadingTransactions, refetch: refetchTransactions } = useTransactions({
    startDate,
    endDate,
    reviewStatus: 'approved',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const { data: categoriesData, refetch: refetchCategories } = useCategories();
  const { data: budgetsData, refetch: refetchBudgets } = useBudgets();
  const { data: accountsData, refetch: refetchAccounts } = useAccounts();

  const transactions = transactionsData?.data?.transactions || [];
  const categories = categoriesData?.data?.categories || [];
  const budgets = budgetsData?.data?.budgets || [];
  const accounts = accountsData?.data?.accounts || [];

  // Helper function to check if transaction has a specific tag
  const hasTag = (transaction: any, tagName: string): boolean => {
    if (!transaction.tags || !Array.isArray(transaction.tags)) return false;
    return transaction.tags.some((tag: string) => tag.toLowerCase() === tagName.toLowerCase());
  };

  // Calculate statistics
  const stats = useMemo(() => {
    // Expenses = Debit transactions with "expense" tag
    const expenses = transactions.filter((t: any) => t.type === 'debit' && hasTag(t, 'expense'));
    // Income = Credit transactions with "income" tag
    const income = transactions.filter((t: any) => t.type === 'credit' && hasTag(t, 'income'));

    const totalExpenses = expenses.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalIncome = income.reduce((sum: number, t: any) => sum + t.amount, 0);

    return {
      monthExpense: totalExpenses,
      monthIncome: totalIncome,
      netSavings: totalIncome - totalExpenses,
      avgDailyExpense: totalExpenses / dayjs().date(),
      expenseCount: expenses.length,
      incomeCount: income.length,
    };
  }, [transactions]);

  // Get recent transactions
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5).map((t: any) => {
      const category = categories.find((c: any) => c._id === t.categoryId);
      return {
        id: t._id,
        description: t.description,
        amount: t.amount,
        type: t.type,
        categoryName: category?.name || 'Uncategorized',
        categoryColor: category?.color || '#999',
        date: t.date,
      };
    });
  }, [transactions, categories]);

  // Calculate budget status (only for expense transactions)
  const budgetStatus = useMemo(() => {
    return budgets.map((budget: any) => {
      const category = categories.find((c: any) => c._id === budget.categoryId);
      // Only count debit transactions with "expense" tag for budget tracking
      const spent = transactions
        .filter((t: any) => 
          t.type === 'debit' && 
          t.categoryId === budget.categoryId && 
          hasTag(t, 'expense')
        )
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      return {
        categoryName: category?.name || 'Unknown',
        categoryColor: category?.color || '#999',
        spent,
        budget: budget.amount,
        percentage: Math.round((spent / budget.amount) * 100),
        isOver: spent > budget.amount,
      };
    }).filter((b: any) => b.spent > 0 || b.budget > 0); // Only show budgets with activity
  }, [budgets, categories, transactions]);

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'USD', true, 0);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchTransactions(),
      refetchCategories(),
      refetchBudgets(),
      refetchAccounts(),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleQuickAddTransaction = (type: 'income' | 'expense') => {
    navigate(ROUTE_PATHS.TRANSACTIONS, { state: { quickAdd: true, type } });
  };

  const handleStatCardClick = (path: string) => {
    navigate(path);
  };

  if (loadingTransactions) {
    return (
      <Box p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {greeting}, {(user as any)?.name || 'User'}! {emoji}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {dayjs().format('MMMM D, YYYY')}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton
              onClick={handleRefresh}
              disabled={isRefreshing}
              sx={{
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <RefreshIcon sx={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleQuickAddTransaction('expense')}
            sx={{
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              '&:hover': {
                background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                transform: 'translateY(-2px)',
                boxShadow: 4,
              },
              transition: 'all 0.2s',
            }}
          >
            Add Expense
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleQuickAddTransaction('income')}
            sx={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                transform: 'translateY(-2px)',
                boxShadow: 4,
              },
              transition: 'all 0.2s',
            }}
          >
            Add Income
          </Button>
        </Box>
      </Box>

      {/* Summary Banner */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '200px',
            height: '200px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            transform: 'translate(50%, -50%)',
          },
        }}
      >
        <Box position="relative" zIndex={1}>
          {stats.netSavings < 0 ? (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                💸 Expenses exceed income
              </Typography>
              <Typography variant="body1">
                You're spending {formatCurrency(Math.abs(stats.netSavings))} more than your income this month
              </Typography>
            </Box>
          ) : stats.netSavings > 0 ? (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                🎉 Great job saving!
              </Typography>
              <Typography variant="body1">
                You're saving {formatCurrency(stats.netSavings)} this month - Keep it up!
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                💰 Breaking even
              </Typography>
              <Typography variant="body1">
                Your income and expenses are balanced this month
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Month Expenses */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Zoom in timeout={300}>
            <Card
              onClick={() => handleStatCardClick(ROUTE_PATHS.TRANSACTIONS)}
              sx={{
                borderRadius: 3,
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.05) 0%, rgba(244, 63, 94, 0.1) 100%)',
                border: '1px solid',
                borderColor: alpha('#f43f5e', 0.1),
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 12px 24px rgba(244, 63, 94, 0.15)',
                  borderColor: '#f43f5e',
                },
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Avatar
                    sx={{
                      bgcolor: '#f43f5e',
                      width: 56,
                      height: 56,
                      boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)',
                    }}
                  >
                    <TrendingDown sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Chip
                    icon={<ArrowUpward sx={{ fontSize: 16 }} />}
                    label="This month"
                    size="small"
                    sx={{
                      bgcolor: alpha('#f43f5e', 0.1),
                      color: '#f43f5e',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Typography variant="h4" fontWeight={700} gutterBottom color="#f43f5e">
                  {formatCurrency(stats.monthExpense)}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
                  MONTH EXPENSES
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.expenseCount} transactions
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Month Income */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Zoom in timeout={400}>
            <Card
              onClick={() => handleStatCardClick(ROUTE_PATHS.TRANSACTIONS)}
              sx={{
                borderRadius: 3,
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.1) 100%)',
                border: '1px solid',
                borderColor: alpha('#10b981', 0.1),
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 12px 24px rgba(16, 185, 129, 0.15)',
                  borderColor: '#10b981',
                },
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Avatar
                    sx={{
                      bgcolor: '#10b981',
                      width: 56,
                      height: 56,
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <TrendingUp sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Chip
                    icon={<ArrowUpward sx={{ fontSize: 16 }} />}
                    label="This month"
                    size="small"
                    sx={{
                      bgcolor: alpha('#10b981', 0.1),
                      color: '#10b981',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Typography variant="h4" fontWeight={700} gutterBottom color="#10b981">
                  {formatCurrency(stats.monthIncome)}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
                  MONTH INCOME
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.incomeCount} transactions
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Net Savings */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Zoom in timeout={500}>
            <Card
              onClick={() => handleStatCardClick(ROUTE_PATHS.ANALYTICS)}
              sx={{
                borderRadius: 3,
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: stats.netSavings >= 0
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(244, 63, 94, 0.05) 0%, rgba(244, 63, 94, 0.1) 100%)',
                border: '1px solid',
                borderColor: stats.netSavings >= 0 ? alpha('#10b981', 0.1) : alpha('#f43f5e', 0.1),
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: stats.netSavings >= 0
                    ? '0 12px 24px rgba(16, 185, 129, 0.15)'
                    : '0 12px 24px rgba(244, 63, 94, 0.15)',
                  borderColor: stats.netSavings >= 0 ? '#10b981' : '#f43f5e',
                },
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Avatar
                    sx={{
                      bgcolor: stats.netSavings >= 0 ? '#10b981' : '#f43f5e',
                      width: 56,
                      height: 56,
                      boxShadow: stats.netSavings >= 0
                        ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                        : '0 4px 12px rgba(244, 63, 94, 0.3)',
                    }}
                  >
                    <AccountBalanceWallet sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Chip
                    icon={stats.netSavings >= 0 ? <ArrowUpward sx={{ fontSize: 16 }} /> : <ArrowDownward sx={{ fontSize: 16 }} />}
                    label={stats.netSavings >= 0 ? 'Surplus' : 'Deficit'}
                    size="small"
                    sx={{
                      bgcolor: stats.netSavings >= 0 ? alpha('#10b981', 0.1) : alpha('#f43f5e', 0.1),
                      color: stats.netSavings >= 0 ? '#10b981' : '#f43f5e',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  gutterBottom
                  color={stats.netSavings >= 0 ? '#10b981' : '#f43f5e'}
                >
                  {stats.netSavings >= 0 ? '+' : ''}
                  {formatCurrency(stats.netSavings)}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
                  NET SAVINGS
                </Typography>
                <Typography variant="caption" color={stats.netSavings >= 0 ? 'success.main' : 'error.main'}>
                  {stats.netSavings >= 0 ? '🎯 Great!' : '⚠️ Watch spending'}
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Avg Daily Expense */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Zoom in timeout={600}>
            <Card
              onClick={() => handleStatCardClick(ROUTE_PATHS.ANALYTICS)}
              sx={{
                borderRadius: 3,
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.1) 100%)',
                border: '1px solid',
                borderColor: alpha('#3b82f6', 0.1),
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 12px 24px rgba(59, 130, 246, 0.15)',
                  borderColor: '#3b82f6',
                },
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Avatar
                    sx={{
                      bgcolor: '#3b82f6',
                      width: 56,
                      height: 56,
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <CalendarMonth sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Chip
                    label={`${dayjs().date()} days`}
                    size="small"
                    sx={{
                      bgcolor: alpha('#3b82f6', 0.1),
                      color: '#3b82f6',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Typography variant="h4" fontWeight={700} gutterBottom color="#3b82f6">
                  {formatCurrency(stats.avgDailyExpense)}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
                  AVG DAILY EXPENSE
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Per day this month
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Transactions */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Avatar sx={{ bgcolor: '#14b8a6', width: 40, height: 40 }}>
                  <Receipt />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Recent Transactions
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Latest activity
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS)}
                endIcon={<ArrowUpward sx={{ transform: 'rotate(45deg)' }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#14b8a6',
                  '&:hover': { bgcolor: alpha('#14b8a6', 0.08) },
                }}
              >
                View All
              </Button>
            </Box>
            {recentTransactions.length > 0 ? (
              <List sx={{ p: 0 }}>
                {recentTransactions.map((txn: any, index: number) => (
                  <Fade in timeout={300 + index * 100} key={txn.id}>
                    <ListItem
                      onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS)}
                      sx={{
                        borderRadius: 2,
                        mb: 1.5,
                        bgcolor: 'action.hover',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '1px solid transparent',
                        '&:hover': {
                          bgcolor: 'background.paper',
                          borderColor: '#14b8a6',
                          transform: 'translateX(4px)',
                          boxShadow: '0 4px 12px rgba(20, 184, 166, 0.15)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: txn.categoryColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2,
                        }}
                      >
                        <CategoryIcon sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body1" fontWeight={600}>
                              {txn.description}
                            </Typography>
                            <Typography
                              variant="h6"
                              fontWeight={700}
                              color={txn.type === 'credit' ? 'success.main' : 'error.main'}
                            >
                              {txn.type === 'credit' ? '+' : '-'}
                              {formatCurrency(txn.amount)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.5}>
                            <Chip
                              label={txn.categoryName}
                              size="small"
                              sx={{
                                bgcolor: alpha(txn.categoryColor, 0.1),
                                color: txn.categoryColor,
                                height: 22,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                              {dayjs(txn.date).format('MMM D, h:mm A')}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </Fade>
                ))}
              </List>
            ) : (
              <Box textAlign="center" py={8}>
                <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'action.hover' }}>
                  <Receipt sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Avatar>
                <Typography color="text.secondary" gutterBottom fontWeight={600}>
                  No transactions yet
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Start tracking your finances by adding your first transaction
                </Typography>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    borderColor: '#14b8a6',
                    color: '#14b8a6',
                    '&:hover': {
                      borderColor: '#0d9488',
                      bgcolor: alpha('#14b8a6', 0.05),
                    },
                  }}
                >
                  Add Transaction
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Budget Status */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Avatar sx={{ bgcolor: '#f59e0b', width: 40, height: 40 }}>
                  <PieChart />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Budget Status
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    This month's progress
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                onClick={() => navigate(ROUTE_PATHS.BUDGETS)}
                endIcon={<ArrowUpward sx={{ transform: 'rotate(45deg)' }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#f59e0b',
                  '&:hover': { bgcolor: alpha('#f59e0b', 0.08) },
                }}
              >
                View All
              </Button>
            </Box>
            {budgetStatus.length > 0 ? (
              <Box>
                {budgetStatus.map((budget: any, index: number) => (
                  <Fade in timeout={300 + index * 100} key={index}>
                    <Box
                      onClick={() => navigate(ROUTE_PATHS.BUDGETS)}
                      sx={{
                        borderRadius: 2,
                        mb: 2,
                        p: 2,
                        bgcolor: 'action.hover',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '1px solid transparent',
                        '&:hover': {
                          bgcolor: 'background.paper',
                          borderColor: '#f59e0b',
                          transform: 'scale(1.02)',
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
                        },
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1.5,
                              bgcolor: budget.categoryColor || '#6366f1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CategoryIcon sx={{ color: 'white', fontSize: 16 }} />
                          </Box>
                          <Typography variant="body1" fontWeight={700}>
                            {budget.categoryName}
                          </Typography>
                        </Box>
                        <Chip
                          label={`${Math.min(budget.percentage, 100)}%`}
                          size="small"
                          sx={{
                            bgcolor: budget.isOver
                              ? alpha('#ef4444', 0.1)
                              : budget.percentage > 80
                              ? alpha('#f59e0b', 0.1)
                              : alpha('#10b981', 0.1),
                            color: budget.isOver ? '#ef4444' : budget.percentage > 80 ? '#f59e0b' : '#10b981',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        />
                      </Box>
                      <Box
                        sx={{
                          height: 8,
                          borderRadius: 1,
                          bgcolor: 'action.selected',
                          overflow: 'hidden',
                          mb: 1,
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            width: `${Math.min(budget.percentage, 100)}%`,
                            bgcolor: budget.isOver
                              ? '#ef4444'
                              : budget.percentage > 80
                              ? '#f59e0b'
                              : '#10b981',
                            transition: 'width 0.5s ease-in-out',
                            borderRadius: 1,
                          }}
                        />
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {formatCurrency(budget.spent)} of {formatCurrency(budget.budget)}
                        </Typography>
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          color={budget.isOver ? 'error.main' : 'text.secondary'}
                        >
                          {formatCurrency(budget.budget - budget.spent)} left
                        </Typography>
                      </Box>
                    </Box>
                  </Fade>
                ))}
              </Box>
            ) : (
              <Box textAlign="center" py={8}>
                <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'action.hover' }}>
                  <PieChart sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Avatar>
                <Typography color="text.secondary" gutterBottom fontWeight={600}>
                  No budgets set
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Create budgets to track your spending across categories
                </Typography>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(ROUTE_PATHS.BUDGETS)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    borderColor: '#f59e0b',
                    color: '#f59e0b',
                    '&:hover': {
                      borderColor: '#d97706',
                      bgcolor: alpha('#f59e0b', 0.05),
                    },
                  }}
                >
                  Create Budget
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Account Balances */}
        <Grid size={{ xs: 12 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Avatar sx={{ bgcolor: '#8b5cf6', width: 40, height: 40 }}>
                  <AccountBalanceIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Account Balances
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    All your accounts
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                onClick={() => navigate(ROUTE_PATHS.ACCOUNTS)}
                endIcon={<ArrowUpward sx={{ transform: 'rotate(45deg)' }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#8b5cf6',
                  '&:hover': { bgcolor: alpha('#8b5cf6', 0.08) },
                }}
              >
                View All
              </Button>
            </Box>
            {accounts.length > 0 ? (
              <Grid container spacing={2}>
                {accounts.slice(0, 4).map((account: any, index: number) => (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={account._id}>
                    <Zoom in timeout={300 + index * 100}>
                      <Card
                        onClick={() => navigate(ROUTE_PATHS.ACCOUNTS)}
                        sx={{
                          borderRadius: 3,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.1) 100%)',
                          border: '1px solid',
                          borderColor: alpha('#8b5cf6', 0.1),
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 8px 16px rgba(139, 92, 246, 0.15)',
                            borderColor: '#8b5cf6',
                          },
                        }}
                      >
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                            <Avatar
                              sx={{
                                bgcolor: '#8b5cf6',
                                width: 36,
                                height: 36,
                              }}
                            >
                              <AccountBalanceIcon sx={{ fontSize: 20 }} />
                            </Avatar>
                            <Typography variant="body1" fontWeight={700} noWrap>
                              {account.name}
                            </Typography>
                          </Box>
                          <Typography variant="h5" fontWeight={700} color="#8b5cf6" gutterBottom>
                            {formatCurrency(account.balance)}
                          </Typography>
                          <Chip
                            label={account.accountType}
                            size="small"
                            sx={{
                              textTransform: 'capitalize',
                              bgcolor: alpha('#8b5cf6', 0.1),
                              color: '#8b5cf6',
                              fontWeight: 600,
                            }}
                          />
                        </CardContent>
                      </Card>
                    </Zoom>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box textAlign="center" py={8}>
                <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'action.hover' }}>
                  <AccountBalanceIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Avatar>
                <Typography color="text.secondary" gutterBottom fontWeight={600}>
                  No accounts added
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Add your financial accounts to track all your balances in one place
                </Typography>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(ROUTE_PATHS.ACCOUNTS)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    borderColor: '#8b5cf6',
                    color: '#8b5cf6',
                    '&:hover': {
                      borderColor: '#7c3aed',
                      bgcolor: alpha('#8b5cf6', 0.05),
                    },
                  }}
                >
                  Add Account
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
