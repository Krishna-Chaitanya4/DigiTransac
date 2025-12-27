import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  Avatar,
  useTheme,
} from '@mui/material';
import { ModernDatePicker } from '../components/ModernDatePicker';
import {
  LocalizationProvider,
} from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Assessment,
  Category as CategoryIcon,
  Store,
  AccountBalanceWallet,
  AccountBalance,
  CalendarMonth,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { getCurrentMonthYear } from '../utils/greetings';
import axios from 'axios';
import ResponsiveChart from '../components/ResponsiveChart';

// Date range presets
const DATE_RANGES = [
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 90 Days', value: 90 },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'This Year', value: 'year' },
  { label: 'Custom', value: 'custom' },
];

// Chart colors - using centralized theme function
const getChartColors = (theme: any) => ({
  primary: theme.palette.primary.main,
  success: theme.palette.success.main,
  error: theme.palette.error.main,
  warning: theme.palette.warning.main,
  info: theme.palette.info.main,
  categoryColors: [
    theme.palette.primary.main,
    theme.palette.info.main,
    theme.palette.info.dark,
    theme.palette.info.light,
    theme.palette.success.main,
    theme.palette.success.light,
    theme.palette.warning.main,
    theme.palette.warning.light,
    '#8b5cf6', '#a78bfa', '#ec4899', '#f472b6',
  ],
});

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  categoryId: string;
  category?: { name: string; color: string };
  merchant?: string;
  tags?: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

