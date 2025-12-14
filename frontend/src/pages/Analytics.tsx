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
  isFolder: boolean;
  parentId: string | null;
  path: string[];
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
  isFolder: boolean;
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

interface PaymentMethodBreakdown {
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodType: string;
  amount: number;
  count: number;
  percentage: number;
}

interface MerchantData {
  merchantName: string;
  amount: number;
  count: number;
  percentage: number;
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
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<PaymentMethodBreakdown[]>([]);
  const [topMerchants, setTopMerchants] = useState<MerchantData[]>([]);

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

      const [overviewRes, breakdownRes, trendsRes, comparisonRes, topExpensesRes, paymentMethodRes, merchantsRes] = await Promise.all([
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
        axios.get(`${API_URL}/api/analytics/payment-method-breakdown?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/top-merchants?${params}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setOverview(overviewRes.data.overview);
      setCategoryBreakdown(breakdownRes.data.breakdown || []);
      setTrends(trendsRes.data.trends || []);
      setBudgetComparison(comparisonRes.data.comparisons || []);
      setTopExpenses(topExpensesRes.data.expenses || []);
      setPaymentMethodBreakdown(paymentMethodRes.data.breakdown || []);
      setTopMerchants(merchantsRes.data.merchants || []);
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
                <>
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
                  <Box mt={2}>
                    {categoryBreakdown.map((cat, index) => (
                      <Box
                        key={cat.categoryId}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        py={1}
                        borderBottom={index < categoryBreakdown.length - 1 ? '1px solid' : 'none'}
                        borderColor="divider"
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box
                            width={12}
                            height={12}
                            borderRadius="50%"
                            bgcolor={cat.categoryColor}
                          />
                          <Typography variant="body2">
                            {cat.path && cat.path.length > 0 ? cat.path.join(' > ') : cat.categoryName} {cat.isFolder && '📁'}
                          </Typography>
                        </Box>
                        <Box textAlign="right">
                          <Typography variant="body2" fontWeight={600}>
                            {formatCurrency(cat.amount)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cat.count} expenses · {cat.percentage}%
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </>
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
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={budgetComparison}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="categoryName" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <Box
                                sx={{
                                  bgcolor: 'background.paper',
                                  p: 1.5,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                }}
                              >
                                <Typography variant="body2" fontWeight={600}>
                                  {data.categoryName} {data.isFolder && '📁'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Budget: {formatCurrency(data.budgetAmount)}
                                </Typography>
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                  Spent: {formatCurrency(data.actualSpent)} ({data.percentUsed}%)
                                </Typography>
                              </Box>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Bar dataKey="budgetAmount" fill="#667eea" name="Budget" />
                      <Bar dataKey="actualSpent" fill="#f5576c" name="Actual" />
                    </BarChart>
                  </ResponsiveContainer>
                  <Box mt={2}>
                    {budgetComparison.map((budget, index) => (
                      <Box
                        key={budget.categoryId}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        py={1}
                        borderBottom={index < budgetComparison.length - 1 ? '1px solid' : 'none'}
                        borderColor="divider"
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {budget.categoryName} {budget.isFolder && '📁'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {budget.percentUsed}% used
                          </Typography>
                        </Box>
                        <Box textAlign="right">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color={budget.isOverBudget ? 'error.main' : 'success.main'}
                          >
                            {formatCurrency(budget.actualSpent)} / {formatCurrency(budget.budgetAmount)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {budget.isOverBudget ? 'Over by ' : 'Remaining '}{formatCurrency(Math.abs(budget.difference))}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </>
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

        {/* Payment Method Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={3}>
                Payment Method Breakdown
              </Typography>
              {paymentMethodBreakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentMethodBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ paymentMethodName, percentage }) => `${paymentMethodName}: ${percentage}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="amount"
                      >
                        {paymentMethodBreakdown.map((_entry, index) => {
                          const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#30cfd0', '#a8edea'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box mt={2}>
                    {paymentMethodBreakdown.map((pm, index) => {
                      const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#30cfd0', '#a8edea'];
                      return (
                        <Box
                          key={pm.paymentMethodId}
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          py={1}
                          borderBottom={index < paymentMethodBreakdown.length - 1 ? '1px solid' : 'none'}
                          borderColor="divider"
                        >
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box
                              width={12}
                              height={12}
                              borderRadius="50%"
                              bgcolor={colors[index % colors.length]}
                            />
                            <Typography variant="body2">{pm.paymentMethodName}</Typography>
                          </Box>
                          <Box textAlign="right">
                            <Typography variant="body2" fontWeight={600}>
                              {formatCurrency(pm.amount)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {pm.count} transactions
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </>
              ) : (
                <Box textAlign="center" py={6}>
                  <Typography color="text.secondary">
                    No payment method data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Merchants */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={3}>
                Top Merchants
              </Typography>
              {topMerchants.length > 0 ? (
                <Box>
                  {topMerchants.map((merchant, index) => (
                    <Box
                      key={merchant.merchantName}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      py={1.5}
                      borderBottom={index < topMerchants.length - 1 ? '1px solid' : 'none'}
                      borderColor="divider"
                    >
                      <Box display="flex" alignItems="center" gap={2}>
                        <Typography variant="h6" color="text.secondary" fontWeight={600}>
                          #{index + 1}
                        </Typography>
                        <Box>
                          <Typography variant="body1" fontWeight={500}>
                            {merchant.merchantName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {merchant.count} transactions · {merchant.percentage}% of total
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="h6" fontWeight={700} color="primary.main">
                        {formatCurrency(merchant.amount)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box textAlign="center" py={6}>
                  <Typography color="text.secondary">
                    No merchant data available
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
