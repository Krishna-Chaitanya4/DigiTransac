import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  Avatar,
  Chip,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Assessment,
  Refresh as RefreshIcon,
  Download,
  ArrowUpward,
  ArrowDownward,
  AccountBalance,
  Lightbulb,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { formatCurrency as formatCurrencyUtil, CURRENCIES } from '../utils/currency';
import { useTransactions, useCategories, useAccounts, useTags } from '../hooks/useApi';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../config/routes.config';
import FilterPanel, { FilterConfig, FilterValues } from '../components/FilterPanel';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// Add keyframe animation
const styles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

const Analytics: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter state
  const [filterValues, setFilterValues] = useState<FilterValues>({
    startDate: dayjs().startOf('month'),
    endDate: dayjs().endOf('month'),
    activeDateFilter: 'thisMonth',
    transactionType: 'all',
    selectedAccount: '',
    selectedCategories: [],
    includeTags: [],
    excludeTags: [],
    minAmount: '',
    maxAmount: '',
  });

  // Fetch data
  const { data: transactionsData, isLoading, refetch: refetchTransactions } = useTransactions({
    startDate: filterValues.startDate?.toISOString() || dayjs().startOf('month').toISOString(),
    endDate: filterValues.endDate?.toISOString() || dayjs().endOf('month').toISOString(),
    reviewStatus: 'approved',
  });

  const { data: categoriesData, refetch: refetchCategories } = useCategories();
  const { data: accountsData, refetch: refetchAccounts } = useAccounts();
  const { data: tagsData } = useTags();

  const transactions = transactionsData?.data?.transactions || [];
  const categories = categoriesData?.data?.categories || [];
  const accounts = accountsData?.data?.accounts || [];
  const tags = tagsData?.data?.tags || [];

  // Helper to check if transaction has specific tag
  const hasTag = (transaction: any, tagName: string): boolean => {
    if (!transaction.tags || !Array.isArray(transaction.tags)) return false;
    return transaction.tags.some((tag: any) =>
      typeof tag === 'string'
        ? tag.toLowerCase() === tagName.toLowerCase()
        : tag?.name?.toLowerCase() === tagName.toLowerCase()
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'USD', true, 0);
  };

  // Get currency symbol
  const userCurrency = user?.currency || 'USD';
  const currencySymbol = CURRENCIES[userCurrency]?.symbol || '$';

  // Filter config for Analytics
  const filterConfig: FilterConfig = {
    showDateRange: true,
    showQuickDatePresets: true,
    showTransactionType: true,
    showAccount: true,
    showCategories: true,
    showTags: true,
    showAmountRange: true,
    collapsible: true,
    defaultExpanded: false,
  };

  // Handle clear all filters
  const handleClearFilters = () => {
    setFilterValues({
      startDate: dayjs().startOf('month'),
      endDate: dayjs().endOf('month'),
      activeDateFilter: 'thisMonth',
      transactionType: 'all',
      selectedAccount: '',
      selectedCategories: [],
      includeTags: [],
      excludeTags: [],
      minAmount: '',
      maxAmount: '',
    });
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchTransactions(), refetchCategories(), refetchAccounts()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn: any) => {
      // Transaction type filter
      if (filterValues.transactionType === 'credit' && txn.type !== 'credit') return false;
      if (filterValues.transactionType === 'debit' && txn.type !== 'debit') return false;

      // Account filter
      if (filterValues.selectedAccount && txn.accountId !== filterValues.selectedAccount) return false;
      
      // Category filter
      if (filterValues.selectedCategories && filterValues.selectedCategories.length > 0) {
        if (!filterValues.selectedCategories.includes(txn.categoryId)) return false;
      }

      // Include tags filter
      if (filterValues.includeTags && filterValues.includeTags.length > 0) {
        const hasAnyIncludeTag = filterValues.includeTags.some(tag => hasTag(txn, tag));
        if (!hasAnyIncludeTag) return false;
      }

      // Exclude tags filter
      if (filterValues.excludeTags && filterValues.excludeTags.length > 0) {
        const hasAnyExcludeTag = filterValues.excludeTags.some(tag => hasTag(txn, tag));
        if (hasAnyExcludeTag) return false;
      }

      // Amount range filter
      if (filterValues.minAmount) {
        const min = parseFloat(filterValues.minAmount);
        if (txn.amount < min) return false;
      }
      if (filterValues.maxAmount) {
        const max = parseFloat(filterValues.maxAmount);
        if (txn.amount > max) return false;
      }

      return true;
    });
  }, [transactions, filterValues]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const expenses = filteredTransactions
      .filter((txn: any) => txn.type === 'debit' && hasTag(txn, 'expense'))
      .reduce((sum: number, txn: any) => sum + txn.amount, 0);

    const income = filteredTransactions
      .filter((txn: any) => txn.type === 'credit' && hasTag(txn, 'income'))
      .reduce((sum: number, txn: any) => sum + txn.amount, 0);

    const net = income - expenses;
    const savingsRate = income > 0 ? ((net / income) * 100) : 0;

    // Previous period comparison
    const daysDiff = filterValues.endDate?.diff(filterValues.startDate, 'day') || 30;
    const prevStart = filterValues.startDate?.subtract(daysDiff, 'day');
    const prevEnd = filterValues.startDate?.subtract(1, 'day');

    const prevExpenses = transactions
      .filter((txn: any) => {
        const txnDate = dayjs(txn.date);
        return txnDate.isAfter(prevStart) && txnDate.isBefore(prevEnd) && 
               txn.type === 'debit' && hasTag(txn, 'expense');
      })
      .reduce((sum: number, txn: any) => sum + txn.amount, 0);

    const prevIncome = transactions
      .filter((txn: any) => {
        const txnDate = dayjs(txn.date);
        return txnDate.isAfter(prevStart) && txnDate.isBefore(prevEnd) && 
               txn.type === 'credit' && hasTag(txn, 'income');
      })
      .reduce((sum: number, txn: any) => sum + txn.amount, 0);

    const expenseChange = prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : 0;
    const incomeChange = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0;

    return {
      expenses,
      income,
      net,
      savingsRate,
      expenseChange,
      incomeChange,
      avgDailyExpense: expenses / (daysDiff || 1),
      transactionCount: filteredTransactions.length,
    };
  }, [filteredTransactions, transactions, filterValues.startDate, filterValues.endDate]);

  // Smart Insights
  const insights = useMemo(() => {
    const insights: string[] = [];

    // Savings rate insight
    if (summaryStats.savingsRate > 20) {
      insights.push(`🎉 Excellent! You're saving ${summaryStats.savingsRate.toFixed(1)}% of your income`);
    } else if (summaryStats.savingsRate > 10) {
      insights.push(`💰 Good job! Saving ${summaryStats.savingsRate.toFixed(1)}% - try to reach 20%`);
    } else if (summaryStats.savingsRate > 0) {
      insights.push(`⚠️ Low savings rate (${summaryStats.savingsRate.toFixed(1)}%) - consider reducing expenses`);
    } else {
      insights.push(`🚨 Spending exceeds income - review your budget immediately`);
    }

    // Expense trend insight
    if (summaryStats.expenseChange > 10) {
      insights.push(`📈 Expenses increased ${summaryStats.expenseChange.toFixed(1)}% from previous period`);
    } else if (summaryStats.expenseChange < -10) {
      insights.push(`📉 Great! Expenses decreased ${Math.abs(summaryStats.expenseChange).toFixed(1)}%`);
    }

    // Top spending day
    const dayMap = new Map<string, number>();
    filteredTransactions
      .filter((txn: any) => txn.type === 'debit')
      .forEach((txn: any) => {
        const day = dayjs(txn.date).format('dddd');
        dayMap.set(day, (dayMap.get(day) || 0) + txn.amount);
      });
    
    if (dayMap.size > 0) {
      const topDay = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0];
      insights.push(`📅 ${topDay[0]} is your highest spending day (${formatCurrency(topDay[1])})`);
    }

    // Top category
    const categoryMap = new Map<string, number>();
    filteredTransactions
      .filter((txn: any) => txn.type === 'debit' && txn.categoryId)
      .forEach((txn: any) => {
        const category = categories.find((c: any) => c._id === txn.categoryId);
        if (category) {
          categoryMap.set(category.name, (categoryMap.get(category.name) || 0) + txn.amount);
        }
      });

    if (categoryMap.size > 0) {
      const topCategory = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0];
      insights.push(`🏆 Highest spending: ${topCategory[0]} (${formatCurrency(topCategory[1])})`);
    }

    return insights;
  }, [filteredTransactions, summaryStats, categories]);

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const monthMap = new Map<string, { income: number; expenses: number }>();

    filteredTransactions.forEach((txn: any) => {
      const month = dayjs(txn.date).format('MMM YY');
      const existing = monthMap.get(month) || { income: 0, expenses: 0 };
      
      if (txn.type === 'credit' && hasTag(txn, 'income')) {
        existing.income += txn.amount;
      } else if (txn.type === 'debit' && hasTag(txn, 'expense')) {
        existing.expenses += txn.amount;
      }
      
      monthMap.set(month, existing);
    });

    return Array.from(monthMap.entries())
      .map(([month, values]) => ({
        month,
        income: values.income,
        expenses: values.expenses,
        net: values.income - values.expenses,
      }))
      .sort((a, b) => dayjs(a.month, 'MMM YY').unix() - dayjs(b.month, 'MMM YY').unix());
  }, [filteredTransactions]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, { name: string; value: number; color: string }>();

    filteredTransactions
      .filter((txn: any) => txn.type === 'debit' && hasTag(txn, 'expense'))
      .forEach((txn: any) => {
        const category = categories.find((c: any) => c._id === txn.categoryId);
        if (category) {
          const existing = categoryMap.get(category._id);
          categoryMap.set(category._id, {
            name: category.name,
            value: (existing?.value || 0) + txn.amount,
            color: category.color || '#6366f1',
          });
        }
      });

    return Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredTransactions, categories]);

  // Top merchants
  const topMerchants = useMemo(() => {
    const merchantMap = new Map<string, { amount: number; count: number }>();

    filteredTransactions
      .filter((txn: any) => txn.type === 'debit' && txn.merchant)
      .forEach((txn: any) => {
        const existing = merchantMap.get(txn.merchant);
        merchantMap.set(txn.merchant, {
          amount: (existing?.amount || 0) + txn.amount,
          count: (existing?.count || 0) + 1,
        });
      });

    return Array.from(merchantMap.entries())
      .map(([name, data]) => ({ name, ...data, avg: data.amount / data.count }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredTransactions]);

  // Export to CSV
  const handleExport = () => {
    const csvData = filteredTransactions.map((txn: any) => ({
      Date: dayjs(txn.date).format('YYYY-MM-DD'),
      Description: txn.description,
      Category: categories.find((c: any) => c._id === txn.categoryId)?.name || 'Uncategorized',
      Amount: txn.amount,
      Type: txn.type,
      Account: accounts.find((a: any) => a._id === txn.accountId)?.name || 'Unknown',
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map((row: any) => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Fade in timeout={300}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: '#6366f1', width: 56, height: 56 }}>
                <Assessment sx={{ fontSize: 32 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  Financial Analytics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Insights and trends for your financial data
                </Typography>
              </Box>
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
              <Tooltip title="Export CSV">
                <IconButton
                  onClick={handleExport}
                  sx={{
                    bgcolor: 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <Download />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Fade>

        {/* Filters */}
        <Fade in timeout={400}>
          <Box>
            <FilterPanel
              config={filterConfig}
              values={filterValues}
              onChange={setFilterValues}
              accounts={accounts}
              categories={categories}
              tags={tags}
              onClearAll={handleClearFilters}
              currencySymbol={currencySymbol}
            />
          </Box>
        </Fade>

        {/* Smart Insights */}
        <Fade in timeout={500}>
          <Paper
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: '1px solid',
              borderColor: alpha('#f59e0b', 0.3),
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5} mb={2}>
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 40, height: 40 }}>
                <Lightbulb />
              </Avatar>
              <Typography variant="h6" fontWeight={700}>
                Smart Insights
              </Typography>
            </Box>
            <Box display="flex" flexDirection="column" gap={1}>
              {insights.map((insight, index) => (
                <Fade in timeout={600 + index * 100} key={index}>
                  <Typography variant="body1" sx={{ opacity: 0.95 }}>
                    {insight}
                  </Typography>
                </Fade>
              ))}
            </Box>
          </Paper>
        </Fade>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Zoom in timeout={300}>
              <Card
                onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS, { state: { filter: 'income' } })}
                sx={{
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
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
                    <Avatar sx={{ bgcolor: '#10b981', width: 48, height: 48 }}>
                      <TrendingUp />
                    </Avatar>
                    <Chip
                      icon={summaryStats.incomeChange >= 0 ? <ArrowUpward sx={{ fontSize: 16 }} /> : <ArrowDownward sx={{ fontSize: 16 }} />}
                      label={`${Math.abs(summaryStats.incomeChange).toFixed(1)}%`}
                      size="small"
                      sx={{
                        bgcolor: summaryStats.incomeChange >= 0 ? alpha('#10b981', 0.1) : alpha('#ef4444', 0.1),
                        color: summaryStats.incomeChange >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Typography variant="h4" fontWeight={700} color="#10b981" gutterBottom>
                    {formatCurrency(summaryStats.income)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    TOTAL INCOME
                  </Typography>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Zoom in timeout={400}>
              <Card
                onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS, { state: { filter: 'expense' } })}
                sx={{
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
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
                    <Avatar sx={{ bgcolor: '#f43f5e', width: 48, height: 48 }}>
                      <TrendingDown />
                    </Avatar>
                    <Chip
                      icon={summaryStats.expenseChange >= 0 ? <ArrowUpward sx={{ fontSize: 16 }} /> : <ArrowDownward sx={{ fontSize: 16 }} />}
                      label={`${Math.abs(summaryStats.expenseChange).toFixed(1)}%`}
                      size="small"
                      sx={{
                        bgcolor: summaryStats.expenseChange >= 0 ? alpha('#ef4444', 0.1) : alpha('#10b981', 0.1),
                        color: summaryStats.expenseChange >= 0 ? '#ef4444' : '#10b981',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Typography variant="h4" fontWeight={700} color="#f43f5e" gutterBottom>
                    {formatCurrency(summaryStats.expenses)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    TOTAL EXPENSES
                  </Typography>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Zoom in timeout={500}>
              <Card
                sx={{
                  borderRadius: 3,
                  transition: 'all 0.3s',
                  background: summaryStats.net >= 0
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.1) 100%)'
                    : 'linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, rgba(249, 115, 22, 0.1) 100%)',
                  border: '1px solid',
                  borderColor: summaryStats.net >= 0 ? alpha('#3b82f6', 0.1) : alpha('#f97316', 0.1),
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: summaryStats.net >= 0
                      ? '0 12px 24px rgba(59, 130, 246, 0.15)'
                      : '0 12px 24px rgba(249, 115, 22, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Avatar
                      sx={{
                        bgcolor: summaryStats.net >= 0 ? '#3b82f6' : '#f97316',
                        width: 48,
                        height: 48,
                      }}
                    >
                      <AccountBalance />
                    </Avatar>
                  </Box>
                  <Typography
                    variant="h4"
                    fontWeight={700}
                    color={summaryStats.net >= 0 ? '#3b82f6' : '#f97316'}
                    gutterBottom
                  >
                    {formatCurrency(summaryStats.net)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    NET SAVINGS
                  </Typography>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Zoom in timeout={600}>
              <Card
                sx={{
                  borderRadius: 3,
                  transition: 'all 0.3s',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  border: '1px solid',
                  borderColor: alpha('#8b5cf6', 0.1),
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 24px rgba(139, 92, 246, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Avatar sx={{ bgcolor: '#8b5cf6', width: 48, height: 48 }}>
                      <TrendingDown />
                    </Avatar>
                    <Chip
                      label={`${summaryStats.savingsRate.toFixed(1)}%`}
                      size="small"
                      sx={{
                        bgcolor: alpha('#8b5cf6', 0.1),
                        color: '#8b5cf6',
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                  <Typography variant="h4" fontWeight={700} color="#8b5cf6" gutterBottom>
                    {formatCurrency(summaryStats.avgDailyExpense)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    AVG DAILY EXPENSE
                  </Typography>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>
        </Grid>

        {/* Charts */}
        <Grid container spacing={3}>
          {/* Income vs Expenses Trend */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Fade in timeout={700}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  height: '100%',
                }}
              >
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Income vs Expenses Trend
                </Typography>
                {monthlyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value: any) => formatCurrency(value)}
                        contentStyle={{ borderRadius: 8 }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="income"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: '#10b981', r: 5 }}
                        name="Income"
                      />
                      <Line
                        type="monotone"
                        dataKey="expenses"
                        stroke="#f43f5e"
                        strokeWidth={3}
                        dot={{ fill: '#f43f5e', r: 5 }}
                        name="Expenses"
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: '#3b82f6', r: 4 }}
                        name="Net"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Box textAlign="center" py={10}>
                    <Typography color="text.secondary">No data available for chart</Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>

          {/* Category Breakdown */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Fade in timeout={800}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  height: '100%',
                }}
              >
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Expense by Category
                </Typography>
                {categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any) => formatCurrency(value)}
                        contentStyle={{ borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box textAlign="center" py={10}>
                    <Typography color="text.secondary">No category data available</Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>

          {/* Top Merchants */}
          <Grid size={{ xs: 12 }}>
            <Fade in timeout={900}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Top Merchants
                </Typography>
                {topMerchants.length > 0 ? (
                  <Grid container spacing={2}>
                    {topMerchants.map((merchant, index) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }} key={index}>
                        <Card
                          sx={{
                            borderRadius: 2,
                            bgcolor: 'action.hover',
                            transition: 'all 0.2s',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 4,
                            },
                          }}
                        >
                          <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom noWrap>
                              {merchant.name}
                            </Typography>
                            <Typography variant="h5" color="primary" fontWeight={700} gutterBottom>
                              {formatCurrency(merchant.amount)}
                            </Typography>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">
                                {merchant.count} transactions
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Avg: {formatCurrency(merchant.avg)}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Box textAlign="center" py={6}>
                    <Typography color="text.secondary">No merchant data available</Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default Analytics;
