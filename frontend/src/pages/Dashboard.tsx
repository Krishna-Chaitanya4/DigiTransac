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
  Alert,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Fade,
  Zoom,
  Skeleton,
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
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { ROUTE_PATHS } from '../config/routes.config';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { getTimeBasedGreeting, getTimeEmoji } from '../utils/greetings';
import PullToRefresh from '../components/PullToRefresh';
import { useTransactions, useCategories, useTags, useBudgets, useAccounts } from '../hooks/useApi';

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
  return (
    transaction.tags?.some((tag: string) => EXPENSE_EXCLUDE_TAGS.includes(tag.toLowerCase())) ||
    false
  );
};

const shouldExcludeFromIncome = (transaction: any): boolean => {
  // Check splits for excluding tags
  if (transaction.splits && transaction.splits.length > 0) {
    return transaction.splits.some((split: any) =>
      split.tags?.some((tag: string) => INCOME_EXCLUDE_TAGS.includes(tag.toLowerCase()))
    );
  }
  // Fallback to transaction-level tags
  return (
    transaction.tags?.some((tag: string) => INCOME_EXCLUDE_TAGS.includes(tag.toLowerCase())) ||
    false
  );
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
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // React Query hooks for data fetching
  const { data: categoriesData } = useCategories();
  const { data: tagsData } = useTags();
  const { data: budgetsData } = useBudgets();
  const { data: accountsData } = useAccounts();
  
  const categories = categoriesData?.data?.categories || [];
  const tags = tagsData?.data?.tags || [];

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

  // Fetch transactions with filters
  const startDate = filters.dateRange.start.startOf('day').toISOString();
  const endDate = filters.dateRange.end.endOf('day').toISOString();
  const { data: transactionsData, isLoading: loading } = useTransactions({
    startDate,
    endDate,
    reviewStatus: 'approved',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const transactions = transactionsData?.data?.transactions || [];

  // Fetch previous period transactions for comparison
  const currentStart = filters.dateRange.start.toDate();
  const currentEnd = filters.dateRange.end.toDate();
  const periodDuration = currentEnd.getTime() - currentStart.getTime();
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodDuration);

  const { data: prevTransactionsData } = useTransactions({
    startDate: prevStart.toISOString(),
    endDate: prevEnd.toISOString(),
    reviewStatus: 'approved',
  });

  const { data: recurringData } = useTransactions({ isRecurring: 'true' });

  useEffect(() => {
    // Load dismissed alerts from localStorage
    const dismissed = localStorage.getItem('dismissedAlerts');
    if (dismissed) {
      try {
        setDismissedAlerts(new Set(JSON.parse(dismissed)));
      } catch (e) {
        console.error('Failed to load dismissed alerts:', e);
      }
    }
  }, []);

  const handleDismissAlert = useCallback(
    (alert: string) => {
      const newDismissed = new Set(dismissedAlerts);
      newDismissed.add(alert);
      setDismissedAlerts(newDismissed);
      // Save to localStorage
      localStorage.setItem('dismissedAlerts', JSON.stringify(Array.from(newDismissed)));
    },
    [dismissedAlerts]
  );

  const calculateDashboardData = useCallback(async () => {
    try {
      // Apply client-side filtering for categories and tags
      let filteredTransactions = transactions.filter((t: any) => {
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
      const debits = filteredTransactions.filter(
        (t: any) => t.type === 'debit' && !shouldExcludeFromExpenses(t)
      );
      const credits = filteredTransactions.filter(
        (t: any) => t.type === 'credit' && !shouldExcludeFromIncome(t)
      );
      const totalSpent = debits.reduce((sum: number, t: any) => sum + t.amount, 0);
      const totalIncome = credits.reduce((sum: number, t: any) => sum + t.amount, 0);
      const netSavings = totalIncome - totalSpent;

      // Calculate percentage changes using previous period data
      let prevTransactions = prevTransactionsData?.data?.transactions || [];
      
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
        filteredTransactions.slice(0, 5).map((txn: any) => {
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

      // Process account balances
      const accounts = accountsData?.data?.accounts || [];
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
      const budgets = budgetsData?.data?.budgets || [];
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
      const budgetLeft = budgets.length > 0 ? totalBudget - totalSpent : 0;
      setStats((prev) => (prev ? { ...prev, budgetLeft } : null));

      setBudgetStatus(budgetStatuses.sort((a, b) => b.percentage - a.percentage).slice(0, 5));

      // Get upcoming recurring transactions
      const recurringTxns = recurringData?.data?.transactions || [];
      const now = new Date();
      const upcoming: UpcomingRecurring[] = recurringTxns
        .map((t: any) => {
          if (!t.recurrencePattern) return null;

          const lastCreated = t.recurrencePattern.lastCreated
            ? new Date(t.recurrencePattern.lastCreated)
            : new Date(t.date);
          const nextDate = new Date(lastCreated);

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
          `Spending exceeds income by ${formatCurrencyUtil(Math.abs(netSavings), user?.currency || 'USD', true, 0)} this month`
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
      const topCategory = Array.from(categorySpending.values()).sort(
        (a, b) => b.amount - a.amount
      )[0];

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
      console.error('Dashboard calculation error:', err);
      setError('Failed to calculate dashboard data');
    }
  }, [transactions, categories, tags, budgetsData, accountsData, prevTransactionsData, recurringData, filters, user?.currency, periodDuration]);

  // Trigger calculation when data changes
  useEffect(() => {
    if (transactionsData && categoriesData && accountsData) {
      calculateDashboardData();
    }
  }, [transactionsData, categoriesData, tagsData, budgetsData, accountsData, prevTransactionsData, recurringData, calculateDashboardData]);

  const formatCurrency = useCallback(
    (amount: number) => {
      return formatCurrencyUtil(amount, user?.currency || 'USD', true, 0);
    },
    [user?.currency]
  );

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
      <Box>
        {/* Animated Header Skeleton */}
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width="60%" height={60} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="40%" height={30} />
        </Box>

        {/* Stats Cards Skeleton */}
        <Grid container spacing={3} mb={3}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Grid size={{ sm: 6, xs: 12, md: 4 }} key={i}>
              <Skeleton
                variant="rectangular"
                height={180}
                sx={{ borderRadius: 3 }}
                animation="wave"
              />
            </Grid>
          ))}
        </Grid>

        {/* Content Skeleton */}
        <Grid container spacing={3}>
          <Grid size={{ md: 7, xs: 12 }}>
            <Skeleton
              variant="rectangular"
              height={450}
              sx={{ borderRadius: 3 }}
              animation="wave"
            />
          </Grid>
          <Grid size={{ md: 5, xs: 12 }}>
            <Skeleton
              variant="rectangular"
              height={450}
              sx={{ borderRadius: 3 }}
              animation="wave"
            />
          </Grid>
        </Grid>
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
      {/* Animated Gradient Header */}
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
              background:
                'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)',
              animation: 'pulse 4s ease-in-out infinite',
            },
            '@keyframes pulse': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 250 }}>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  gutterBottom
                  sx={{
                    letterSpacing: '-0.02em',
                    color: 'white',
                    textShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  }}
                >
                  {getTimeBasedGreeting()}, {user?.fullName || user?.username || 'User'}!{' '}
                  {getTimeEmoji()}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: 'rgba(255,255,255,0.95)',
                    fontWeight: 500,
                    mt: 1,
                    textShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                >
                  {budgetStatus.length > 0 && budgetStatus.some((b) => b.percentage >= 90)
                    ? `⚠️ ${budgetStatus.filter((b) => b.percentage >= 90).length} budget${budgetStatus.filter((b) => b.percentage >= 90).length > 1 ? 's' : ''} approaching limit`
                    : (stats?.netSavings || 0) >= 0
                      ? `🎉 You're ${formatCurrency(Math.abs(stats?.netSavings || 0))} in savings this month`
                      : `Spending ${formatCurrency(Math.abs(stats?.netSavings || 0))} more than income this month`}
                </Typography>
              </Box>
              <Zoom in timeout={800}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS)}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    px: 4,
                    py: 1.5,
                    bgcolor: 'white',
                    color: 'primary.main',
                    fontWeight: 700,
                    fontSize: '1rem',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      bgcolor: 'rgba(255,255,255,0.95)',
                    },
                  }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    New Transaction
                  </Box>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                    New
                  </Box>
                </Button>
              </Zoom>
            </Box>
          </Box>
        </Box>
      </Fade>

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
          <Grid size={{ sm: 6, xs: 12, md: 4 }} key={index}>
            <Zoom in timeout={400 + index * 100}>
              <Card
                sx={{
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 3,
                  background: (theme) =>
                    theme.palette.mode === 'light'
                      ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                      : 'linear-gradient(135deg, rgba(30, 30, 30, 0.9) 0%, rgba(20, 20, 20, 0.9) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: (theme) =>
                    theme.palette.mode === 'light'
                      ? `1px solid ${theme.palette.primary.main}1A`
                      : `1px solid ${theme.palette.primary.main}33`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-12px)',
                    boxShadow: (theme) => `0 20px 40px ${theme.palette.primary.main}33`,
                    border: (theme) =>
                      theme.palette.mode === 'light'
                        ? `1px solid ${theme.palette.primary.main}4D`
                        : `1px solid ${theme.palette.primary.main}66`,
                    '& .stat-icon': {
                      transform: 'scale(1.1) rotate(5deg)',
                    },
                    '& .stat-value': {
                      transform: 'scale(1.02)',
                    },
                    '&::before': {
                      opacity: 1,
                    },
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: stat.gradient,
                    opacity: 0.8,
                    transition: 'opacity 0.4s ease',
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '60px',
                    height: '60px',
                    background: stat.gradient,
                    opacity: 0.05,
                    borderRadius: '0 0 0 100%',
                  },
                }}
              >
                <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ mb: 3 }}>
                    <Avatar
                      className="stat-icon"
                      sx={{
                        background: stat.gradient,
                        width: 60,
                        height: 60,
                        boxShadow: (theme) => `0 8px 16px ${theme.palette.primary.main}4D`,
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {stat.icon}
                    </Avatar>
                  </Box>
                  <Typography
                    className="stat-value"
                    variant="h4"
                    fontWeight={800}
                    sx={{
                      mb: 0.5,
                      letterSpacing: '-0.02em',
                      background: stat.gradient,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'transform 0.4s ease',
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight={600}
                    sx={{
                      mb: 1.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {stat.title}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: (theme) =>
                        theme.palette.mode === 'light'
                          ? stat.trend === 'up'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)'
                          : stat.trend === 'up'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    {stat.trend === 'up' ? (
                      <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                    ) : (
                      <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                    )}
                    <Typography
                      variant="caption"
                      sx={{
                        color: stat.trend === 'up' ? 'success.main' : 'error.main',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }}
                    >
                      {stat.change}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>
        ))}
      </Grid>

      {/* Budget Status & Recent Activity */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid size={{ md: 5, xs: 12 }}>
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
                      <Grid size={{ xs: 12 }} key={account.id}>
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
                          onClick={() => navigate(ROUTE_PATHS.ACCOUNTS)}
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
                    background: (theme) => theme.palette.gradient.primary,
                    boxShadow: '0 8px 24px rgba(20, 184, 166, 0.4)',
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
                  onClick={() => navigate(ROUTE_PATHS.ACCOUNTS)}
                  sx={{ mt: 2 }}
                >
                  Add Account
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid size={{ md: 7, xs: 12 }}>
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
                    onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS)}
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
                  onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS)}
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
        <Grid size={{ md: 6, xs: 12 }}>
          <Paper
            sx={{
              p: 4,
              borderRadius: 4,
              background: (theme) =>
                theme.palette.mode === 'light'
                  ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 50%, ${theme.palette.primary.dark} 100%)`
                  : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.dark} 50%, ${theme.palette.primary.dark} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: (theme) => `0 8px 32px ${theme.palette.primary.main}4D`,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: (theme) => `0 12px 40px ${theme.palette.primary.main}66`,
              },
            }}
          >
            {/* Animated background elements */}
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                animation: 'pulse 4s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 0.5, transform: 'scale(1)' },
                  '50%': { opacity: 1, transform: 'scale(1.1)' },
                },
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: -30,
                left: -30,
                width: 150,
                height: 150,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              }}
            />

            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                <Avatar
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)',
                    width: 48,
                    height: 48,
                  }}
                >
                  <TrendingUp sx={{ fontSize: 28 }} />
                </Avatar>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  sx={{ textShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                >
                  Financial Health Score
                </Typography>
              </Box>
              <Box display="flex" alignItems="baseline" gap={2} mb={4}>
                <Typography
                  variant="h1"
                  fontWeight={800}
                  sx={{
                    fontSize: { xs: '3.5rem', sm: '4rem' },
                    textShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}
                >
                  {smartInsights?.budgetHealthScore || 0}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 600 }}>
                  / 100
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.85,
                      mb: 1,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem',
                    }}
                  >
                    Top Spending
                  </Typography>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1.5}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: 'white',
                        boxShadow: '0 0 8px rgba(255,255,255,0.8)',
                      }}
                    />
                    <Typography variant="body1" fontWeight={700}>
                      {smartInsights?.highestCategory.name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, ml: 'auto', fontWeight: 600 }}>
                      {formatCurrency(smartInsights?.highestCategory.amount || 0)}
                    </Typography>
                  </Box>
                </Box>
                {smartInsights?.savingsTrend && (
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{
                        opacity: 0.85,
                        mb: 1,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontSize: '0.7rem',
                      }}
                    >
                      Savings Trend
                    </Typography>
                    <Box
                      display="flex"
                      alignItems="center"
                      gap={1.5}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      {smartInsights.savingsTrend === 'improving' ? (
                        <TrendingUp fontSize="small" sx={{ fontWeight: 'bold' }} />
                      ) : smartInsights.savingsTrend === 'declining' ? (
                        <TrendingDown fontSize="small" sx={{ fontWeight: 'bold' }} />
                      ) : (
                        <Remove fontSize="small" sx={{ fontWeight: 'bold' }} />
                      )}
                      <Typography
                        variant="body1"
                        fontWeight={700}
                        sx={{ textTransform: 'capitalize' }}
                      >
                        {smartInsights.savingsTrend}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid size={{ md: 6, xs: 12 }}>
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
                onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS)}
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
                onClick={() => navigate(ROUTE_PATHS.ANALYTICS)}
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
                onClick={() => navigate(ROUTE_PATHS.BUDGETS)}
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
                onClick={() => navigate(ROUTE_PATHS.ACCOUNTS)}
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
        <Grid size={{ md: 6, xs: 12 }}>
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
                  onClick={() => navigate(ROUTE_PATHS.BUDGETS)}
                  sx={{ mt: 2 }}
                >
                  Set Budget
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Upcoming Recurring Transactions */}
        <Grid size={{ md: 6, xs: 12 }}>
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
                  onClick={() => navigate(ROUTE_PATHS.TRANSACTIONS)}
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
      <PullToRefresh onRefresh={calculateDashboardData}>{content}</PullToRefresh>
    </Box>
  );
};

export default Dashboard;
