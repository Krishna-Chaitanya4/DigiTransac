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
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  List,
  ListItemButton,
  LinearProgress,
  Button,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  RestartAlt as RestartAltIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
  Pending as PendingIcon,
  Folder as FolderIcon,
  Category as CategoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
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
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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

interface SmartInsights {
  overallTrend: {
    currentTotal: number;
    previousTotal: number;
    percentChange: number;
    direction: 'up' | 'down';
  };
  overBudgetAlerts: Array<{
    categoryName: string;
    budgetAmount: number;
    spent: number;
    overBy: number;
    percentOver: number;
  }>;
  unusualExpenses: Array<{
    description: string;
    amount: number;
    date: string;
    timesAverage: number;
  }>;
  categoryTrends: Array<{
    categoryName: string;
    currentAmount: number;
    previousAmount: number;
    percentChange: number;
    trend: 'increasing' | 'decreasing';
  }>;
  folderTrends: Array<{
    folderName: string;
    categoryId: string;
    categoryColor: string;
    currentAmount: number;
    previousAmount: number;
    percentChange: number;
    trend: 'increasing' | 'decreasing';
  }>;
  summary: {
    totalExpenses: number;
    avgDailySpending: number;
    topSpendingDay: {
      date: string;
      amount: number;
    };
  };
}

interface ReviewQueueStats {
  pending: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  pendingExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
    daysSinceParsed: number;
  }>;
}