const Analytics: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const COLORS = useMemo(() => getChartColors(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Date range state
  const [dateRangeType, setDateRangeType] = useState<string | number>('month');
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs().endOf('month'));

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);

  // Calculate date range based on selection
  useEffect(() => {
    const today = dayjs();
    switch (dateRangeType) {
      case 7:
        setStartDate(today.subtract(7, 'days'));
        setEndDate(today);
        break;
      case 30:
        setStartDate(today.subtract(30, 'days'));
        setEndDate(today);
        break;
      case 90:
        setStartDate(today.subtract(90, 'days'));
        setEndDate(today);
        break;
      case 'month':
        setStartDate(today.startOf('month'));
        setEndDate(today.endOf('month'));
        break;
      case 'lastMonth':
        setStartDate(today.subtract(1, 'month').startOf('month'));
        setEndDate(today.subtract(1, 'month').endOf('month'));
        break;
      case 'year':
        setStartDate(today.startOf('year'));
        setEndDate(today.endOf('year'));
        break;
      case 'custom':
        // Keep existing dates
        break;
    }
  }, [dateRangeType]);

  // Fetch data
  useEffect(() => {
    if (startDate && endDate) {
      fetchAnalyticsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchAnalyticsData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [txnRes, catRes, budgetRes] = await Promise.all([
        axios.get('/api/transactions', {
          params: {
            startDate: startDate?.format('YYYY-MM-DD'),
            endDate: endDate?.format('YYYY-MM-DD'),
          },
          headers,
        }),
        axios.get('/api/categories', { headers }),
        axios.get('/api/budgets', { headers }),
      ]);

      const txnData = txnRes.data.transactions || [];
      const catData = Array.isArray(catRes.data) ? catRes.data : catRes.data?.categories || [];
      const budgetData = Array.isArray(budgetRes.data) ? budgetRes.data : budgetRes.data?.budgets || [];
      
      setTransactions(txnData);
      setCategories(catData);
      setBudgets(budgetData);
    } catch (err: any) {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [user, startDate, endDate]);

  // Create category map for lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    if (Array.isArray(categories)) {
      categories.forEach((cat) => map.set(cat.id, cat));
    }
    return map;
  }, [categories]);

  // Enrich transactions with category data
  const enrichedTransactions = useMemo(() => {
    return transactions.map((txn) => ({
      ...txn,
      category: categoryMap.get(txn.categoryId),
    }));
  }, [transactions, categoryMap]);

  // 1. Income vs Expense over time (Line Chart)
  const incomeExpenseData = useMemo(() => {
    const monthlyMap = new Map<string, { income: number; expenses: number }>();

    enrichedTransactions.forEach((txn) => {
      const monthKey = dayjs(txn.date).format('MMM YY');
      const existing = monthlyMap.get(monthKey) || { income: 0, expenses: 0 };

      if (txn.type === 'credit') {
        existing.income += txn.amount;
      } else {
        existing.expenses += txn.amount;
      }

      monthlyMap.set(monthKey, existing);
    });

    const data: MonthlyData[] = Array.from(monthlyMap.entries())
      .map(([month, values]) => ({
        month,
        income: values.income,
        expenses: values.expenses,
        net: values.income - values.expenses,
      }))
      .sort((a, b) => dayjs(a.month, 'MMM YY').unix() - dayjs(b.month, 'MMM YY').unix());

    return data;
  }, [enrichedTransactions]);

  // 2. Category Breakdown (Pie Chart)
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, { name: string; value: number; color: string }>();

    enrichedTransactions
      .filter((txn) => txn.type === 'debit')
      .forEach((txn) => {
        if (txn.category) {
          const existing = categoryMap.get(txn.categoryId);
          categoryMap.set(txn.categoryId, {
            name: txn.category.name,
            value: (existing?.value || 0) + txn.amount,
            color: txn.category.color,
          });
        }
      });

    const total = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.value, 0);

    return Array.from(categoryMap.values())
      .map((cat) => ({
        ...cat,
        percentage: (cat.value / total) * 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories
  }, [enrichedTransactions]);

  // 3. Daily Spending Trends (Bar Chart)
  const dailySpendingData = useMemo(() => {
    const dailyMap = new Map<string, number>();

    enrichedTransactions
      .filter((txn) => txn.type === 'debit')
      .forEach((txn) => {
        const dayKey = dayjs(txn.date).format('MMM DD');
        dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + txn.amount);
      });

    return Array.from(dailyMap.entries())
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => dayjs(a.day, 'MMM DD').unix() - dayjs(b.day, 'MMM DD').unix())
      .slice(-30); // Last 30 days max
  }, [enrichedTransactions]);

  // 4. Budget vs Actual Comparison (Bar Chart)
  const budgetComparisonData = useMemo(() => {
    const categorySpending = new Map<string, number>();

    enrichedTransactions
      .filter((txn) => txn.type === 'debit')
      .forEach((txn) => {
        categorySpending.set(
          txn.categoryId,
          (categorySpending.get(txn.categoryId) || 0) + txn.amount
        );
      });

    return budgets
      .map((budget) => {
        const category = categoryMap.get(budget.categoryId);
        const spent = categorySpending.get(budget.categoryId) || 0;
        return {
          name: category?.name || 'Unknown',
          budget: budget.amount,
          spent,
          remaining: Math.max(0, budget.amount - spent),
        };
      })
      .slice(0, 6); // Top 6 budgets
  }, [enrichedTransactions, budgets, categoryMap]);

  // 5. Top Merchants (Table)
  const topMerchants = useMemo(() => {
    const merchantMap = new Map<string, { amount: number; count: number }>();

    enrichedTransactions
      .filter((txn) => txn.type === 'debit' && txn.merchant)
      .forEach((txn) => {
        const merchant = txn.merchant || 'Unknown';
        const existing = merchantMap.get(merchant);
        merchantMap.set(merchant, {
          amount: (existing?.amount || 0) + txn.amount,
          count: (existing?.count || 0) + 1,
        });
      });

    return Array.from(merchantMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [enrichedTransactions]);

  // 6. Month-over-Month Comparison (Table)
  const monthOverMonthData = useMemo(() => {
    const monthlyMap = new Map<string, { income: number; expenses: number }>();

    enrichedTransactions.forEach((txn) => {
      const monthKey = dayjs(txn.date).format('MMM YYYY');
      const existing = monthlyMap.get(monthKey) || { income: 0, expenses: 0 };

      if (txn.type === 'credit') {
        existing.income += txn.amount;
      } else {
        existing.expenses += txn.amount;
      }

      monthlyMap.set(monthKey, existing);
    });

    const sorted = Array.from(monthlyMap.entries())
      .map(([month, values]) => ({
        month,
        income: values.income,
        expenses: values.expenses,
        net: values.income - values.expenses,
      }))
      .sort((a, b) => dayjs(b.month, 'MMM YYYY').unix() - dayjs(a.month, 'MMM YYYY').unix());

    // Calculate changes
    return sorted.map((item, index) => {
      const prev = sorted[index + 1];
      return {
        ...item,
        incomeChange: prev ? ((item.income - prev.income) / prev.income) * 100 : 0,
        expensesChange: prev ? ((item.expenses - prev.expenses) / prev.expenses) * 100 : 0,
      };
    });
  }, [enrichedTransactions]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const income = enrichedTransactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = enrichedTransactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    const net = income - expenses;
    const avgDailySpending = expenses / (endDate?.diff(startDate, 'days') || 1);

    return { income, expenses, net, avgDailySpending };
  }, [enrichedTransactions, startDate, endDate]);

  const formatCurrency = useCallback((amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'USD', true, 0);
  }, [user?.currency]);

  const exportData = useCallback(() => {
    const csvData = [
      ['Date', 'Description', 'Category', 'Amount', 'Type'],
      ...enrichedTransactions.map((txn) => [
        dayjs(txn.date).format('YYYY-MM-DD'),
        txn.description,
        txn.category?.name || 'Uncategorized',
        txn.amount.toString(),
        txn.type,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [enrichedTransactions]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Enhanced Animated Header */}
      <Fade in timeout={600}>
        <Box
          sx={{
            mb: 4,
            p: 4,
            borderRadius: 4,
            position: 'relative',
            overflow: 'hidden',
            background: (theme) =>
              theme.palette.mode === 'light'
                ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 50%, ${theme.palette.primary.dark} 100%)`
                : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.dark} 50%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: (theme) => `0 8px 32px ${theme.palette.primary.main}40`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)',
              animation: 'pulse 4s ease-in-out infinite',
            },
            '@keyframes pulse': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Avatar
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(10px)',
                      width: 56,
                      height: 56,
                    }}
                  >
                    <Assessment sx={{ fontSize: 32 }} />
                  </Avatar>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{
                      color: 'white',
                      letterSpacing: '-0.02em',
                      textShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    }}
                  >
                    Financial Insights
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, ml: 9 }}>
                  {getCurrentMonthYear()} • Net Savings: {formatCurrency(summaryStats.net)}
                </Typography>
              </Box>
              <Zoom in timeout={800}>
                <Tooltip title="Export to CSV">
                  <IconButton
                    onClick={exportData}
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      width: 48,
                      height: 48,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                        bgcolor: 'rgba(255,255,255,0.95)',
                      },
                    }}
                  >
                    <Download />
                  </IconButton>
                </Tooltip>
              </Zoom>
            </Box>
          </Box>
        </Box>
      </Fade>

      {/* Date Range Filter */}
      <Box sx={{ mb: 4 }}>
        <Fade in timeout={800}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                  : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? `1px solid ${theme.palette.primary.main}1A`
                  : `1px solid ${theme.palette.primary.main}33`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}
          >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Date Range"
                value={dateRangeType}
                onChange={(e) => setDateRangeType(e.target.value)}
                size="small"
              >
                {DATE_RANGES.map((range) => (
                  <MenuItem key={range.value} value={range.value}>
                    {range.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {dateRangeType === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Grid item xs={12} md={4}>
                  <ModernDatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={(newValue) => setStartDate(newValue)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <ModernDatePicker
                    label="End Date"
                    value={endDate}
                    onChange={(newValue) => setEndDate(newValue)}
                    fullWidth
                  />
                </Grid>
              </LocalizationProvider>
            )}
          </Grid>
          </Paper>
        </Fade>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in timeout={400}>
            <Card sx={{
              borderRadius: 3,
              background: (theme) => theme.palette.gradient.success,
              color: 'white',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 32px rgba(16, 185, 129, 0.35)',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
              },
            }}>
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                    Total Income
                  </Typography>
                  <TrendingUp sx={{ opacity: 0.7 }} />
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                  {formatCurrency(summaryStats.income)}
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in timeout={500}>
            <Card sx={{
              borderRadius: 3,
              background: (theme) => theme.palette.gradient.error,
              color: 'white',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 32px rgba(239, 68, 68, 0.35)',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
              },
            }}>
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                    Total Expenses
                  </Typography>
                  <TrendingDown sx={{ opacity: 0.7 }} />
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                  {formatCurrency(summaryStats.expenses)}
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in timeout={600}>
            <Card sx={{
              borderRadius: 3,
              background: (theme) => summaryStats.net >= 0
                ? theme.palette.gradient.info
                : theme.palette.gradient.error,
              color: 'white',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: summaryStats.net >= 0
                ? '0 4px 20px rgba(6, 182, 212, 0.25)'
                : '0 4px 20px rgba(249, 115, 22, 0.25)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: summaryStats.net >= 0
                  ? '0 12px 32px rgba(6, 182, 212, 0.35)'
                  : '0 12px 32px rgba(249, 115, 22, 0.35)',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
              },
            }}>
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                    Net Savings
                  </Typography>
                  <AccountBalance sx={{ opacity: 0.7 }} />
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                  {formatCurrency(summaryStats.net)}
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in timeout={700}>
            <Card sx={{
              borderRadius: 3,
              background: (theme) => theme.palette.gradient.primary,
              color: 'white',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: (theme) => `0 4px 20px ${theme.palette.primary.main}40`,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: (theme) => `0 12px 32px ${theme.palette.primary.main}50`,
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
              },
            }}>
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                    Avg Daily Spending
                  </Typography>
                  <CalendarMonth sx={{ opacity: 0.7 }} />
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                  {formatCurrency(summaryStats.avgDailySpending)}
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
      </Grid>

      {/* 1. Income vs Expense Trend */}
      <Fade in timeout={1000}>
        <Paper sx={{
          p: 3,
          borderRadius: 3,
          mb: 3,
          background: (theme) =>
            theme.palette.mode === 'light'
              ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
              : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: (theme) =>
            theme.palette.mode === 'light'
              ? `1px solid ${theme.palette.primary.main}0D`
              : `1px solid ${theme.palette.primary.main}1A`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}>
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <Avatar
              sx={{
                bgcolor: (theme) => `${theme.palette.primary.main}1A`,
                color: 'primary.main',
                width: 40,
                height: 40,
              }}
            >
              <TrendingUp />
            </Avatar>
            <Typography variant="h6" fontWeight={700}>
              Income vs Expenses Over Time
            </Typography>
          </Box>
        {incomeExpenseData.length > 0 ? (
          <ResponsiveChart>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="month" stroke="#666" />
                <YAxis stroke="#666" />
                <RechartsTooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke={COLORS.success}
                  strokeWidth={3}
                  name="Income"
                  dot={{ fill: COLORS.success, r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke={COLORS.error}
                  strokeWidth={3}
                  name="Expenses"
                  dot={{ fill: COLORS.error, r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Net"
                  dot={{ fill: COLORS.primary, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ResponsiveChart>
        ) : (
          <Box textAlign="center" py={6}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        )}
        </Paper>
      </Fade>

      {/* 2 & 3: Category Breakdown and Daily Spending */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Category Breakdown Pie */}
        <Grid item xs={12} md={6}>
          <Fade in timeout={1200}>
            <Paper sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                  : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? `1px solid ${theme.palette.primary.main}0D`
                  : `1px solid ${theme.palette.primary.main}1A`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <Avatar
                  sx={{
                    bgcolor: (theme) => `${theme.palette.primary.main}1A`,
                    color: 'primary.main',
                    width: 40,
                    height: 40,
                  }}
                >
                  <CategoryIcon />
                </Avatar>
                <Typography variant="h6" fontWeight={700}>
                  Spending by Category
                </Typography>
              </Box>
            {categoryBreakdown.length > 0 ? (
              <>
                <ResponsiveChart>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.percentage.toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </ResponsiveChart>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {categoryBreakdown.slice(0, 5).map((cat) => (
                    <Box key={cat.name} display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }}
                      />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {cat.name}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(cat.value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No category data</Typography>
              </Box>
            )}
            </Paper>
          </Fade>
        </Grid>

        {/* Daily Spending Bar Chart */}
        <Grid item xs={12} md={6}>
          <Fade in timeout={1300}>
            <Paper sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                  : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? `1px solid ${theme.palette.primary.main}0D`
                  : `1px solid ${theme.palette.primary.main}1A`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <Avatar
                  sx={{
                    bgcolor: (theme) => `${theme.palette.primary.main}1A`,
                    color: 'primary.main',
                    width: 40,
                    height: 40,
                  }}
                >
                  <Assessment />
                </Avatar>
                <Typography variant="h6" fontWeight={700}>
                  Daily Spending Trend
                </Typography>
              </Box>
            {dailySpendingData.length > 0 ? (
              <ResponsiveChart>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailySpendingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                    <XAxis dataKey="day" stroke="#666" />
                    <YAxis stroke="#666" />
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar dataKey="amount" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ResponsiveChart>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No spending data</Typography>
              </Box>
            )}
            </Paper>
          </Fade>
        </Grid>
      </Grid>

      {/* 4. Budget vs Actual */}
      {budgetComparisonData.length > 0 && (
        <Fade in timeout={1400}>
          <Paper sx={{
            p: 3,
            borderRadius: 3,
            mb: 3,
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            border: (theme) =>
              theme.palette.mode === 'light'
                ? `1px solid ${theme.palette.primary.main}0D`
                : `1px solid ${theme.palette.primary.main}1A`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <Avatar
                sx={{
                  bgcolor: (theme) => `${theme.palette.primary.main}1A`,
                  color: 'primary.main',
                  width: 40,
                  height: 40,
                }}
              >
                <AccountBalanceWallet />
              </Avatar>
              <Typography variant="h6" fontWeight={700}>
                Budget vs Actual Spending
              </Typography>
            </Box>
          <ResponsiveChart>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={budgetComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <RechartsTooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                />
                <Legend />
                <Bar dataKey="budget" fill={COLORS.info} name="Budget" radius={[8, 8, 0, 0]} />
                <Bar dataKey="spent" fill={COLORS.error} name="Spent" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ResponsiveChart>
          </Paper>
        </Fade>
      )}

      {/* 5 & 6: Tables */}
      <Grid container spacing={3}>
        {/* Top Merchants */}
        <Grid item xs={12} md={6}>
          <Fade in timeout={1500}>
            <Paper sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                  : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? `1px solid ${theme.palette.primary.main}0D`
                  : `1px solid ${theme.palette.primary.main}1A`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <Avatar
                  sx={{
                    bgcolor: (theme) => `${theme.palette.primary.main}1A`,
                    color: 'primary.main',
                    width: 40,
                    height: 40,
                  }}
                >
                  <Store />
                </Avatar>
                <Typography variant="h6" fontWeight={700}>
                  Top Merchants
                </Typography>
              </Box>
            {topMerchants.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Merchant</TableCell>
                      <TableCell align="right">Transactions</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topMerchants.map((merchant, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{merchant.name}</TableCell>
                        <TableCell align="right">{merchant.count}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(merchant.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography color="text.secondary">No merchant data</Typography>
              </Box>
            )}
            </Paper>
          </Fade>
        </Grid>

        {/* Month-over-Month */}
        <Grid item xs={12} md={6}>
          <Fade in timeout={1600}>
            <Paper sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                  : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
              backdropFilter: 'blur(20px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? `1px solid ${theme.palette.primary.main}0D`
                  : `1px solid ${theme.palette.primary.main}1A`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <Avatar
                  sx={{
                    bgcolor: (theme) => `${theme.palette.primary.main}1A`,
                    color: 'primary.main',
                    width: 40,
                    height: 40,
                  }}
                >
                  <TrendingUp />
                </Avatar>
                <Typography variant="h6" fontWeight={700}>
                  Month-over-Month Comparison
                </Typography>
              </Box>
            {monthOverMonthData.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell align="right">Income</TableCell>
                      <TableCell align="right">Expenses</TableCell>
                      <TableCell align="right">Change</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthOverMonthData.slice(0, 6).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.month}</TableCell>
                        <TableCell align="right">{formatCurrency(row.income)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.expenses)}</TableCell>
                        <TableCell align="right">
                          <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                            {row.expensesChange > 0 ? (
                              <TrendingUp fontSize="small" color="error" />
                            ) : row.expensesChange < 0 ? (
                              <TrendingDown fontSize="small" color="success" />
                            ) : null}
                            <Typography
                              variant="body2"
                              color={
                                row.expensesChange > 0
                                  ? 'error'
                                  : row.expensesChange < 0
                                  ? 'success.main'
                                  : 'text.secondary'
                              }
                            >
                              {row.expensesChange.toFixed(1)}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography color="text.secondary">No monthly data</Typography>
              </Box>
            )}
            </Paper>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;
