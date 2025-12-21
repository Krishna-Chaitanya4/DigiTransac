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
  Tabs,
  Tab,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
  Folder as FolderIcon,
  Category as CategoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
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
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { FilterBar, FilterValues } from '../components/FilterBar';

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
  comparison?: {
    previousSpent: number;
    changeAmount: number;
    changePercent: number;
    trend: 'up' | 'down' | 'stable';
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

interface AccountBreakdown {
  accountId: string;
  accountName: string;
  accountType: string;
  credits: number;
  debits: number;
  netFlow: number;
  balance: number;
  transactionCount: number;
}

interface RecurringInsights {
  totalRecurringTemplates: number;
  monthlyRecurringCost: number;
  upcomingThisMonth: number;
  recurringVsOneTime: {
    recurringAmount: number;
    oneTimeAmount: number;
    recurringPercentage: number;
  };
  byFrequency: Array<{
    frequency: string;
    count: number;
    totalAmount: number;
  }>;
}

interface TagBreakdown {
  tag: string;
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

const Analytics: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTab, setCurrentTab] = useState(0);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [folderBreakdown, setFolderBreakdown] = useState<CategoryBreakdown[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'amount' | 'name' | 'count'>('amount');
  const [viewMode, setViewMode] = useState<'category' | 'folder'>('category');
  const [trends, setTrends] = useState<Trend[]>([]);
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparison[]>([]);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);
  const [accountBreakdown, setAccountBreakdown] = useState<AccountBreakdown[]>([]);
  const [recurringInsights, setRecurringInsights] = useState<RecurringInsights | null>(null);
  const [tagBreakdown, setTagBreakdown] = useState<TagBreakdown[]>([]);
  const [topMerchants, setTopMerchants] = useState<MerchantData[]>([]);
  const [smartInsights, setSmartInsights] = useState<SmartInsights | null>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterValues>({
    dateRange: {
      start: dayjs().startOf('month'),
      end: dayjs(),
      preset: 'thisMonth',
    },
    accounts: [],
    categories: [],
    tags: [],
    transactionType: 'all',
  });

  const [trendGroupBy, setTrendGroupBy] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    fetchAnalytics();
    fetchFilterData();
  }, [filters]);

  useEffect(() => {
    fetchAnalytics();
    fetchFilterData();
  }, [filters]);

  const fetchFilterData = async () => {
    try {
      const [categoriesRes, accountsRes, tagsRes] = await Promise.all([
        axios.get(`/api/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/tags`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      setCategories(categoriesRes.data.categories || []);
      setAccounts(accountsRes.data.accounts || []);
      setTags(tagsRes.data.tags || []);
    } catch (err) {
      console.error('Error fetching filter data:', err);
    }
  };

  const fetchAnalytics = async () => {
    if (!filters.dateRange.start || !filters.dateRange.end) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: filters.dateRange.start.format('YYYY-MM-DD'),
        endDate: filters.dateRange.end.format('YYYY-MM-DD'),
        compareWithPrevious: 'true',
      });

      if (filters.accounts.length > 0) {
        params.append('accounts', filters.accounts.join(','));
      }
      if (filters.categories.length > 0) {
        params.append('categories', filters.categories.join(','));
      }
      if (filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','));
      }

      const [
        overviewRes,
        breakdownRes,
        folderBreakdownRes,
        trendsRes,
        comparisonRes,
        topExpensesRes,
        accountsRes,
        recurringRes,
        tagsRes,
        merchantsRes,
        insightsRes,
        categoriesRes,
      ] = await Promise.all([
        axios.get(`/api/analytics/overview?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/analytics/category-breakdown?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/analytics/folder-breakdown?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/analytics/trends?${params}&groupBy=${trendGroupBy}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/analytics/budget-comparison?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/analytics/top-expenses?${params}&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/transactions?isRecurring=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/tags`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/analytics/top-merchants?${params}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/analytics/smart-insights?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/categories`, {
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

      // Process account breakdown
      const accounts = accountsRes.data.accounts || [];
      const transactionsRes = await axios.get(
        `/api/transactions?startDate=${filters.dateRange.start.format('YYYY-MM-DD')}&endDate=${filters.dateRange.end.format('YYYY-MM-DD')}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const transactions = transactionsRes.data.transactions || [];

      const accountStats = accounts.map((account: any) => {
        const accountTxns = transactions.filter((t: any) => t.accountId === account.id);
        const credits = accountTxns
          .filter((t: any) => t.type === 'credit')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const debits = accountTxns
          .filter((t: any) => t.type === 'debit')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        return {
          accountId: account.id,
          accountName: account.name,
          accountType: account.accountType,
          credits,
          debits,
          netFlow: credits - debits,
          balance: account.balance,
          transactionCount: accountTxns.length,
        };
      });
      setAccountBreakdown(accountStats);

      // Process recurring insights
      const recurringTxns = recurringRes.data.transactions || [];
      const recurringTemplates = recurringTxns.filter((t: any) => !t.linkedTransactionId);

      const frequencyMap = new Map<string, { count: number; amount: number }>();
      let totalRecurringCost = 0;

      recurringTemplates.forEach((t: any) => {
        const freq = t.recurrencePattern?.frequency || 'unknown';
        const existing = frequencyMap.get(freq) || { count: 0, amount: 0 };

        // Annualize to monthly cost
        let monthlyCost = t.amount;
        if (freq === 'daily') monthlyCost = t.amount * 30;
        else if (freq === 'weekly') monthlyCost = t.amount * 4;
        else if (freq === 'yearly') monthlyCost = t.amount / 12;

        frequencyMap.set(freq, {
          count: existing.count + 1,
          amount: existing.amount + (t.type === 'debit' ? monthlyCost : 0),
        });

        totalRecurringCost += t.type === 'debit' ? monthlyCost : 0;
      });

      const oneTimeDebits = transactions.filter(
        (t: any) => t.type === 'debit' && !t.isRecurring && !t.linkedTransactionId
      );
      const oneTimeAmount = oneTimeDebits.reduce((sum: number, t: any) => sum + t.amount, 0);
      const recurringDebits = transactions.filter(
        (t: any) => t.type === 'debit' && (t.isRecurring || t.linkedTransactionId)
      );
      const recurringAmount = recurringDebits.reduce((sum: number, t: any) => sum + t.amount, 0);

      const upcomingThisMonth = recurringTemplates.filter((t: any) => {
        if (!t.recurrencePattern) return false;
        const lastCreated = t.recurrencePattern.lastCreated
          ? new Date(t.recurrencePattern.lastCreated)
          : new Date(t.date);
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        let nextDate = new Date(lastCreated);
        const freq = t.recurrencePattern.frequency;

        if (freq === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (freq === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (freq === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
          if (t.recurrencePattern.day) nextDate.setDate(t.recurrencePattern.day);
        } else if (freq === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

        return nextDate >= now && nextDate <= endOfMonth;
      }).length;

      setRecurringInsights({
        totalRecurringTemplates: recurringTemplates.length,
        monthlyRecurringCost: totalRecurringCost,
        upcomingThisMonth,
        recurringVsOneTime: {
          recurringAmount,
          oneTimeAmount,
          recurringPercentage:
            recurringAmount + oneTimeAmount > 0
              ? Math.round((recurringAmount / (recurringAmount + oneTimeAmount)) * 100)
              : 0,
        },
        byFrequency: Array.from(frequencyMap.entries()).map(([freq, data]) => ({
          frequency: freq,
          count: data.count,
          totalAmount: data.amount,
        })),
      });

      // Process tag breakdown
      const allTags = tagsRes.data.tags || [];
      const tagMap = new Map<string, { amount: number; count: number }>();

      transactions.forEach((t: any) => {
        if (t.type === 'debit' && t.tags && Array.isArray(t.tags)) {
          t.tags.forEach((tagId: string) => {
            const existing = tagMap.get(tagId) || { amount: 0, count: 0 };
            tagMap.set(tagId, {
              amount: existing.amount + t.amount,
              count: existing.count + 1,
            });
          });
        }
      });

      const totalTaggedAmount = Array.from(tagMap.values()).reduce(
        (sum, data) => sum + data.amount,
        0
      );
      const tagStats = Array.from(tagMap.entries())
        .map(([tagId, data]) => {
          const tag = allTags.find((t: any) => t.id === tagId);
          return {
            tag: tag?.name || 'Unknown',
            amount: data.amount,
            count: data.count,
            percentage:
              totalTaggedAmount > 0 ? Math.round((data.amount / totalTaggedAmount) * 100) : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      setTagBreakdown(tagStats);

      setTopMerchants(merchantsRes.data.merchants || []);
      setSmartInsights(insightsRes.data.insights || null);

      // Auto-expand top 3 spending folders
      const top3Folders = folders.slice(0, 3).map((f: any) => f.categoryId);
      setExpandedFolders(new Set(top3Folders));

      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'USD', true, 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!overview) return;

    const rows: string[][] = [];
    
    // Overview section
    rows.push(['Analytics Export']);
    rows.push(['Period', `${filters.dateRange.start.format('YYYY-MM-DD')} to ${filters.dateRange.end.format('YYYY-MM-DD')}`]);
    rows.push(['']);
    rows.push(['Overview']);
    rows.push(['Total Spent', overview.totalSpent.toString()]);
    rows.push(['Total Budget', overview.totalBudget.toString()]);
    rows.push(['Budget Used %', overview.budgetUsedPercent.toString()]);
    rows.push(['Expense Count', overview.expenseCount.toString()]);
    rows.push(['Average Expense', overview.avgExpense.toString()]);
    if (overview.comparison) {
      rows.push(['Previous Period Spent', overview.comparison.previousSpent.toString()]);
      rows.push(['Change Amount', overview.comparison.changeAmount.toString()]);
      rows.push(['Change %', overview.comparison.changePercent.toString()]);
    }
    rows.push(['']);

    // Category Breakdown
    rows.push(['Category Breakdown']);
    rows.push(['Category', 'Amount', 'Count', 'Percentage']);
    categoryBreakdown.forEach(cat => {
      rows.push([cat.categoryName, cat.amount.toString(), cat.count.toString(), cat.percentage.toFixed(2) + '%']);
    });
    rows.push(['']);

    // Budget Comparison
    if (budgetComparison.length > 0) {
      rows.push(['Budget Comparison']);
      rows.push(['Category', 'Budget', 'Spent', 'Difference', 'Status']);
      budgetComparison.forEach(budget => {
        rows.push([
          budget.categoryName,
          budget.budgetAmount.toString(),
          budget.actualSpent.toString(),
          budget.difference.toString(),
          budget.isOverBudget ? 'Over Budget' : 'On Track'
        ]);
      });
      rows.push(['']);
    }

    // Top Expenses
    if (topExpenses.length > 0) {
      rows.push(['Top Expenses']);
      rows.push(['Description', 'Amount', 'Category', 'Date']);
      topExpenses.slice(0, 20).forEach(exp => {
        rows.push([exp.description, exp.amount.toString(), exp.categoryName, exp.date]);
      });
    }

    // Convert to CSV string
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_${filters.dateRange.start.format('YYYY-MM-DD')}_to_${filters.dateRange.end.format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const allFolderIds = categories.filter((cat) => cat.isFolder).map((cat) => cat.id);
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
    const spendingMap = new Map(categoryBreakdown.map((item) => [item.categoryId, item]));

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
    const roots = categories.filter((cat) => !cat.parentId).map((cat) => buildNode(cat));

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
            📊 Analytics
          </Typography>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={exportToCSV}
            disabled={!overview}
          >
            Export CSV
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          accounts={accounts}
          categories={categories}
          tags={tags}
          showTransactionType={false}
        />

        {/* Tabs for different views */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Trends & Patterns" />
            <Tab label="Budgets & Goals" />
          </Tabs>
        </Box>

        {/* Overview Statistics with Comparison */}
        {overview && overview.comparison && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2">
                    Total Spent
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {formatCurrency(overview.totalSpent)}
                  </Typography>
                  {overview.comparison && (
                    <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                      {overview.comparison.trend === 'up' ? (
                        <TrendingUpIcon color="error" fontSize="small" />
                      ) : overview.comparison.trend === 'down' ? (
                        <TrendingDownIcon color="success" fontSize="small" />
                      ) : null}
                      <Typography
                        variant="body2"
                        color={
                          overview.comparison.trend === 'up'
                            ? 'error'
                            : overview.comparison.trend === 'down'
                            ? 'success'
                            : 'textSecondary'
                        }
                      >
                        {overview.comparison.changePercent > 0 ? '+' : ''}
                        {overview.comparison.changePercent.toFixed(1)}% vs previous
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2">
                    Budget Used
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {overview.budgetUsedPercent}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(overview.budgetUsedPercent, 100)}
                    color={overview.budgetUsedPercent > 100 ? 'error' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2">
                    Transactions
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {overview.expenseCount}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" mt={1}>
                    Avg: {formatCurrency(overview.avgExpense)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2">
                    Budget Remaining
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {formatCurrency(overview.totalBudget - overview.totalSpent)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" mt={1}>
                    of {formatCurrency(overview.totalBudget)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Tab Content */}
        {currentTab === 0 && (
          <>
            {/* Smart Insights Section */}
            {smartInsights && (
          <Grid container spacing={2} mb={3}>
            {/* Overall Trend Alert */}
            {smartInsights.overallTrend && (
              <Grid item xs={12}>
                <Alert
                  severity={smartInsights.overallTrend.direction === 'up' ? 'warning' : 'success'}
                  icon={
                    smartInsights.overallTrend.direction === 'up' ? (
                      <TrendingUpIcon />
                    ) : (
                      <TrendingDownIcon />
                    )
                  }
                  sx={{ borderRadius: 2 }}
                >
                  <Typography variant="body2">
                    <strong>Spending Trend:</strong> Your spending is{' '}
                    <strong>
                      {Math.abs(smartInsights.overallTrend.percentChange)}%{' '}
                      {smartInsights.overallTrend.direction === 'up' ? 'higher' : 'lower'}
                    </strong>{' '}
                    compared to the previous period (
                    {formatCurrency(smartInsights.overallTrend.previousTotal)} →{' '}
                    {formatCurrency(smartInsights.overallTrend.currentTotal)})
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
                          {formatCurrency(alert.spent)} / {formatCurrency(alert.budgetAmount)}(
                          {alert.percentOver}% over)
                        </Typography>
                      </Box>
                    ))}
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
                            bgcolor={
                              trend.trend === 'increasing' ? 'error.lighter' : 'success.lighter'
                            }
                            sx={{
                              bgcolor:
                                trend.trend === 'increasing'
                                  ? 'rgba(211, 47, 47, 0.08)'
                                  : 'rgba(46, 125, 50, 0.08)',
                            }}
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
                              bgcolor:
                                trend.trend === 'increasing'
                                  ? 'rgba(211, 47, 47, 0.08)'
                                  : 'rgba(46, 125, 50, 0.08)',
                              border: '1px solid',
                              borderColor:
                                trend.trend === 'increasing'
                                  ? 'rgba(211, 47, 47, 0.2)'
                                  : 'rgba(46, 125, 50, 0.2)',
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
                                  color={
                                    trend.trend === 'increasing' ? 'error.main' : 'success.main'
                                  }
                                  fontWeight={700}
                                >
                                  {Math.abs(trend.percentChange)}%
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {formatCurrency(trend.currentAmount)}
                              </Typography>
                            </Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              mt={0.5}
                              display="block"
                            >
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
                        borderBottom={
                          idx < smartInsights.unusualExpenses.length - 1 ? '1px solid' : 'none'
                        }
                        borderColor="divider"
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {expense.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(expense.date).toLocaleDateString()} • {expense.timesAverage}x
                            average
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
            <Card
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
              }}
            >
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
            <Card
              sx={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
              }}
            >
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
            <Card
              sx={{
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
              }}
            >
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
            <Card
              sx={{
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                color: 'white',
              }}
            >
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
            <Card
              sx={{
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'rgba(30, 30, 30, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              }}
            >
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
                          {(viewMode === 'category' ? categoryBreakdown : folderBreakdown).map(
                            (entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.categoryColor} />
                            )
                          )}
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
                      {(viewMode === 'category' ? categoryBreakdown : folderBreakdown).map(
                        (cat, index) => (
                          <Box
                            key={cat.categoryId}
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            py={1}
                            borderBottom={
                              index <
                              (viewMode === 'category' ? categoryBreakdown : folderBreakdown)
                                .length -
                                1
                                ? '1px solid'
                                : 'none'
                            }
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
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {viewMode === 'folder' ? cat.categoryName : cat.path.join(' > ')}{' '}
                                {cat.isFolder && '📁'}
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
                        )
                      )}
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
            <Card
              sx={{
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'rgba(30, 30, 30, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              }}
            >
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
            <Card
              sx={{
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'rgba(30, 30, 30, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              }}
            >
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={2}>
                  Budget vs Actual Spending
                </Typography>
                {budgetComparison.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={budgetComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="categoryName" tick={{ fontSize: 12 }} />
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
                                whiteSpace: 'nowrap',
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
                              {formatCurrency(budget.actualSpent)} /{' '}
                              {formatCurrency(budget.budgetAmount)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {budget.isOverBudget ? 'Over by ' : 'Remaining '}
                              {formatCurrency(Math.abs(budget.difference))}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </>
                ) : (
                  <Box textAlign="center" py={6}>
                    <Typography color="text.secondary">No budgets set for this period</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Top Expenses */}
          <Grid item xs={12}>
            <Card
              sx={{
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'rgba(30, 30, 30, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              }}
            >
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
                          <Typography
                            variant="h6"
                            color="text.secondary"
                            fontWeight={600}
                            flexShrink={0}
                          >
                            #{index + 1}
                          </Typography>
                          <Box minWidth={0} flex={1}>
                            <Typography
                              variant="body1"
                              fontWeight={500}
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
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
                        <Typography
                          variant="h6"
                          fontWeight={700}
                          color="error.main"
                          flexShrink={0}
                          noWrap
                        >
                          {formatCurrency(expense.amount)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box textAlign="center" py={6}>
                    <Typography color="text.secondary">No expenses for this period</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Account Cash Flow Breakdown */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={3}>
                  Account Cash Flow
                </Typography>
                {accountBreakdown.length > 0 ? (
                  <Box>
                    {accountBreakdown.map((account, index) => (
                      <Box
                        key={account.accountId}
                        py={2}
                        borderBottom={index < accountBreakdown.length - 1 ? '1px solid' : 'none'}
                        borderColor="divider"
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Typography variant="body1" fontWeight={600}>
                            {account.accountName}
                          </Typography>
                          <Chip
                            label={account.accountType}
                            size="small"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="body2" color="success.main">
                            ↑ Credits: {formatCurrency(account.credits)}
                          </Typography>
                          <Typography variant="body2" color="error.main">
                            ↓ Debits: {formatCurrency(account.debits)}
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {account.transactionCount} transactions
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color={account.netFlow >= 0 ? 'success.main' : 'error.main'}
                          >
                            Net: {account.netFlow >= 0 ? '+' : ''}
                            {formatCurrency(account.netFlow)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box textAlign="center" py={6}>
                    <Typography color="text.secondary">No account data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Recurring Transaction Insights */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={3}>
                  Recurring Transaction Insights
                </Typography>
                {recurringInsights ? (
                  <Grid container spacing={3}>
                    {/* Overview Cards */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        textAlign="center"
                        p={2}
                        bgcolor="rgba(102, 126, 234, 0.08)"
                        borderRadius={2}
                      >
                        <Typography variant="h4" fontWeight={700} color="primary">
                          {recurringInsights.totalRecurringTemplates}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                          Active Templates
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        textAlign="center"
                        p={2}
                        bgcolor="rgba(244, 67, 54, 0.08)"
                        borderRadius={2}
                      >
                        <Typography variant="h4" fontWeight={700} color="error.main">
                          {formatCurrency(recurringInsights.monthlyRecurringCost)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                          Monthly Cost
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        textAlign="center"
                        p={2}
                        bgcolor="rgba(76, 175, 80, 0.08)"
                        borderRadius={2}
                      >
                        <Typography variant="h4" fontWeight={700} color="success.main">
                          {recurringInsights.upcomingThisMonth}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                          Due This Month
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        textAlign="center"
                        p={2}
                        bgcolor="rgba(255, 152, 0, 0.08)"
                        borderRadius={2}
                      >
                        <Typography variant="h4" fontWeight={700} color="warning.main">
                          {recurringInsights.recurringVsOneTime.recurringPercentage}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                          Recurring Ratio
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Frequency Breakdown */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="body1" fontWeight={600} mb={2}>
                        By Frequency
                      </Typography>
                      {recurringInsights.byFrequency.map((freq, idx) => (
                        <Box
                          key={idx}
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          py={1.5}
                          borderBottom={
                            idx < recurringInsights.byFrequency.length - 1 ? '1px solid' : 'none'
                          }
                          borderColor="divider"
                        >
                          <Box>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ textTransform: 'capitalize' }}
                            >
                              {freq.frequency}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {freq.count} {freq.count === 1 ? 'transaction' : 'transactions'}
                            </Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={700}>
                            {formatCurrency(freq.totalAmount)}/mo
                          </Typography>
                        </Box>
                      ))}
                    </Grid>

                    {/* Recurring vs One-Time */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="body1" fontWeight={600} mb={2}>
                        Spending Composition
                      </Typography>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: 'Recurring',
                                value: recurringInsights.recurringVsOneTime.recurringAmount,
                                color: '#667eea',
                              },
                              {
                                name: 'One-Time',
                                value: recurringInsights.recurringVsOneTime.oneTimeAmount,
                                color: '#43e97b',
                              },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            dataKey="value"
                          >
                            <Cell fill="#667eea" />
                            <Cell fill="#43e97b" />
                          </Pie>
                          <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Grid>
                  </Grid>
                ) : (
                  <Box textAlign="center" py={6}>
                    <Typography color="text.secondary">
                      No recurring transaction data available
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Tag-Based Analytics */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={3}>
                  Spending by Tags
                </Typography>
                {tagBreakdown.length > 0 ? (
                  <Box>
                    {tagBreakdown.map((tag, index) => (
                      <Box
                        key={index}
                        py={1.5}
                        borderBottom={index < tagBreakdown.length - 1 ? '1px solid' : 'none'}
                        borderColor="divider"
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={0.5}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            #{tag.tag}
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {formatCurrency(tag.amount)}
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <LinearProgress
                            variant="determinate"
                            value={tag.percentage}
                            sx={{
                              width: '70%',
                              height: 6,
                              borderRadius: 1,
                              bgcolor: 'rgba(0,0,0,0.05)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 1,
                                bgcolor: '#667eea',
                              },
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {tag.count} txns · {tag.percentage}%
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box textAlign="center" py={6}>
                    <Typography color="text.secondary">No tagged transactions</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Payment Method Breakdown - REMOVED */}
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
                          <Typography
                            variant="h6"
                            color="text.secondary"
                            fontWeight={600}
                            flexShrink={0}
                          >
                            #{index + 1}
                          </Typography>
                          <Box minWidth={0} flex={1}>
                            <Typography
                              variant="body1"
                              fontWeight={500}
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {merchant.merchantName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {merchant.count} transactions · {merchant.percentage}% of total
                            </Typography>
                          </Box>
                        </Box>
                        <Typography
                          variant="h6"
                          fontWeight={700}
                          color="primary.main"
                          flexShrink={0}
                          noWrap
                        >
                          {formatCurrency(merchant.amount)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box textAlign="center" py={6}>
                    <Typography color="text.secondary">No merchant data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Folder Structure Tree View */}
          <Grid item xs={12}>
            <Card
              sx={{
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'rgba(30, 30, 30, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              }}
            >
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={3}
                  flexWrap="wrap"
                  gap={2}
                >
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
                  <List disablePadding>{treeData.map((node) => renderTreeNode(node))}</List>
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
          </>
        )}

        {/* Tab 1: Trends & Patterns */}
        {currentTab === 1 && (
          <Grid container spacing={3}>
            {/* Spending Trend Line Chart */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={600}>
                      Spending Trend Over Time
                    </Typography>
                    <ToggleButtonGroup
                      value={trendGroupBy}
                      exclusive
                      onChange={(_, value) => value && setTrendGroupBy(value)}
                      size="small"
                    >
                      <ToggleButton value="day">Daily</ToggleButton>
                      <ToggleButton value="week">Weekly</ToggleButton>
                      <ToggleButton value="month">Monthly</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  {trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(date) => formatDate(date)}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <RechartsTooltip
                          formatter={(value: any) => [formatCurrency(value), 'Amount']}
                          labelFormatter={(label) => formatDate(label)}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#667eea"
                          strokeWidth={2}
                          dot={{ fill: '#667eea', r: 4 }}
                          name="Spending"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box textAlign="center" py={6}>
                      <Typography color="textSecondary">No trend data available</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Day of Week Analysis */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Spending by Day of Week
                  </Typography>
                  {(() => {
                    // Calculate day of week spending
                    const dayOfWeekData = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                      (day, index) => {
                        const dayTransactions = topExpenses.filter((exp) => {
                          const expDate = new Date(exp.date);
                          return expDate.getDay() === index;
                        });
                        const total = dayTransactions.reduce((sum, exp) => sum + exp.amount, 0);
                        return { day, amount: total, count: dayTransactions.length };
                      }
                    );

                    return dayOfWeekData.some((d) => d.amount > 0) ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={dayOfWeekData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <RechartsTooltip
                            formatter={(value: any) => [formatCurrency(value), 'Amount']}
                          />
                          <Bar dataKey="amount" fill="#667eea" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box textAlign="center" py={4}>
                        <Typography color="textSecondary">
                          Not enough data for day of week analysis
                        </Typography>
                      </Box>
                    );
                  })()}
                </CardContent>
              </Card>
            </Grid>

            {/* Category Trend */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Top Category Growth
                  </Typography>
                  {categoryBreakdown.length > 0 ? (
                    <Box>
                      {categoryBreakdown.slice(0, 5).map((cat, index) => (
                        <Box
                          key={cat.categoryId}
                          mb={2}
                          pb={index < 4 ? 2 : 0}
                          borderBottom={index < 4 ? '1px solid' : 'none'}
                          borderColor="divider"
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box
                                width={12}
                                height={12}
                                borderRadius="50%"
                                bgcolor={cat.categoryColor}
                              />
                              <Typography variant="body2" fontWeight={500}>
                                {cat.categoryName}
                              </Typography>
                            </Box>
                            <Typography variant="body2" fontWeight={700}>
                              {formatCurrency(cat.amount)}
                            </Typography>
                          </Box>
                          <Box mt={1}>
                            <LinearProgress
                              variant="determinate"
                              value={cat.percentage}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: cat.categoryColor,
                                },
                              }}
                            />
                            <Typography variant="caption" color="textSecondary" mt={0.5}>
                              {cat.percentage.toFixed(1)}% of total · {cat.count} transactions
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Box textAlign="center" py={4}>
                      <Typography color="textSecondary">No category data available</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Average Daily Spending */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2" mb={1}>
                    Average Daily Spending
                  </Typography>
                  <Typography variant="h4" fontWeight={700} color="primary">
                    {overview
                      ? formatCurrency(
                          overview.totalSpent /
                            Math.max(
                              1,
                              filters.dateRange.end.diff(filters.dateRange.start, 'days') + 1
                            )
                        )
                      : formatCurrency(0)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" mt={1}>
                    Based on {filters.dateRange.end.diff(filters.dateRange.start, 'days') + 1} days
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Highest Spending Day */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2" mb={1}>
                    Highest Spending Day
                  </Typography>
                  {trends.length > 0 ? (
                    <>
                      <Typography variant="h4" fontWeight={700} color="error">
                        {formatCurrency(Math.max(...trends.map((t) => t.amount)))}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" mt={1}>
                        {formatDate(
                          trends.find((t) => t.amount === Math.max(...trends.map((d) => d.amount)))
                            ?.date || ''
                        )}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No data
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Most Active Category */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" variant="body2" mb={1}>
                    Most Active Category
                  </Typography>
                  {categoryBreakdown.length > 0 ? (
                    <>
                      <Typography variant="h6" fontWeight={700} noWrap>
                        {categoryBreakdown[0].categoryName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" mt={1}>
                        {categoryBreakdown[0].count} transactions ·{' '}
                        {categoryBreakdown[0].percentage.toFixed(1)}%
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No data
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Tab 2: Budgets & Goals */}
        {currentTab === 2 && (
          <Grid container spacing={3}>
            {/* Budget Overview Summary */}
            <Grid item xs={12}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                }}
              >
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Total Budget
                      </Typography>
                      <Typography variant="h4" fontWeight={700}>
                        {overview ? formatCurrency(overview.totalBudget) : formatCurrency(0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Total Spent
                      </Typography>
                      <Typography variant="h4" fontWeight={700}>
                        {overview ? formatCurrency(overview.totalSpent) : formatCurrency(0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Remaining
                      </Typography>
                      <Typography variant="h4" fontWeight={700}>
                        {overview
                          ? formatCurrency(overview.totalBudget - overview.totalSpent)
                          : formatCurrency(0)}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={overview ? Math.min(overview.budgetUsedPercent, 100) : 0}
                        sx={{
                          mt: 1,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: 'rgba(255,255,255,0.3)',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: 'white',
                          },
                        }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Budget vs Actual Comparison */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} mb={3}>
                    Budget vs Actual by Category
                  </Typography>
                  {budgetComparison.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={budgetComparison}
                        layout="horizontal"
                        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                        <YAxis type="category" dataKey="categoryName" width={90} />
                        <RechartsTooltip
                          formatter={(value: any) => [formatCurrency(value), '']}
                          contentStyle={{ fontSize: '14px' }}
                        />
                        <Legend />
                        <Bar
                          dataKey="budgetAmount"
                          fill="#90caf9"
                          name="Budget"
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar dataKey="spent" fill="#667eea" name="Spent" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box textAlign="center" py={6}>
                      <Typography color="textSecondary">
                        No budgets configured. Create budgets to see comparisons.
                      </Typography>
                      <Button
                        variant="contained"
                        sx={{ mt: 2 }}
                        onClick={() => navigate('/budgets')}
                      >
                        Create Budget
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Budget Status Cards */}
            {budgetComparison.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="h6" fontWeight={600} mb={2}>
                  Budget Status Details
                </Typography>
                <Grid container spacing={2}>
                  {budgetComparison.map((budget) => {
                    const percentUsed = budget.percentUsed;
                    const isOverBudget = budget.isOverBudget;
                    const isNearLimit = percentUsed > 80 && percentUsed <= 100;

                    return (
                      <Grid item xs={12} sm={6} md={4} key={budget.categoryId}>
                        <Card
                          sx={{
                            borderLeft: '4px solid',
                            borderColor: isOverBudget
                              ? 'error.main'
                              : isNearLimit
                              ? 'warning.main'
                              : 'success.main',
                          }}
                        >
                          <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <Box
                                width={12}
                                height={12}
                                borderRadius="50%"
                                bgcolor={budget.categoryColor || '#667eea'}
                              />
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {budget.categoryName}
                              </Typography>
                            </Box>
                            <Typography variant="h6" fontWeight={700}>
                              {formatCurrency(budget.actualSpent)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              of {formatCurrency(budget.budgetAmount)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(percentUsed, 100)}
                              color={isOverBudget ? 'error' : isNearLimit ? 'warning' : 'success'}
                              sx={{ mt: 1, mb: 1, height: 6, borderRadius: 3 }}
                            />
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="caption" fontWeight={600}>
                                {percentUsed.toFixed(1)}% used
                              </Typography>
                              {isOverBudget && (
                                <Chip
                                  label="Over Budget"
                                  size="small"
                                  color="error"
                                  sx={{ height: 20 }}
                                />
                              )}
                              {isNearLimit && !isOverBudget && (
                                <Chip
                                  label="Near Limit"
                                  size="small"
                                  color="warning"
                                  sx={{ height: 20 }}
                                />
                              )}
                            </Box>
                            {budget.difference < 0 ? (
                              <Typography variant="caption" color="error.main" mt={1}>
                                Over by {formatCurrency(Math.abs(budget.difference))}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="success.main" mt={1}>
                                {formatCurrency(budget.difference)} remaining
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Grid>
            )}

            {/* Budget Performance Insights */}
            {budgetComparison.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" fontWeight={600} mb={2}>
                      Budget Performance Insights
                    </Typography>
                    <Grid container spacing={2}>
                      {/* Categories Over Budget */}
                      <Grid item xs={12} sm={6} md={3}>
                        <Box textAlign="center" p={2}>
                          <Typography variant="h3" fontWeight={700} color="error">
                            {budgetComparison.filter((b) => b.isOverBudget).length}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Over Budget
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Categories On Track */}
                      <Grid item xs={12} sm={6} md={3}>
                        <Box textAlign="center" p={2}>
                          <Typography variant="h3" fontWeight={700} color="success">
                            {
                              budgetComparison.filter(
                                (b) => !b.isOverBudget && b.percentUsed >= 80
                              ).length
                            }
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            On Track
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Categories Under Budget */}
                      <Grid item xs={12} sm={6} md={3}>
                        <Box textAlign="center" p={2}>
                          <Typography variant="h3" fontWeight={700} color="primary">
                            {budgetComparison.filter((b) => b.percentUsed < 80).length}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Under Budget
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Total Savings */}
                      <Grid item xs={12} sm={6} md={3}>
                        <Box textAlign="center" p={2}>
                          <Typography variant="h3" fontWeight={700} color="success.main">
                            {formatCurrency(
                              budgetComparison
                                .filter((b) => b.difference > 0)
                                .reduce((sum, b) => sum + b.difference, 0)
                            )}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Total Savings
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Budget Forecast */}
            {budgetComparison.length > 0 && overview && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <LightbulbIcon color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Budget Forecast
                      </Typography>
                    </Box>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Based on your current spending rate, here's a projection for the rest of the
                      period
                    </Alert>
                    <Grid container spacing={2}>
                      {budgetComparison.slice(0, 3).map((budget) => {
                        const daysInPeriod =
                          filters.dateRange.end.diff(filters.dateRange.start, 'days') + 1;
                        const daysElapsed =
                          dayjs().diff(filters.dateRange.start, 'days') + 1;
                        const daysRemaining = Math.max(0, daysInPeriod - daysElapsed);
                        const dailyRate = budget.actualSpent / Math.max(1, daysElapsed);
                        const projectedTotal = budget.actualSpent + dailyRate * daysRemaining;
                        const willExceed = projectedTotal > budget.budgetAmount;

                        return (
                          <Grid item xs={12} md={4} key={budget.categoryId}>
                            <Card variant="outlined">
                              <CardContent>
                                <Typography variant="body2" fontWeight={600} gutterBottom>
                                  {budget.categoryName}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  Daily average: {formatCurrency(dailyRate)}
                                </Typography>
                                <Box mt={2}>
                                  <Typography variant="body2" color="textSecondary">
                                    Projected total:
                                  </Typography>
                                  <Typography
                                    variant="h6"
                                    fontWeight={700}
                                    color={willExceed ? 'error' : 'success.main'}
                                  >
                                    {formatCurrency(projectedTotal)}
                                  </Typography>
                                  {willExceed ? (
                                    <Chip
                                      label={`May exceed by ${formatCurrency(
                                        projectedTotal - budget.budgetAmount
                                      )}`}
                                      size="small"
                                      color="error"
                                      sx={{ mt: 1 }}
                                    />
                                  ) : (
                                    <Chip
                                      label="On track"
                                      size="small"
                                      color="success"
                                      sx={{ mt: 1 }}
                                    />
                                  )}
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
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
                {isExpanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
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