const Analytics: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [folderBreakdown, setFolderBreakdown] = useState<CategoryBreakdown[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'amount' | 'name' | 'count'>('amount');
  const [viewMode, setViewMode] = useState<'category' | 'folder'>('category');
  const [trends, setTrends] = useState<Trend[]>([]);
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparison[]>([]);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<PaymentMethodBreakdown[]>([]);
  const [topMerchants, setTopMerchants] = useState<MerchantData[]>([]);
  const [smartInsights, setSmartInsights] = useState<SmartInsights | null>(null);
  const [reviewQueueStats, setReviewQueueStats] = useState<ReviewQueueStats | null>(null);

  // Load saved preferences from localStorage or use defaults
  const [startDate, setStartDate] = useState<Dayjs | null>(() => {
    const saved = localStorage.getItem('analytics_startDate');
    return saved ? dayjs(saved) : dayjs().startOf('month');
  });
  
  const [endDate, setEndDate] = useState<Dayjs | null>(() => {
    const saved = localStorage.getItem('analytics_endDate');
    return saved ? dayjs(saved) : dayjs();
  });

  const [trendGroupBy, setTrendGroupBy] = useState<'day' | 'week' | 'month'>(() => {
    const saved = localStorage.getItem('analytics_trendGroupBy');
    return (saved as 'day' | 'week' | 'month') || 'day';
  });

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (startDate) {
      localStorage.setItem('analytics_startDate', startDate.format('YYYY-MM-DD'));
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      localStorage.setItem('analytics_endDate', endDate.format('YYYY-MM-DD'));
    }
  }, [endDate]);

  useEffect(() => {
    localStorage.setItem('analytics_trendGroupBy', trendGroupBy);
  }, [trendGroupBy]);

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate, trendGroupBy]);

  const fetchAnalytics = async () => {
    if (!startDate || !endDate) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
      });

      const [overviewRes, breakdownRes, folderBreakdownRes, trendsRes, comparisonRes, topExpensesRes, paymentMethodRes, merchantsRes, insightsRes, reviewStatsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/overview?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/category-breakdown?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/folder-breakdown?${params}`, {
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
        axios.get(`${API_URL}/api/analytics/smart-insights?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/analytics/review-queue-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const breakdown = breakdownRes.data.breakdown || [];
      const folders = folderBreakdownRes.data.breakdown || [];
      const allCategories = categoriesRes.data.categories || [];

      setOverview(overviewRes.data.overview);
      setCategoryBreakdown(breakdown);
      setFolderBreakdown(folders);
      setCategories(allCategories);
      setTrends(trendsRes.data.trends || []);
      setBudgetComparison(comparisonRes.data.comparisons || []);
      setTopExpenses(topExpensesRes.data.expenses || []);
      setPaymentMethodBreakdown(paymentMethodRes.data.breakdown || []);
      setTopMerchants(merchantsRes.data.merchants || []);
      setSmartInsights(insightsRes.data.insights || null);
      setReviewQueueStats(reviewStatsRes.data.stats || null);

      // Auto-expand top 3 spending folders
      const top3Folders = folders
        .slice(0, 3)
        .map((f: any) => f.categoryId);
      setExpandedFolders(new Set(top3Folders));

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

  const handleResetFilters = () => {
    setStartDate(dayjs().startOf('month'));
    setEndDate(dayjs());
    setTrendGroupBy('day');
    localStorage.removeItem('analytics_startDate');
    localStorage.removeItem('analytics_endDate');
    localStorage.removeItem('analytics_trendGroupBy');
  };

  // Tree view helper functions
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allFolderIds = categories
      .filter((cat) => cat.isFolder)
      .map((cat) => cat.id);
    setExpandedFolders(new Set(allFolderIds));
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const handleCategoryClick = (categoryId: string) => {
    navigate('/expenses', { state: { filterCategoryId: categoryId } });
  };

  // Build hierarchical tree structure with spending data
  const buildTreeData = () => {
    const totalSpent = categoryBreakdown.reduce((sum, item) => sum + item.amount, 0);
    
    // Create a map of category spending
    const spendingMap = new Map(
      categoryBreakdown.map((item) => [item.categoryId, item])
    );

    // Helper to calculate total spending for a category/folder (including children)
    const calculateTotalSpending = (categoryId: string): { amount: number; count: number } => {
      const directSpending = spendingMap.get(categoryId);
      const children = categories.filter((cat) => cat.parentId === categoryId);
      
      let totalAmount = directSpending?.amount || 0;
      let totalCount = directSpending?.count || 0;

      children.forEach((child) => {
        const childTotal = calculateTotalSpending(child.id);
        totalAmount += childTotal.amount;
        totalCount += childTotal.count;
      });

      return { amount: totalAmount, count: totalCount };
    };

    // Build tree nodes
    const buildNode = (category: any, level: number = 0): any => {
      const spending = calculateTotalSpending(category.id);
      const children = categories
        .filter((cat) => cat.parentId === category.id)
        .map((child) => buildNode(child, level + 1));

      // Sort children based on sortBy
      if (sortBy === 'amount') {
        children.sort((a, b) => b.spending.amount - a.spending.amount);
      } else if (sortBy === 'name') {
        children.sort((a, b) => a.category.name.localeCompare(b.category.name));
      } else if (sortBy === 'count') {
        children.sort((a, b) => b.spending.count - a.spending.count);
      }

      return {
        category,
        spending,
        percentage: totalSpent > 0 ? (spending.amount / totalSpent) * 100 : 0,
        children,
        level,
      };
    };

    // Get root categories (no parent)
    const roots = categories
      .filter((cat) => !cat.parentId)
      .map((cat) => buildNode(cat));

    // Sort roots
    if (sortBy === 'amount') {
      roots.sort((a, b) => b.spending.amount - a.spending.amount);
    } else if (sortBy === 'name') {
      roots.sort((a, b) => a.category.name.localeCompare(b.category.name));
    } else if (sortBy === 'count') {
      roots.sort((a, b) => b.spending.count - a.spending.count);
    }

    return roots;
  };

  const treeData = buildTreeData();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={700}>
            Analytics
          </Typography>
          <Box display="flex" gap={2}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                },
              }}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                },
              }}
            />
            <Tooltip title="Reset to default (current month)">
              <IconButton 
                onClick={handleResetFilters}
                color="primary"
                sx={{ 
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <RestartAltIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Smart Insights Section */}
        {smartInsights && (
          <Grid container spacing={2} mb={3}>
            {/* Overall Trend Alert */}
            {smartInsights.overallTrend && (
              <Grid item xs={12}>
                <Alert 
                  severity={smartInsights.overallTrend.direction === 'up' ? 'warning' : 'success'}
                  icon={smartInsights.overallTrend.direction === 'up' ? <TrendingUpIcon /> : <TrendingDownIcon />}
                  sx={{ borderRadius: 2 }}
                >
                  <Typography variant="body2">
                    <strong>Spending Trend:</strong> Your spending is{' '}
                    <strong>{Math.abs(smartInsights.overallTrend.percentChange)}%{' '}
                    {smartInsights.overallTrend.direction === 'up' ? 'higher' : 'lower'}</strong>{' '}
                    compared to the previous period 
                    ({formatCurrency(smartInsights.overallTrend.previousTotal)} → {formatCurrency(smartInsights.overallTrend.currentTotal)})
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Over Budget Alerts */}
            {smartInsights.overBudgetAlerts && smartInsights.overBudgetAlerts.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ borderLeft: '4px solid', borderColor: 'error.main' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <WarningIcon color="error" />
                      <Typography variant="h6" fontWeight={600}>
                        Over Budget ({smartInsights.overBudgetAlerts.length})
                      </Typography>
                    </Box>
                    {smartInsights.overBudgetAlerts.map((alert, idx) => (
                      <Box key={idx} mb={idx < smartInsights.overBudgetAlerts.length - 1 ? 2 : 0}>
                        <Typography variant="body2" fontWeight={500}>
                          {alert.categoryName}
                        </Typography>
                        <Typography variant="caption" color="error.main">
                          {formatCurrency(alert.spent)} / {formatCurrency(alert.budgetAmount)} 
                          ({alert.percentOver}% over)
                        </Typography>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Review Queue Stats */}
            {reviewQueueStats && reviewQueueStats.pending > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <PendingIcon color="warning" />
                      <Typography variant="h6" fontWeight={600}>
                        Pending Reviews ({reviewQueueStats.pending})
                      </Typography>
                    </Box>
                    <Typography variant="body2" mb={1}>
                      Approval Rate: <strong>{reviewQueueStats.approvalRate}%</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {reviewQueueStats.pendingExpenses.length} expenses waiting for review
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Category Trends */}
            {smartInsights.categoryTrends && smartInsights.categoryTrends.length > 0 && (
              <Grid item xs={12}>
                <Card sx={{ borderLeft: '4px solid', borderColor: 'info.main' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <LightbulbIcon color="info" />
                      <Typography variant="h6" fontWeight={600}>
                        Category Insights
                      </Typography>
                    </Box>
                    <Grid container spacing={2}>
                      {smartInsights.categoryTrends.map((trend, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={idx}>
                          <Box 
                            p={1.5} 
                            borderRadius={1} 
                            bgcolor={trend.trend === 'increasing' ? 'error.lighter' : 'success.lighter'}
                            sx={{ bgcolor: trend.trend === 'increasing' ? 'rgba(211, 47, 47, 0.08)' : 'rgba(46, 125, 50, 0.08)' }}
                          >
                            <Typography variant="body2" fontWeight={500}>
                              {trend.categoryName}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                              {trend.trend === 'increasing' ? (
                                <TrendingUpIcon fontSize="small" color="error" />
                              ) : (
                                <TrendingDownIcon fontSize="small" color="success" />
                              )}
                              <Typography 
                                variant="caption" 
                                color={trend.trend === 'increasing' ? 'error.main' : 'success.main'}
                                fontWeight={600}
                              >
                                {Math.abs(trend.percentChange)}% {trend.trend}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Folder Trends */}
            {smartInsights.folderTrends && smartInsights.folderTrends.length > 0 && (
              <Grid item xs={12}>
                <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <FolderIcon color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Folder Spending Trends
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" mb={2} display="block">
                      High-level spending patterns across your folder structure
                    </Typography>
                    <Grid container spacing={2}>
                      {smartInsights.folderTrends.map((trend, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={idx}>
                          <Box 
                            p={2} 
                            borderRadius={2} 
                            sx={{ 
                              bgcolor: trend.trend === 'increasing' ? 'rgba(211, 47, 47, 0.08)' : 'rgba(46, 125, 50, 0.08)',
                              border: '1px solid',
                              borderColor: trend.trend === 'increasing' ? 'rgba(211, 47, 47, 0.2)' : 'rgba(46, 125, 50, 0.2)',
                            }}
                          >
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <Box
                                width={16}
                                height={16}
                                borderRadius="50%"
                                bgcolor={trend.categoryColor}
                                flexShrink={0}
                              />
                              <Typography variant="body2" fontWeight={600}>
                                {trend.folderName} 📁
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                              <Box display="flex" alignItems="center" gap={0.5}>
                                {trend.trend === 'increasing' ? (
                                  <TrendingUpIcon fontSize="small" color="error" />
                                ) : (
                                  <TrendingDownIcon fontSize="small" color="success" />
                                )}
                                <Typography 
                                  variant="body2"
                                  color={trend.trend === 'increasing' ? 'error.main' : 'success.main'}
                                  fontWeight={700}
                                >
                                  {Math.abs(trend.percentChange)}%
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {formatCurrency(trend.currentAmount)}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                              Previous: {formatCurrency(trend.previousAmount)}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Unusual Expenses */}
            {smartInsights.unusualExpenses && smartInsights.unusualExpenses.length > 0 && (
              <Grid item xs={12}>
                <Card sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <WarningIcon color="warning" />
                      <Typography variant="h6" fontWeight={600}>
                        Unusual Expenses
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" mb={2} display="block">
                      These expenses are significantly higher than your average
                    </Typography>
                    {smartInsights.unusualExpenses.map((expense, idx) => (
                      <Box 
                        key={idx} 
                        display="flex" 
                        justifyContent="space-between"
                        py={1}
                        borderBottom={idx < smartInsights.unusualExpenses.length - 1 ? '1px solid' : 'none'}
                        borderColor="divider"
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {expense.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(expense.date).toLocaleDateString()} • {expense.timesAverage}x average
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="warning.main">
                          {formatCurrency(expense.amount)}
                        </Typography>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Spending by {viewMode === 'folder' ? 'Folder' : 'Category'}
                </Typography>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, newMode) => {
                    if (newMode !== null) {
                      setViewMode(newMode);
                    }
                  }}
                  size="small"
                  sx={{ height: 32 }}
                >
                  <ToggleButton value="category">
                    <Tooltip title="View by individual categories">
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <CategoryIcon fontSize="small" />
                        <Typography variant="caption">Categories</Typography>
                      </Box>
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="folder">
                    <Tooltip title="View grouped by folders">
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <FolderIcon fontSize="small" />
                        <Typography variant="caption">Folders</Typography>
                      </Box>
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {(viewMode === 'category' ? categoryBreakdown : folderBreakdown).length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={viewMode === 'category' ? categoryBreakdown : folderBreakdown}
                        dataKey="amount"
                        nameKey="categoryName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.percentage}%`}
                      >
                        {(viewMode === 'category' ? categoryBreakdown : folderBreakdown).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.categoryColor} />
                        ))}
                    </Pie>
                      <RechartsTooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          padding: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box mt={2}>
                    {(viewMode === 'category' ? categoryBreakdown : folderBreakdown).map((cat, index) => (
                      <Box
                        key={cat.categoryId}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        py={1}
                        borderBottom={index < (viewMode === 'category' ? categoryBreakdown : folderBreakdown).length - 1 ? '1px solid' : 'none'}
                        borderColor="divider"
                      >
                        <Box display="flex" alignItems="center" gap={1} minWidth={0} flex={1}>
                          <Box
                            width={12}
                            height={12}
                            borderRadius="50%"
                            bgcolor={cat.categoryColor}
                            flexShrink={0}
                          />
                          <Typography 
                            variant="body2"
                            sx={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}
                          >
                            {viewMode === 'folder' ? cat.categoryName : cat.path.join(' > ')} {cat.isFolder && '📁'}
                          </Typography>
                        </Box>
                        <Box textAlign="right" flexShrink={0}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {formatCurrency(cat.amount)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
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
                    <RechartsTooltip
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
                      <RechartsTooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        content={({ active, payload }: any) => {
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
                        <Box minWidth={0} flex={1}>
                          <Typography 
                            variant="body2" 
                            fontWeight={500}
                            sx={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}
                          >
                            {budget.categoryName} {budget.isFolder && '📁'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {budget.percentUsed}% used
                          </Typography>
                        </Box>
                        <Box textAlign="right" flexShrink={0}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color={budget.isOverBudget ? 'error.main' : 'success.main'}
                            noWrap
                          >
                            {formatCurrency(budget.actualSpent)} / {formatCurrency(budget.budgetAmount)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
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
                      <Box display="flex" alignItems="center" gap={2} minWidth={0} flex={1}>
                        <Typography variant="h6" color="text.secondary" fontWeight={600} flexShrink={0}>
                          #{index + 1}
                        </Typography>
                        <Box minWidth={0} flex={1}>
                          <Typography 
                            variant="body1" 
                            fontWeight={500}
                            sx={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}
                          >
                            {expense.description}
                          </Typography>
                          <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                            <Chip
                              label={expense.categoryName}
                              size="small"
                              sx={{
                                bgcolor: expense.categoryColor + '20',
                                color: expense.categoryColor,
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {formatDate(expense.date)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Typography variant="h6" fontWeight={700} color="error.main" flexShrink={0} noWrap>
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
                        label={({ percentage }) => `${percentage}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="amount"
                        nameKey="paymentMethodName"
                      >
                        {paymentMethodBreakdown.map((_entry, index) => {
                          const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#30cfd0', '#a8edea'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: any) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          padding: '8px',
                        }}
                      />
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
                          <Box display="flex" alignItems="center" gap={1} minWidth={0} flex={1}>
                            <Box
                              width={12}
                              height={12}
                              borderRadius="50%"
                              bgcolor={colors[index % colors.length]}
                              flexShrink={0}
                            />
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap' 
                              }}
                            >
                              {pm.paymentMethodName}
                            </Typography>
                          </Box>
                          <Box textAlign="right" flexShrink={0}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {formatCurrency(pm.amount)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
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
                      <Box display="flex" alignItems="center" gap={2} minWidth={0} flex={1}>
                        <Typography variant="h6" color="text.secondary" fontWeight={600} flexShrink={0}>
                          #{index + 1}
                        </Typography>
                        <Box minWidth={0} flex={1}>
                          <Typography 
                            variant="body1" 
                            fontWeight={500}
                            sx={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}
                          >
                            {merchant.merchantName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {merchant.count} transactions · {merchant.percentage}% of total
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="h6" fontWeight={700} color="primary.main" flexShrink={0} noWrap>
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

        {/* Folder Structure Tree View */}
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Folder Structure Analysis
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Hierarchical view of your spending by categories and folders
                  </Typography>
                </Box>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <TextField
                    select
                    size="small"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'amount' | 'name' | 'count')}
                    sx={{ minWidth: 140 }}
                    label="Sort by"
                  >
                    <MenuItem value="amount">Amount</MenuItem>
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="count">Expense Count</MenuItem>
                  </TextField>
                  <Button
                    size="small"
                    startIcon={<UnfoldMoreIcon />}
                    onClick={expandAll}
                    variant="outlined"
                  >
                    Expand All
                  </Button>
                  <Button
                    size="small"
                    startIcon={<UnfoldLessIcon />}
                    onClick={collapseAll}
                    variant="outlined"
                  >
                    Collapse All
                  </Button>
                </Box>
              </Box>

              {treeData.length > 0 ? (
                <List disablePadding>
                  {treeData.map((node) => renderTreeNode(node))}
                </List>
              ) : (
                <Box textAlign="center" py={6}>
                  <Typography color="text.secondary">
                    No spending data available for this period
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </Box>
    </LocalizationProvider>
  );

  // Render tree node recursively
  function renderTreeNode(node: any): React.ReactNode {
    const { category, spending, percentage, children, level } = node;
    const isFolder = category.isFolder;
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(category.id);
    const hasSpending = spending.amount > 0;

    if (!hasSpending && !hasChildren) {
      return null; // Don't show empty categories
    }

    return (
      <Box key={category.id}>
        <ListItemButton
          onClick={() => {
            if (hasChildren && isFolder) {
              toggleFolder(category.id);
            } else {
              handleCategoryClick(category.id);
            }
          }}
          sx={{
            pl: 2 + level * 3,
            py: 1.5,
            borderRadius: 1,
            mb: 0.5,
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Box display="flex" alignItems="center" gap={1} flex={1} minWidth={0}>
            {/* Expand/Collapse Icon */}
            {hasChildren && isFolder ? (
              <IconButton size="small" sx={{ p: 0 }}>
                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            ) : (
              <Box width={24} /> // Spacer
            )}

            {/* Category/Folder Icon and Color */}
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                width={16}
                height={16}
                borderRadius="50%"
                bgcolor={category.color}
                flexShrink={0}
              />
              <Typography variant="body2" fontWeight={isFolder ? 600 : 500}>
                {isFolder ? '📁' : '🏷️'} {category.name}
              </Typography>
            </Box>

            {/* Expense Count */}
            {spending.count > 0 && (
              <Chip
                label={`${spending.count} expense${spending.count > 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          {/* Amount and Progress */}
          <Box display="flex" alignItems="center" gap={2} flexShrink={0}>
            <Box width={120} display={{ xs: 'none', sm: 'block' }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(percentage, 100)}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    backgroundColor: category.color,
                  },
                }}
              />
            </Box>
            <Box textAlign="right" minWidth={100}>
              <Typography variant="body2" fontWeight={700}>
                {formatCurrency(spending.amount)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {percentage.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </ListItemButton>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            {children.map((child: any) => renderTreeNode(child))}
          </Collapse>
        )}
      </Box>
    );
  }
};

export default Analytics;
