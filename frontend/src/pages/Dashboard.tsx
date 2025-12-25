import React, { useState, useEffect, useCallback } from 'react';
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
  AccountBalance,
  CreditCard,
  Savings,
  Assessment,
  Remove,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import PullToRefresh from '../components/PullToRefresh';

// Smart tag filtering: exclude these tags from expense/income calculations
const EXPENSE_EXCLUDE_TAGS = ['investment', 'transfer', 'savings', 'loan', 'refund'];
const INCOME_EXCLUDE_TAGS = ['transfer', 'refund'];

// Helper function to check if transaction should be excluded from calculations
const shouldExcludeFromExpenses = (transaction: any): boolean => {
  // Check splits for excluding tags
  if (transaction.splits && transaction.splits.length > 0) {
    return transaction.splits.some((split: any) =>
      split.tags?.some((tag: string) => EXPENSE_EXCLUDE_TAGS.includes(tag.toLowerCase()))
    );
  }
  // Fallback to transaction-level tags
  return transaction.tags?.some((tag: string) => EXPENSE_EXCLUDE_TAGS.includes(tag.toLowerCase())) || false;
};

const shouldExcludeFromIncome = (transaction: any): boolean => {
  // Check splits for excluding tags
  if (transaction.splits && transaction.splits.length > 0) {
    return transaction.splits.some((split: any) =>
      split.tags?.some((tag: string) => INCOME_EXCLUDE_TAGS.includes(tag.toLowerCase()))
    );
  }
  // Fallback to transaction-level tags
  return transaction.tags?.some((tag: string) => INCOME_EXCLUDE_TAGS.includes(tag.toLowerCase())) || false;
};

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
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [upcomingRecurring, setUpcomingRecurring] = useState<UpcomingRecurring[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [smartInsights, setSmartInsights] = useState<{
    highestCategory: { name: string; amount: number };
    unusualSpending: boolean;
    savingsTrend: 'improving' | 'declining' | 'stable';
    budgetHealthScore: number;
  } | null>(null);

  // Filter states - Dashboard is locked to "This Month"
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // Dashboard always shows "This Month" - no user filtering
  const filters = {
    dateRange: {
      start: dayjs().startOf('month'),
      end: dayjs().endOf('month'),
      preset: 'thisMonth',
    },
    accounts: [] as string[],
    categories: [] as string[],
    includeTags: [] as string[],
    excludeTags: [] as string[],
    transactionType: 'all' as const,
  };

  useEffect(() => {
    fetchInitialData();
    // Load dismissed alerts from localStorage
    const dismissed = localStorage.getItem('dismissedAlerts');
    if (dismissed) {
      try {
        setDismissedAlerts(new Set(JSON.parse(dismissed)));
      } catch (e) {
        console.error('Failed to load dismissed alerts:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only fetch dashboard data once initial data is loaded
    // Dashboard is locked to "This Month" - no filter dependencies needed
    if (initialDataLoaded) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataLoaded]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [, categoriesRes, tagsRes] = await Promise.all([
        axios.get('/api/accounts', { headers: { Authorization: `Bearer ${token}` } }), // Still fetch but don't store
        axios.get('/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/tags', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      // We don't store accounts in state anymore since we removed filtering
      setCategories(categoriesRes.data.categories || []);
      setTags(tagsRes.data.tags || []);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
      // Set empty arrays on error to unblock dashboard loading
      setCategories([]);
      setTags([]);
    } finally {
      setInitialDataLoaded(true);
    }
  }, [token]);

  const handleDismissAlert = useCallback((alert: string) => {
    const newDismissed = new Set(dismissedAlerts);
    newDismissed.add(alert);
    setDismissedAlerts(newDismissed);
    // Save to localStorage
    localStorage.setItem('dismissedAlerts', JSON.stringify(Array.from(newDismissed)));
  }, [dismissedAlerts]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Ensure start date includes beginning of day and end date includes end of day
      const startDate = filters.dateRange.start.startOf('day').toISOString();
      const endDate = filters.dateRange.end.endOf('day').toISOString();
      
      // Build query params for transactions API
      // Only fetch approved transactions for accurate financial calculations
      const txnParams = new URLSearchParams({
        startDate,
        endDate,
        reviewStatus: 'approved',
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
        
        // Filter by tags (include/exclude logic)
        if (filters.includeTags.length > 0) {
          const txnTags = t.tags || [];
          const hasIncludedTag = txnTags.some((tag: string) => filters.includeTags.includes(tag));
          if (!hasIncludedTag) return false;
        }
        
        if (filters.excludeTags.length > 0) {
          const txnTags = t.tags || [];
          const hasExcludedTag = txnTags.some((tag: string) => filters.excludeTags.includes(tag));
          if (hasExcludedTag) return false;
        }
        
        return true;
      });

      // Filter debits and credits with smart tag exclusion
      const debits = transactions.filter((t: any) => t.type === 'debit' && !shouldExcludeFromExpenses(t));
      const credits = transactions.filter((t: any) => t.type === 'credit' && !shouldExcludeFromIncome(t));
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
        reviewStatus: 'approved',
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
        if (filters.includeTags.length > 0) {
          const txnTags = t.tags || [];
          const hasIncludedTag = txnTags.some((tag: string) => filters.includeTags.includes(tag));
          if (!hasIncludedTag) return false;
        }
        if (filters.excludeTags.length > 0) {
          const txnTags = t.tags || [];
          const hasExcludedTag = txnTags.some((tag: string) => filters.excludeTags.includes(tag));
          if (hasExcludedTag) return false;
        }
        return true;
      });

      const prevSpent = prevTransactions
        .filter((t: any) => t.type === 'debit' && !shouldExcludeFromExpenses(t))
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      const prevIncome = prevTransactions
        .filter((t: any) => t.type === 'credit' && !shouldExcludeFromIncome(t))
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

      // Process account balances first (needed for budget display)
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

      // Process budget status
      const budgets = budgetsRes.data.budgets || [];
      const budgetStatuses: BudgetStatus[] = [];
      let totalBudget = 0;

      for (const budget of budgets) {
        // Use effective budget (includes rollover)
        const effectiveBudget = budget.amount + (budget.rolledOverAmount || 0);
        totalBudget += effectiveBudget;
        
        // Use spent amount calculated by backend (handles all budget types correctly)
        const spent = budget.spent || 0;
        const percentage = Math.round((spent / effectiveBudget) * 100);

        // Get display name based on budget type
        let displayName = 'Unknown';
        let displayColor = '#667eea';
        
        if (budget.scopeType === 'category' && budget.categoryId) {
          const category = categoryMap.get(budget.categoryId);
          displayName = category?.name || 'Unknown Category';
          displayColor = category?.color || '#667eea';
        } else if (budget.scopeType === 'tag') {
          // For tag budgets, show tag names
          const includeTagNames = (budget.includeTagIds || [])
            .map((id: string) => {
              const tag = tags.find((t: any) => t.id === id);
              return tag?.name || id;
            })
            .join(', ');
          const excludeTagNames = (budget.excludeTagIds || [])
            .map((id: string) => {
              const tag = tags.find((t: any) => t.id === id);
              return tag?.name || id;
            })
            .join(', ');
          
          if (includeTagNames && excludeTagNames) {
            displayName = `${includeTagNames} (excl: ${excludeTagNames})`;
          } else if (includeTagNames) {
            displayName = includeTagNames;
          } else {
            displayName = `Excl: ${excludeTagNames}`;
          }
          displayColor = '#ff6b6b';
        } else if (budget.scopeType === 'account' && budget.accountId) {
          const account = accounts.find((a: any) => a.id === budget.accountId);
          displayName = account?.name || 'Unknown Account';
          displayColor = account?.color || '#4caf50';
        }

        budgetStatuses.push({
          categoryName: displayName,
          categoryId: budget.categoryId || budget.accountId || 'tag-budget',
          categoryColor: displayColor,
          spent,
          budget: effectiveBudget,
          percentage,
          isOver: spent > effectiveBudget,
        });
      }
      
      // Update budget left in stats
      // Only calculate budget left if there are budgets configured
      const budgetLeft = budgets.length > 0 ? totalBudget - totalSpent : 0;
      setStats(prev => prev ? { ...prev, budgetLeft } : null);

      setBudgetStatus(budgetStatuses.sort((a, b) => b.percentage - a.percentage).slice(0, 5));

      // Calculate spending trends (last 6 months)
      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Set to start and end of day for inclusive date range
      sixMonthsAgo.setHours(0, 0, 0, 0);
      now.setHours(23, 59, 59, 999);
      
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
        if (filters.includeTags.length > 0) {
          const txnTags = t.tags || [];
          const hasIncludedTag = txnTags.some((tag: string) => filters.includeTags.includes(tag));
          if (!hasIncludedTag) return false;
        }
        if (filters.excludeTags.length > 0) {
          const txnTags = t.tags || [];
          const hasExcludedTag = txnTags.some((tag: string) => filters.excludeTags.includes(tag));
          if (hasExcludedTag) return false;
        }
        return true;
      });

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

      // Calculate top category for insights
      const categorySpending = new Map<string, { name: string; amount: number }>();
      debits.forEach((t: any) => {
        const category = categoryMap.get(t.categoryId);
        if (category) {
          const existing = categorySpending.get(t.categoryId);
          categorySpending.set(t.categoryId, {
            name: category.name,
            amount: (existing?.amount || 0) + t.amount,
          });
        }
      });
      const topCategory = Array.from(categorySpending.values())
        .sort((a, b) => b.amount - a.amount)[0];

      // Generate Smart Insights
      const insights = {
        highestCategory: {
          name: topCategory?.name || 'N/A',
          amount: topCategory?.amount || 0,
        },
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

  const formatCurrency = useCallback((amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'USD', true, 0);
  }, [user?.currency]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    const daysAgo = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) return `${daysAgo} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

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
      gradient: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
    },
    {
      title: 'Month Income',
      value: formatCurrency(stats?.monthIncome || 0),
      change: `${(stats?.incomePercentChange ?? 0) >= 0 ? '+' : ''}${stats?.incomePercentChange ?? 0}% vs last month`,
      trend: (stats?.incomePercentChange || 0) >= 0 ? 'up' : 'down',
      icon: <TrendingUp sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    },
    {
      title: 'Net Savings',
      value: formatCurrency(stats?.netSavings || 0),
      change: (stats?.netSavings || 0) >= 0 ? 'Positive flow' : 'Negative flow',
      trend: (stats?.netSavings || 0) >= 0 ? 'up' : 'down',
      icon: <AccountBalanceWallet sx={{ fontSize: 32 }} />,
      gradient:
        (stats?.netSavings || 0) >= 0
          ? 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)'
          : 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
    },
    {
      title: 'Budget Left',
      value: budgetStatus.length === 0 ? 'No budgets' : formatCurrency(stats?.budgetLeft || 0),
      change: budgetStatus.length === 0 ? 'Create budgets' : `${stats?.expenseCount || 0} expenses`,
      trend: (stats?.budgetLeft || 0) > 0 ? 'up' : 'down',
      icon: <Savings sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
    },
    {
      title: 'Avg Daily',
      value: formatCurrency(stats?.avgDailySpending || 0),
      change: 'This month',
      trend: 'up',
      icon: <Assessment sx={{ fontSize: 32 }} />,
      gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
    },
  ];

  const content = (
    <>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography 
            variant="h3" 
            fontWeight={800} 
            gutterBottom 
            sx={{ 
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
            Welcome back, {user?.firstName || user?.email || 'User'}! Here's your expense overview.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/transactions')}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            px: 3,
            py: 1.5,
            background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
            boxShadow: '0 4px 14px rgba(20, 184, 166, 0.4)',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(20, 184, 166, 0.6)',
              background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
            },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>New Transaction</Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>New</Box>
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
          {alerts
            .filter((alert) => !dismissedAlerts.has(alert))
            .map((alert, idx) => (
              <Alert
                key={idx}
                severity="warning"
                icon={<WarningIcon />}
                onClose={() => handleDismissAlert(alert)}
                sx={{ mb: 1, borderRadius: 2 }}
              >
                {alert}
              </Alert>
            ))}
        </Box>
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
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px) scale(1.02)',
                  boxShadow: '0 16px 48px rgba(20, 184, 166, 0.25)',
                  '& .stat-icon': {
                    transform: 'scale(1.1) rotate(5deg)',
                  },
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
                    className="stat-icon"
                    sx={{
                      background: stat.gradient,
                      width: 56,
                      height: 56,
                      boxShadow: '0 4px 14px rgba(20, 184, 166, 0.4)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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

      {/* Financial Health Score & Quick Actions */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Financial Health Score */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(135deg, #434343 0%, #000000 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <TrendingUp sx={{ fontSize: 28 }} />
                <Typography variant="h5" fontWeight={700}>
                  Financial Health Score
                </Typography>
              </Box>
              <Box display="flex" alignItems="baseline" gap={2} mb={3}>
                <Typography variant="h1" fontWeight={800}>
                  {smartInsights?.budgetHealthScore || 0}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  / 100
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                    Top Spending
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'rgba(255,255,255,0.8)',
                      }}
                    />
                    <Typography variant="body1" fontWeight={600}>
                      {smartInsights?.highestCategory.name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8, ml: 'auto' }}>
                      {formatCurrency(smartInsights?.highestCategory.amount || 0)}
                    </Typography>
                  </Box>
                </Box>
                {smartInsights?.savingsTrend && (
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Savings Trend
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {smartInsights.savingsTrend === 'improving' ? (
                        <TrendingUp fontSize="small" />
                      ) : smartInsights.savingsTrend === 'declining' ? (
                        <TrendingDown fontSize="small" />
                      ) : (
                        <Remove fontSize="small" />
                      )}
                      <Typography variant="body1" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                        {smartInsights.savingsTrend}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
              }}
            />
          </Paper>
        </Grid>

        {/* Quick Actions */}
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
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Common tasks at your fingertips
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => navigate('/transactions')}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                Add Transaction
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Assessment />}
                onClick={() => navigate('/analytics')}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                View Analytics
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Receipt />}
                onClick={() => navigate('/budgets')}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Manage Budgets
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<AccountBalance />}
                onClick={() => navigate('/accounts')}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                View Accounts
              </Button>
            </Box>
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
    </>
  );

  return (
    <Box>
      <PullToRefresh onRefresh={fetchDashboardData}>
        {content}
      </PullToRefresh>
    </Box>
  );
};

export default Dashboard;
