import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  CircularProgress,
  Alert,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Overview {
  totalSpent: number;
  totalBudget: number;
  expenseCount: number;
  avgExpense: number;
  budgetUsedPercent: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
  count: number;
  percentage: number;
}

interface Trend {
  date: string;
  amount: number;
}

interface BudgetComparison {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budgetAmount: number;
  actualSpent: number;
  difference: number;
  percentUsed: number;
  isOverBudget: boolean;
}

interface TopExpense {
  id: string;
  description: string;
  amount: number;
  date: string;
  categoryName: string;
  categoryColor: string;
}

const Analytics: React.FC = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparison[]>([]);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [trendGroupBy, setTrendGroupBy] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, trendGroupBy]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const [overviewRes, breakdownRes, trendsRes, comparisonRes, topExpensesRes] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/overview?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/category-breakdown?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/trends?${params}&groupBy=${trendGroupBy}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/budget-comparison?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/top-expenses?${params}&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setOverview(overviewRes.data.overview);
      setCategoryBreakdown(breakdownRes.data.breakdown || []);
      setTrends(trendsRes.data.trends || []);
      setBudgetComparison(comparisonRes.data.comparisons || []);
      setTopExpenses(topExpensesRes.data.expenses || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch analytics');
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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>
          Analytics
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            label="Start Date"
            type="date"
            size="small"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End Date"
            type="date"
            size="small"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Overview Stats */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Spent
                  </Typography>
                  <Typography variant="h4" fontWeight={700} mt={1}>
                    {formatCurrency(overview?.totalSpent || 0)}
                  </Typography>
                </Box>
                <TrendingUpIcon />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Budget
                  </Typography>
                  <Typography variant="h4" fontWeight={700} mt={1}>
                    {formatCurrency(overview?.totalBudget || 0)}
                  </Typography>
                </Box>
                <AccountBalanceIcon />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Expenses
                  </Typography>
                  <Typography variant="h4" fontWeight={700} mt={1}>
                    {overview?.expenseCount || 0}
                  </Typography>
                </Box>
                <ReceiptIcon />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Avg Expense
                  </Typography>
                  <Typography variant="h4" fontWeight={700} mt={1}>
                    {formatCurrency(overview?.avgExpense || 0)}
                  </Typography>
                </Box>
                <TrendingDownIcon />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Category Breakdown Pie Chart */}
        <Grid item xs={12} md={6}>
          <Card sx={{
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(255, 255, 255, 0.9)'
                : 'rgba(30, 30, 30, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                Spending by Category
              </Typography>
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="amount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.categoryName} (${entry.percentage}%)`}
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.categoryColor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box textAlign="center" py={6}>
                  <Typography color="text.secondary">
                    No data available for this period
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Spending Trends Line Chart */}
        <Grid item xs={12} md={6}>
          <Card sx={{
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(255, 255, 255, 0.9)'
                : 'rgba(30, 30, 30, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Spending Trends
                </Typography>
                <TextField
                  select
                  size="small"
                  value={trendGroupBy}
                  onChange={(e) => setTrendGroupBy(e.target.value as 'day' | 'week' | 'month')}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="day">Daily</MenuItem>
                  <MenuItem value="week">Weekly</MenuItem>
                  <MenuItem value="month">Monthly</MenuItem>
                </TextField>
              </Box>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={formatDate}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#667eea"
                      strokeWidth={2}
                      dot={{ fill: '#667eea' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box textAlign="center" py={6}>
                  <Typography color="text.secondary">
                    No data available for this period
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Budget vs Actual Bar Chart */}
        <Grid item xs={12}>
          <Card sx={{
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(255, 255, 255, 0.9)'
                : 'rgba(30, 30, 30, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                Budget vs Actual Spending
              </Typography>
              {budgetComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={budgetComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoryName" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="budgetAmount" fill="#667eea" name="Budget" />
                    <Bar dataKey="actualSpent" fill="#f5576c" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box textAlign="center" py={6}>
                  <Typography color="text.secondary">
                    No budgets set for this period
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Expenses */}
        <Grid item xs={12}>
          <Card sx={{
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(255, 255, 255, 0.9)'
                : 'rgba(30, 30, 30, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                Top Expenses
              </Typography>
              {topExpenses.length > 0 ? (
                <Box>
                  {topExpenses.map((expense, index) => (
                    <Box
                      key={expense.id}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      py={1.5}
                      borderBottom={index < topExpenses.length - 1 ? '1px solid' : 'none'}
                      borderColor="divider"
                    >
                      <Box display="flex" alignItems="center" gap={2}>
                        <Typography variant="h6" color="text.secondary" fontWeight={600}>
                          #{index + 1}
                        </Typography>
                        <Box>
                          <Typography variant="body1" fontWeight={500}>
                            {expense.description}
                          </Typography>
                          <Box display="flex" gap={1} mt={0.5}>
                            <Chip
                              label={expense.categoryName}
                              size="small"
                              sx={{
                                bgcolor: expense.categoryColor + '20',
                                color: expense.categoryColor,
                              }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(expense.date)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Typography variant="h6" fontWeight={700} color="error.main">
                        {formatCurrency(expense.amount)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box textAlign="center" py={6}>
                  <Typography color="text.secondary">
                    No expenses for this period
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;
