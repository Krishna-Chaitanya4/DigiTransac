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
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  AccountBalanceWallet,
  Warning as WarningIcon,
  Add as AddIcon,
  Lightbulb as LightbulbIcon,
  AccountBalance,
  CreditCard,
  Savings,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { FilterBar, FilterValues } from '../components/FilterBar';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DashboardStats {
  totalSpent: number;
  monthSpent: number;
  monthIncome: number;
  netSavings: number;
  budgetLeft: number;
  categoryCount: number;
  expenseCount: number;
  incomeCount: number;
  avgDailySpending: number;
  percentChange: number;
  incomePercentChange: number;
}

interface RecentTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  categoryName: string;
  categoryColor: string;
  date: string;
}

interface BudgetStatus {
  categoryName: string;
  categoryId: string;
  categoryColor: string;
  spent: number;
  budget: number;
  percentage: number;
  isOver: boolean;
}

interface SpendingTrend {
  month: string;
  expenses: number;
  income: number;
}

interface CategorySpending {
  name: string;
  value: number;
  color: string;
}

interface UpcomingRecurring {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  nextDate: string;
  frequency: string;
}

interface AccountBalance {
  id: string;
  name: string;
  accountType: string;
  balance: number;
  currency: string;
}

const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [spendingTrends, setSpendingTrends] = useState<SpendingTrend[]>([]);
  const [topCategories, setTopCategories] = useState<CategorySpending[]>([]);
  const [upcomingRecurring, setUpcomingRecurring] = useState<UpcomingRecurring[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [smartInsights, setSmartInsights] = useState<{
    highestCategory: string;
    unusualSpending: boolean;
    savingsTrend: 'improving' | 'declining' | 'stable';
    budgetHealthScore: number;
  } | null>(null);

  // Filter states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  const [filters, setFilters] = useState<FilterValues>({
    dateRange: {
      start: dayjs().startOf('month'),
      end: dayjs().endOf('month'),
      preset: 'thisMonth',
    },
    accounts: [],
    categories: [],
    tags: [],
    transactionType: 'all',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    // Only fetch dashboard data once initial data is loaded
    if (initialDataLoaded) {
      fetchDashboardData();
    }
  }, [filters, initialDataLoaded]);

  const fetchInitialData = async () => {
    try {
      const [accountsRes, categoriesRes, tagsRes] = await Promise.all([
        axios.get('/api/accounts', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/tags', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      setAccounts(accountsRes.data.accounts || []);
      setCategories(categoriesRes.data.categories || []);
      setTags(tagsRes.data.tags || []);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
      // Set empty arrays on error to unblock dashboard loading
      setAccounts([]);
      setCategories([]);
      setTags([]);
    } finally {
      setInitialDataLoaded(true);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const startDate = filters.dateRange.start.toISOString();
      const endDate = filters.dateRange.end.toISOString();
      
      // Build query params for transactions API
      const txnParams = new URLSearchParams({
        startDate,
        endDate,
        sortBy: 'date',
        sortOrder: 'desc',
      });
      
      // Add account filters if specified
      if (filters.accounts.length > 0) {
        filters.accounts.forEach(accountId => txnParams.append('accountIds', accountId));
      }

      const [transactionsRes, budgetsRes, accountsRes] = await Promise.all([
        axios.get(`/api/transactions?${txnParams}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/budgets`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      let transactions = transactionsRes.data.transactions || [];

      // Apply client-side filtering for categories and tags
      transactions = transactions.filter((t: any) => {
        // Filter by transaction type
        if (filters.transactionType !== 'all' && t.type !== filters.transactionType) {
          return false;
        }
        
        // Filter by categories (check splits)
        if (filters.categories.length > 0) {
          const txnCategories = t.splits?.map((s: any) => s.categoryId) || [t.categoryId];
          const hasMatchingCategory = txnCategories.some((catId: string) => 
            filters.categories.includes(catId)
          );
          if (!hasMatchingCategory) return false;
        }
        
        // Filter by tags
        if (filters.tags.length > 0) {
          const txnTags = t.tags || [];
          const hasMatchingTag = txnTags.some((tag: string) => filters.tags.includes(tag));
          if (!hasMatchingTag) return false;
        }
        
        return true;
      });

      const debits = transactions.filter((t: any) => t.type === 'debit');
      const credits = transactions.filter((t: any) => t.type === 'credit');
      const totalSpent = debits.reduce((sum: number, t: any) => sum + t.amount, 0);
      const totalIncome = credits.reduce((sum: number, t: any) => sum + t.amount, 0);
      const netSavings = totalIncome - totalSpent;

      // Calculate previous period for comparison (same duration as current period)
      const currentStart = filters.dateRange.start.toDate();
      const currentEnd = filters.dateRange.end.toDate();
      const periodDuration = currentEnd.getTime() - currentStart.getTime();
      const prevEnd = new Date(currentStart.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - periodDuration);
      
      const prevParams = new URLSearchParams({
        startDate: prevStart.toISOString(),
        endDate: prevEnd.toISOString(),
      });
      if (filters.accounts.length > 0) {
        filters.accounts.forEach(accountId => prevParams.append('accountIds', accountId));
      }
      
      const prevRes = await axios.get(`/api/transactions?${prevParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let prevTransactions = prevRes.data.transactions || [];

      // Apply same client-side filtering to previous period
      prevTransactions = prevTransactions.filter((t: any) => {
        if (filters.transactionType !== 'all' && t.type !== filters.transactionType) {
          return false;
        }
        if (filters.categories.length > 0) {
          const txnCategories = t.splits?.map((s: any) => s.categoryId) || [t.categoryId];
          const hasMatchingCategory = txnCategories.some((catId: string) => 
            filters.categories.includes(catId)
          );
          if (!hasMatchingCategory) return false;
        }
        if (filters.tags.length > 0) {
          const txnTags = t.tags || [];
          const hasMatchingTag = txnTags.some((tag: string) => filters.tags.includes(tag));
          if (!hasMatchingTag) return false;
        }
        return true;
      });

      const prevSpent = prevTransactions
        .filter((t: any) => t.type === 'debit')
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      const prevIncome = prevTransactions
        .filter((t: any) => t.type === 'credit')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      // Calculate percentage changes
      let spentChange = 0;
      if (prevSpent > 0) {
        spentChange = Math.round(((totalSpent - prevSpent) / prevSpent) * 100);
      } else if (totalSpent > 0) {
        spentChange = 100;
      }

      let incomeChange = 0;
      if (prevIncome > 0) {
        incomeChange = Math.round(((totalIncome - prevIncome) / prevIncome) * 100);
      } else if (totalIncome > 0) {
        incomeChange = 100;
      }
      
      // Calculate days in current period for average daily spending
      const daysInPeriod = Math.ceil(periodDuration / (1000 * 60 * 60 * 24)) || 1;

      setStats({
        totalSpent,
        monthSpent: totalSpent,
        monthIncome: totalIncome,
        netSavings,
        budgetLeft: 0, // Will be calculated from budgets
        categoryCount: new Set(debits.map((t: any) => t.categoryId)).size,
        expenseCount: debits.length,
        incomeCount: credits.length,
        avgDailySpending: totalSpent / daysInPeriod,
        percentChange: spentChange,
        incomePercentChange: incomeChange,
      });

      // Process recent transactions (both credits and debits)
      const categoryMap = new Map<string, { name: string; color: string }>(
        categories.map((c: any) => [c.id, { name: c.name, color: c.color }])
      );

      setRecentTransactions(
        transactions.slice(0, 5).map((txn: any) => {
          const category = categoryMap.get(txn.categoryId);
          return {
            id: txn.id,
            description: txn.description,
            amount: txn.amount,
            type: txn.type,
            categoryName: category?.name || 'Unknown',
            categoryColor: category?.color || '#667eea',
            date: txn.date,
          };
        })
      );

      // Process budget status
      const budgets = budgetsRes.data.budgets || [];
      const budgetStatuses: BudgetStatus[] = [];
      let totalBudget = 0;

      for (const budget of budgets) {
        totalBudget += budget.amount;
        const category = categoryMap.get(budget.categoryId);
        const categoryDebits = debits.filter(
          (t: any) => t.categoryId === budget.categoryId
        );
        const spent = categoryDebits.reduce((sum: number, t: any) => sum + t.amount, 0);
        const percentage = Math.round((spent / budget.amount) * 100);

        budgetStatuses.push({
          categoryName: category?.name || 'Unknown',
          categoryId: budget.categoryId,
          categoryColor: category?.color || '#667eea',
          spent,
          budget: budget.amount,
          percentage,
          isOver: spent > budget.amount,
        });
      }
      
      // Update budget left in stats
      setStats(prev => prev ? { ...prev, budgetLeft: totalBudget - totalSpent } : null);

      setBudgetStatus(budgetStatuses.sort((a, b) => b.percentage - a.percentage).slice(0, 5));

      // Process account balances
      const accounts = accountsRes.data.accounts || [];
      setAccountBalances(
        accounts.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          accountType: acc.accountType,
          balance: acc.balance,
          currency: acc.currency || user?.currency || 'USD',
        }))
      );

      // Calculate spending trends (last 6 months)
      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const trendParams = new URLSearchParams({
        startDate: sixMonthsAgo.toISOString(),
        endDate: now.toISOString(),
      });
      if (filters.accounts.length > 0) {
        filters.accounts.forEach(accountId => trendParams.append('accountIds', accountId));
      }

      const trendsRes = await axios.get(
        `/api/transactions?${trendParams}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      let allTransactions = trendsRes.data.transactions || [];

      // Apply same client-side filtering
      allTransactions = allTransactions.filter((t: any) => {
        if (filters.transactionType !== 'all' && t.type !== filters.transactionType) {
          return false;
        }
        if (filters.categories.length > 0) {
          const txnCategories = t.splits?.map((s: any) => s.categoryId) || [t.categoryId];
          const hasMatchingCategory = txnCategories.some((catId: string) => 
            filters.categories.includes(catId)
          );
          if (!hasMatchingCategory) return false;
        }
        if (filters.tags.length > 0) {
          const txnTags = t.tags || [];
          const hasMatchingTag = txnTags.some((tag: string) => filters.tags.includes(tag));
          if (!hasMatchingTag) return false;
        }
        return true;
      });

      // Group by month for both income and expenses
      const monthlyData = new Map<string, { expenses: number; income: number }>();
      allTransactions.forEach((t: any) => {
        const date = new Date(t.date);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
        const existing = monthlyData.get(monthKey) || { expenses: 0, income: 0 };

        if (t.type === 'debit') {
          existing.expenses += t.amount;
        } else if (t.type === 'credit') {
          existing.income += t.amount;
        }
        monthlyData.set(monthKey, existing);
      });

      const trends: SpendingTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
        const data = monthlyData.get(monthKey) || { expenses: 0, income: 0 };
        trends.push({
          month: monthKey,
          expenses: data.expenses,
          income: data.income,
        });
      }
      setSpendingTrends(trends);

      // Calculate top categories (current month)
      const categorySpending = new Map<string, { name: string; value: number; color: string }>();
      debits.forEach((t: any) => {
        const category = categoryMap.get(t.categoryId);
        if (category) {
          const existing = categorySpending.get(t.categoryId);
          categorySpending.set(t.categoryId, {
            name: category.name,
            value: (existing?.value || 0) + t.amount,
            color: category.color,
          });
        }
      });

      const topCats = Array.from(categorySpending.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setTopCategories(topCats);

      // Get upcoming recurring transactions
      const recurringRes = await axios.get(`/api/transactions?isRecurring=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const recurringTxns = recurringRes.data.transactions || [];

      const upcoming: UpcomingRecurring[] = recurringTxns
        .map((t: any) => {
          if (!t.recurrencePattern) return null;

          const lastCreated = t.recurrencePattern.lastCreated
            ? new Date(t.recurrencePattern.lastCreated)
            : new Date(t.date);
          let nextDate = new Date(lastCreated);

          switch (t.recurrencePattern.frequency) {
            case 'daily':
              nextDate.setDate(nextDate.getDate() + 1);
              break;
            case 'weekly':
              nextDate.setDate(nextDate.getDate() + 7);
              break;
            case 'monthly':
              nextDate.setMonth(nextDate.getMonth() + 1);
              if (t.recurrencePattern.day) {
                nextDate.setDate(t.recurrencePattern.day);
              }
              break;
            case 'yearly':
              nextDate.setFullYear(nextDate.getFullYear() + 1);
              break;
          }

          // Only show next 30 days
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

          if (nextDate <= thirtyDaysFromNow && nextDate >= now) {
            return {
              id: t.id,
              description: t.description,
              amount: t.amount,
              type: t.type,
              nextDate: nextDate.toISOString(),
              frequency: t.recurrencePattern.frequency,
            };
          }
          return null;
        })
        .filter((t: any) => t !== null)
        .sort((a: any, b: any) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
        .slice(0, 5);

      setUpcomingRecurring(upcoming);

      // Generate alerts
      const newAlerts: string[] = [];
      const overBudget = budgetStatuses.filter((b) => b.isOver);
      if (overBudget.length > 0) {
        newAlerts.push(`${overBudget.length} categories are over budget`);
      }
      if (netSavings < 0) {
        newAlerts.push(
          `Spending exceeds income by ${formatCurrency(Math.abs(netSavings))} this month`
        );
      }
      setAlerts(newAlerts);

      // Generate Smart Insights
      const insights = {
        highestCategory: topCats.length > 0 ? topCats[0].name : 'N/A',
        unusualSpending: Math.abs(spentChange) > 30,
        savingsTrend:
          netSavings > 0 && incomeChange > spentChange
            ? ('improving' as const)
            : netSavings < 0 || spentChange > incomeChange
            ? ('declining' as const)
            : ('stable' as const),
        budgetHealthScore: Math.max(
          0,
          Math.min(100, 100 - (overBudget.length / Math.max(1, budgetStatuses.length)) * 100)
        ),
      };
      setSmartInsights(insights);

      setError('');
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      // Don't show error for empty data (new users)
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to fetch dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'USD', true, 0);
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

  const exportDashboardToCSV = () => {
    if (!stats) return;

    const rows: string[][] = [];
    
    // Header
    rows.push(['Dashboard Export']);
    rows.push(['Period', `${filters.dateRange.start.format('YYYY-MM-DD')} to ${filters.dateRange.end.format('YYYY-MM-DD')}`]);
    rows.push(['']);
    
    // Stats Summary
    rows.push(['Summary Statistics']);
    rows.push(['Month Spent', stats.monthSpent.toString()]);
    rows.push(['Month Income', stats.monthIncome.toString()]);
    rows.push(['Net Savings', stats.netSavings.toString()]);
    rows.push(['Budget Left', stats.budgetLeft.toString()]);
    rows.push(['Expense Count', stats.expenseCount.toString()]);
    rows.push(['Income Count', stats.incomeCount.toString()]);
    rows.push(['Average Daily Spending', stats.avgDailySpending.toFixed(2)]);
    rows.push(['Spending Change %', stats.percentChange.toString()]);
    rows.push(['Income Change %', stats.incomePercentChange.toString()]);
    rows.push(['']);

    // Recent Transactions
    if (recentTransactions.length > 0) {
      rows.push(['Recent Transactions']);
      rows.push(['Date', 'Description', 'Category', 'Type', 'Amount']);
      recentTransactions.forEach(txn => {
        rows.push([txn.date, txn.description, txn.categoryName, txn.type, txn.amount.toString()]);
      });
      rows.push(['']);
    }

    // Budget Status
    if (budgetStatus.length > 0) {
      rows.push(['Budget Status']);
      rows.push(['Category', 'Budget', 'Spent', 'Percentage', 'Status']);
      budgetStatus.forEach(budget => {
        rows.push([
          budget.categoryName,
          budget.budget.toString(),
          budget.spent.toString(),
          budget.percentage.toString() + '%',
          budget.isOver ? 'Over Budget' : 'On Track'
        ]);
      });
      rows.push(['']);
    }

    // Top Categories
    if (topCategories.length > 0) {
      rows.push(['Top Spending Categories']);
      rows.push(['Category', 'Amount']);
      topCategories.forEach(cat => {
        rows.push([cat.name, cat.value.toString()]);
      });
      rows.push(['']);
    }

    // Account Balances
    if (accountBalances.length > 0) {
      rows.push(['Account Balances']);
      rows.push(['Account', 'Type', 'Balance', 'Currency']);
      accountBalances.forEach(acc => {
        rows.push([acc.name, acc.accountType, acc.balance.toString(), acc.currency]);
      });
    }

    // Convert to CSV
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dashboard_${filters.dateRange.start.format('YYYY-MM-DD')}_to_${filters.dateRange.end.format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      change: `${(stats?.percentChange ?? 0) <= 0 ? '+' : ''}${Math.abs(stats?.percentChange ?? 0)}% vs last month`,
      trend: (stats?.percentChange || 0) > 0 ? 'down' : 'up',
      icon: <Receipt sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      title: 'Month Income',
      value: formatCurrency(stats?.monthIncome || 0),
      change: `${(stats?.incomePercentChange ?? 0) >= 0 ? '+' : ''}${stats?.incomePercentChange ?? 0}% vs last month`,
      trend: (stats?.incomePercentChange || 0) >= 0 ? 'up' : 'down',
      icon: <TrendingUp sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
    {
      title: 'Net Savings',
      value: formatCurrency(stats?.netSavings || 0),
      change: (stats?.netSavings || 0) >= 0 ? 'Positive flow' : 'Negative flow',
      trend: (stats?.netSavings || 0) >= 0 ? 'up' : 'down',
      icon: <AccountBalanceWallet sx={{ fontSize: 32 }} />,
      gradient:
        (stats?.netSavings || 0) >= 0
          ? 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
          : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: 'Budget Left',
      value: formatCurrency(stats?.budgetLeft || 0),
      change: `${stats?.expenseCount || 0} expenses`,
      trend: (stats?.budgetLeft || 0) > 0 ? 'up' : 'down',
      icon: <LightbulbIcon sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: 'Avg Daily',
      value: formatCurrency(stats?.avgDailySpending || 0),
      change: 'This month',
      trend: 'up',
      icon: <TrendingDown sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
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
            Welcome back, {user?.firstName || user?.email || 'User'}! Here's your expense overview.
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={exportDashboardToCSV}
            disabled={!stats}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 2,
              py: 1.5,
            }}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/transactions')}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              py: 1.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            New Transaction
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/accounts')}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              py: 1.5,
            }}
          >
            Accounts
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/analytics')}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              py: 1.5,
            }}
          >
            Analytics
          </Button>
        </Box>
      </Box>

      {/* FilterBar Component */}
      <Box sx={{ mb: 3 }}>
        <FilterBar
          accounts={accounts}
          categories={categories}
          tags={tags}
          filters={filters}
          onFiltersChange={setFilters}
        />
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
            >
              {alert}
            </Alert>
          ))}
        </Box>
      )}

      {/* Smart Insights */}
      {smartInsights && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LightbulbIcon sx={{ fontSize: 28 }} />
                  <Typography variant="h6" fontWeight={700}>
                    Smart Insights
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  {/* Budget Health Score */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: 2,
                        p: 2,
                      }}
                    >
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        Budget Health Score
                      </Typography>
                      <Box display="flex" alignItems="baseline" gap={1}>
                        <Typography variant="h3" fontWeight={700}>
                          {Math.round(smartInsights.budgetHealthScore)}
                        </Typography>
                        <Typography variant="h6">/100</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ opacity: 0.8, mt: 1 }}>
                        {smartInsights.budgetHealthScore >= 80
                          ? 'Excellent budget management'
                          : smartInsights.budgetHealthScore >= 60
                          ? 'Good budget control'
                          : smartInsights.budgetHealthScore >= 40
                          ? 'Needs attention'
                          : 'Critical - Review budgets'}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Top Spending Category */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: 2,
                        p: 2,
                      }}
                    >
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        Top Spending Category
                      </Typography>
                      <Typography variant="h6" fontWeight={700} noWrap>
                        {smartInsights.highestCategory}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8, mt: 1 }}>
                        Largest expense driver
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Spending Pattern */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: 2,
                        p: 2,
                      }}
                    >
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        Spending Pattern
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        {smartInsights.unusualSpending ? (
                          <>
                            <WarningIcon />
                            <Typography variant="h6" fontWeight={700}>
                              Unusual
                            </Typography>
                          </>
                        ) : (
                          <>
                            <Typography variant="h6" fontWeight={700}>
                              Normal
                            </Typography>
                          </>
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ opacity: 0.8, mt: 1 }}>
                        {smartInsights.unusualSpending
                          ? 'Spending significantly differs'
                          : 'Consistent with previous period'}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Savings Trend */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: 2,
                        p: 2,
                      }}
                    >
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        Savings Trend
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        {smartInsights.savingsTrend === 'improving' ? (
                          <TrendingUp sx={{ fontSize: 28 }} />
                        ) : smartInsights.savingsTrend === 'declining' ? (
                          <TrendingDown sx={{ fontSize: 28 }} />
                        ) : null}
                        <Typography variant="h6" fontWeight={700}>
                          {smartInsights.savingsTrend === 'improving'
                            ? 'Improving'
                            : smartInsights.savingsTrend === 'declining'
                            ? 'Declining'
                            : 'Stable'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ opacity: 0.8, mt: 1 }}>
                        {smartInsights.savingsTrend === 'improving'
                          ? 'Great job saving money!'
                          : smartInsights.savingsTrend === 'declining'
                          ? 'Consider reducing expenses'
                          : 'Maintaining current level'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={4} lg={2.4} key={index}>
            <Card
              sx={{
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                background: (theme) =>
                  theme.palette.mode === 'light' ? 'white' : 'rgba(30, 30, 30, 0.8)',
                backdropFilter: 'blur(10px)',
                border: (theme) =>
                  theme.palette.mode === 'light'
                    ? '1px solid rgba(0,0,0,0.05)'
                    : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 12px 40px rgba(102, 126, 234, 0.3)',
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
                <Box sx={{ mb: 3 }}>
                  <Avatar
                    sx={{
                      background: stat.gradient,
                      width: 56,
                      height: 56,
                      boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                </Box>
                <Typography
                  variant="h4"
                  fontWeight={800}
                  sx={{
                    mb: 0.5,
                    letterSpacing: '-0.02em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={500}
                  sx={{
                    mb: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stat.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {stat.trend === 'up' ? (
                    <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                  ) : (
                    <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      color: stat.trend === 'up' ? 'success.main' : 'error.main',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  >
                    {stat.change}
                  </Typography>
                </Box>
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
                theme.palette.mode === 'light' ? 'white' : 'rgba(30, 30, 30, 0.8)',
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
              <AccountBalanceWallet color="primary" />
              <Typography variant="h5" fontWeight={700}>
                Account Balances
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your accounts overview
            </Typography>
            {accountBalances.length > 0 ? (
              <Box
                sx={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  pr: 1,
                  '&::-webkit-scrollbar': {
                    width: '6px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: (theme) =>
                      theme.palette.mode === 'light'
                        ? 'rgba(0,0,0,0.05)'
                        : 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: (theme) =>
                      theme.palette.mode === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    '&:hover': {
                      background: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'rgba(0,0,0,0.3)'
                          : 'rgba(255,255,255,0.3)',
                    },
                  },
                }}
              >
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {accountBalances.map((account) => {
                    const accountCurrency = account.currency || user?.currency || 'USD';
                    const formattedBalance = new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: accountCurrency,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(account.balance);

                    // Determine icon and color based on account type
                    const accountType = (account.accountType || 'wallet').toLowerCase();

                    let accountIcon = <AccountBalanceWallet />;
                    let accountGradient = 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';

                    if (accountType.includes('bank')) {
                      accountIcon = <AccountBalance />;
                      accountGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    } else if (accountType.includes('card') || accountType.includes('credit')) {
                      accountIcon = <CreditCard />;
                      accountGradient = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                    } else if (accountType.includes('saving')) {
                      accountIcon = <Savings />;
                      accountGradient = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
                    }

                    return (
                      <Grid item xs={12} key={account.id}>
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 3,
                            background: (theme) =>
                              theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)',
                            border: (theme) =>
                              theme.palette.mode === 'light'
                                ? '1px solid rgba(0,0,0,0.08)'
                                : '1px solid rgba(255,255,255,0.1)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
                            },
                          }}
                          onClick={() => navigate('/accounts')}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                              sx={{
                                width: 44,
                                height: 44,
                                background: accountGradient,
                                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                              }}
                            >
                              {accountIcon}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1.3,
                                }}
                              >
                                {account.name}
                              </Typography>
                            </Box>
                            <Typography
                              variant="h6"
                              fontWeight={700}
                              color={account.balance >= 0 ? 'success.main' : 'error.main'}
                              sx={{
                                fontSize: '1.1rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formattedBalance}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                  }}
                >
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="rgba(255,255,255,0.8)"
                        sx={{ mb: 0.5, fontWeight: 500 }}
                      >
                        Total Balance
                      </Typography>
                      <Typography variant="h4" fontWeight={700} color="white">
                        {formatCurrency(accountBalances.reduce((sum, acc) => sum + acc.balance, 0))}
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{
                        width: 56,
                        height: 56,
                        background: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <AccountBalanceWallet sx={{ fontSize: 28, color: 'white' }} />
                    </Avatar>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No accounts found</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/accounts')}
                  sx={{ mt: 2 }}
                >
                  Add Account
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
                theme.palette.mode === 'light' ? 'white' : 'rgba(30, 30, 30, 0.8)',
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
              Recent Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Latest activity
            </Typography>
            {recentTransactions.length > 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {recentTransactions.map((transaction) => (
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
                    onClick={() => navigate('/transactions')}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="body1" fontWeight={600} noWrap sx={{ maxWidth: '60%' }}>
                        {transaction.description}
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={700}
                        color={transaction.type === 'credit' ? 'success.main' : 'error.main'}
                      >
                        {transaction.type === 'credit' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
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
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(transaction.date)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No recent transactions</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/transactions')}
                  sx={{ mt: 2 }}
                >
                  Add Transaction
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Spending Trends & Category Breakdown */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Spending Trends Chart */}
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light' ? 'white' : 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(10px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? '1px solid rgba(0,0,0,0.05)'
                  : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Spending Trends
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Last 6 months overview
            </Typography>
            {spendingTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={spendingTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis dataKey="month" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.1)',
                      background: 'rgba(255,255,255,0.95)',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#f44336"
                    strokeWidth={3}
                    name="Expenses"
                    dot={{ fill: '#f44336', r: 6 }}
                    activeDot={{ r: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#4caf50"
                    strokeWidth={3}
                    name="Income"
                    dot={{ fill: '#4caf50', r: 6 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No spending data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Top Categories Pie Chart */}
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light' ? 'white' : 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(10px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? '1px solid rgba(0,0,0,0.05)'
                  : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Top Categories
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This month breakdown
            </Typography>
            {topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topCategories}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={false}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {topCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend
                    formatter={(_value, entry: any) => {
                      const name =
                        entry.payload.name.length > 15
                          ? entry.payload.name.substring(0, 15) + '...'
                          : entry.payload.name;
                      const percent = (
                        (entry.payload.value /
                          topCategories.reduce((sum, cat) => sum + cat.value, 0)) *
                        100
                      ).toFixed(0);
                      return `${name} ${percent}% (${formatCurrency(entry.payload.value)})`;
                    }}
                    wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
                    iconSize={12}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No category data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Budget Progress & Upcoming Recurring */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Budget Progress Bars */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light' ? 'white' : 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(10px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? '1px solid rgba(0,0,0,0.05)'
                  : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Budget Progress
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Current month status
            </Typography>
            {budgetStatus.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {budgetStatus.map((budget, idx) => (
                  <Box key={idx}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: budget.categoryColor,
                          }}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {budget.categoryName}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.budget)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(budget.percentage, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'rgba(0,0,0,0.05)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 1,
                          bgcolor: budget.isOver
                            ? '#f44336'
                            : budget.percentage > 80
                              ? '#ff9800'
                              : '#4caf50',
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      color={budget.isOver ? 'error' : 'text.secondary'}
                    >
                      {budget.percentage}% used
                      {budget.isOver && ' - Over budget!'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No budgets set</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/budgets')}
                  sx={{ mt: 2 }}
                >
                  Set Budget
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Upcoming Recurring Transactions */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light' ? 'white' : 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(10px)',
              border: (theme) =>
                theme.palette.mode === 'light'
                  ? '1px solid rgba(0,0,0,0.05)'
                  : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Receipt color="primary" />
              <Typography variant="h5" fontWeight={700}>
                Upcoming Recurring
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Next 30 days
            </Typography>
            {upcomingRecurring.length > 0 ? (
              <List sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {upcomingRecurring.map((txn) => (
                  <ListItem
                    key={txn.id}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      background: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'rgba(0,0,0,0.02)'
                          : 'rgba(255,255,255,0.05)',
                      '&:hover': {
                        background: (theme) =>
                          theme.palette.mode === 'light'
                            ? 'rgba(0,0,0,0.04)'
                            : 'rgba(255,255,255,0.08)',
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={600}>
                            {txn.description}
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color={txn.type === 'credit' ? 'success.main' : 'error.main'}
                          >
                            {txn.type === 'credit' ? '+' : '-'}
                            {formatCurrency(txn.amount)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mt={0.5}
                        >
                          <Chip
                            label={txn.frequency}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              textTransform: 'capitalize',
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(txn.nextDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box textAlign="center" py={6}>
                <Typography color="text.secondary">No upcoming recurring transactions</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/transactions')}
                  sx={{ mt: 2 }}
                >
                  Add Recurring
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
