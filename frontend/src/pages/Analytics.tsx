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
} from '@mui/material';
import {
  DatePicker,
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

// Chart colors
const COLORS = {
  primary: '#14b8a6',
  success: '#10b981',
  error: '#f43f5e',
  warning: '#f97316',
  info: '#06b6d4',
  categoryColors: [
    '#14b8a6', '#06b6d4', '#0891b2', '#22d3ee',
    '#10b981', '#34d399', '#f59e0b', '#fbbf24',
    '#8b5cf6', '#a78bfa', '#ec4899', '#f472b6',
  ],
};

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
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography 
              variant="h4" 
              fontWeight={800} 
              gutterBottom
              sx={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Financial Insights
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {getCurrentMonthYear()} • Net Savings: {formatCurrency(summaryStats.net)}
            </Typography>
          </Box>
          <Tooltip title="Export to CSV">
            <IconButton 
              onClick={exportData} 
              size="large"
              sx={{
                color: '#14b8a6',
                '&:hover': {
                  background: 'rgba(20, 184, 166, 0.1)',
                },
              }}
            >
              <Download />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Date Range Filter */}
        <Paper sx={{ p: 3, borderRadius: 3 }}>
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
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={(newValue) => setStartDate(newValue)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={(newValue) => setEndDate(newValue)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
              </LocalizationProvider>
            )}
          </Grid>
        </Paper>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3,
            background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            },
          }}>
            <CardContent>
              <Typography variant="body2" color="rgba(255,255,255,0.9)" gutterBottom>
                Total Income
              </Typography>
              <Typography variant="h5" fontWeight={700} color="white">
                {formatCurrency(summaryStats.income)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3,
            background: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 24px rgba(244, 63, 94, 0.4)',
            },
          }}>
            <CardContent>
              <Typography variant="body2" color="rgba(255,255,255,0.9)" gutterBottom>
                Total Expenses
              </Typography>
              <Typography variant="h5" fontWeight={700} color="white">
                {formatCurrency(summaryStats.expenses)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3,
            background: summaryStats.net >= 0 
              ? 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)'
              : 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: summaryStats.net >= 0
                ? '0 8px 24px rgba(6, 182, 212, 0.4)'
                : '0 8px 24px rgba(249, 115, 22, 0.4)',
            },
          }}>
            <CardContent>
              <Typography variant="body2" color="rgba(255,255,255,0.9)" gutterBottom>
                Net Savings
              </Typography>
              <Typography variant="h5" fontWeight={700} color="white">
                {formatCurrency(summaryStats.net)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3,
            background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 24px rgba(20, 184, 166, 0.4)',
            },
          }}>
            <CardContent>
              <Typography variant="body2" color="rgba(255,255,255,0.9)" gutterBottom>
                Avg Daily Spending
              </Typography>
              <Typography variant="h5" fontWeight={700} color="white">
                {formatCurrency(summaryStats.avgDailySpending)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 1. Income vs Expense Trend */}
      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={3}>
          <TrendingUp color="primary" />
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

      {/* 2 & 3: Category Breakdown and Daily Spending */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Category Breakdown Pie */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <CategoryIcon color="primary" />
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
        </Grid>

        {/* Daily Spending Bar Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <Assessment color="primary" />
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
        </Grid>
      </Grid>

      {/* 4. Budget vs Actual */}
      {budgetComparisonData.length > 0 && (
        <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <AccountBalanceWallet color="primary" />
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
      )}

      {/* 5 & 6: Tables */}
      <Grid container spacing={3}>
        {/* Top Merchants */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <Store color="primary" />
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
        </Grid>

        {/* Month-over-Month */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <TrendingUp color="primary" />
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
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;
