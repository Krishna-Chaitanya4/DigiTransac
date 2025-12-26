import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  LinearProgress,
  InputAdornment,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  Fade,
  Zoom,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Label as LabelIcon,
  AccountBalance as AccountIcon,
  Savings as SavingsIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { useToast } from '../components/Toast';
import QuickAddFab from '../components/QuickAddFab';
import ConfirmDialog from '../components/ConfirmDialog';
import { BudgetCardSkeleton } from '../components/Skeletons';
import ResponsiveDialog from '../components/ResponsiveDialog';

interface Category {
  id: string;
  name: string;
  isFolder: boolean;
  color?: string;
  path: string[];
}

interface Tag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  color?: string;
}

interface Budget {
  id: string;
  userId: string;
  name?: string;
  
  // Scope configuration (multi-select with AND logic between types, OR within)
  categoryIds?: string[]; // Track these categories (OR logic)
  includeTagIds?: string[]; // Must have at least one of these tags (OR logic)
  excludeTagIds?: string[]; // Must NOT have any of these tags (OR logic)
  accountIds?: string[]; // Track these accounts (OR logic)
  
  // Calculation type
  calculationType: 'debit' | 'net';
  
  amount: number;
  period: 'this-month' | 'next-month' | 'this-year' | 'custom';
  startDate: string;
  endDate?: string;
  alertThreshold: number;
  alertThresholds?: number[];
  notificationChannels?: ('in-app' | 'email')[];
  
  // Rollover
  enableRollover?: boolean;
  rolloverLimit?: number;
  rolledOverAmount?: number;
  
  // Display fields (calculated)
  spent?: number;
  remaining?: number;
  percentUsed?: number;
  isOverBudget?: boolean;
  
  createdAt: string;
  updatedAt: string;
}

const Budgets: React.FC = () => {
  const { token, user } = useAuth();
  const toast = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; budgetId: string | null }>({
    open: false,
    budgetId: null,
  });
  const [dateError, setDateError] = useState<string>('');
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'healthy' | 'warning' | 'exceeded'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'amount' | 'percentUsed' | 'remaining'>('percentUsed');
  
  // Inline editing state
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState<string>('');
  
  // Template dialog state
  const [showTemplates, setShowTemplates] = useState(false);

  // Budget Templates (industry-standard categories)
  const budgetTemplates = useMemo(() => [
    {
      id: 'groceries',
      name: '🛒 Groceries',
      description: 'Food and household essentials',
      amount: 10000,
      calculationType: 'debit' as const,
      icon: '🛒',
    },
    {
      id: 'dining',
      name: '🍽️ Dining Out',
      description: 'Restaurants and food delivery',
      amount: 5000,
      calculationType: 'debit' as const,
      icon: '🍽️',
    },
    {
      id: 'transportation',
      name: '🚗 Transportation',
      description: 'Fuel, parking, and commute',
      amount: 8000,
      calculationType: 'net' as const,
      icon: '🚗',
    },
    {
      id: 'entertainment',
      name: '🎬 Entertainment',
      description: 'Movies, games, and fun',
      amount: 3000,
      calculationType: 'debit' as const,
      icon: '🎬',
    },
    {
      id: 'shopping',
      name: '🛍️ Shopping',
      description: 'Clothes, accessories, and more',
      amount: 7000,
      calculationType: 'net' as const,
      icon: '🛍️',
    },
    {
      id: 'healthcare',
      name: '⚕️ Healthcare',
      description: 'Medical expenses and pharmacy',
      amount: 5000,
      calculationType: 'debit' as const,
      icon: '⚕️',
    },
    {
      id: 'utilities',
      name: '💡 Utilities',
      description: 'Electricity, water, internet',
      amount: 4000,
      calculationType: 'debit' as const,
      icon: '💡',
    },
    {
      id: 'subscriptions',
      name: '📱 Subscriptions',
      description: 'Netflix, Spotify, apps, etc.',
      amount: 2000,
      calculationType: 'debit' as const,
      icon: '📱',
    },
    {
      id: 'personal',
      name: '💆 Personal Care',
      description: 'Salon, spa, grooming',
      amount: 3000,
      calculationType: 'debit' as const,
      icon: '💆',
    },
    {
      id: 'education',
      name: '📚 Education',
      description: 'Courses, books, learning',
      amount: 5000,
      calculationType: 'debit' as const,
      icon: '📚',
    },
  ], []);

  const [formData, setFormData] = useState({
    name: '',
    categoryIds: [] as string[],
    includeTagIds: [] as string[],
    excludeTagIds: [] as string[],
    accountIds: [] as string[],
    calculationType: 'debit' as 'debit' | 'net',
    amount: '',
    period: 'this-month' as 'this-month' | 'next-month' | 'this-year' | 'custom',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    alertThreshold: '80',
    enableRollover: false,
    rolloverLimit: '',
  });

  useEffect(() => {
    // Parallelize all API calls for faster initial load
    Promise.all([
      fetchBudgets(),
      fetchCategories(),
      fetchTags(),
      fetchAccounts(),
    ]);
  }, []);

  // Memoized utility functions for date calculations (performance optimization)
  const getMonthDateRange = useCallback(() => {
    const now = new Date();
    // Set to first day of current month at 00:00:00
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    // Set to last day of current month at 23:59:59
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, []);

  const getNextMonthDateRange = useCallback(() => {
    const now = new Date();
    // Set to first day of next month
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    // Set to last day of next month
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, []);

  const getYearDateRange = useCallback(() => {
    const now = new Date();
    // Jan 1 at 00:00:00
    const start = new Date(now.getFullYear(), 0, 1);
    // Dec 31 at 23:59:59
    const end = new Date(now.getFullYear(), 11, 31);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, []);

  // Track if dates were manually edited (to avoid infinite loops)
  const [isManualDateEdit, setIsManualDateEdit] = React.useState(false);

  // Auto-update dates when period changes (performance optimized with useEffect)
  useEffect(() => {
    if (!openDialog || isManualDateEdit) return; // Skip if manual edit in progress

    if (formData.period === 'this-month') {
      const { startDate, endDate } = getMonthDateRange();
      setFormData(prev => ({ ...prev, startDate, endDate }));
      setDateError('');
    } else if (formData.period === 'next-month') {
      const { startDate, endDate } = getNextMonthDateRange();
      setFormData(prev => ({ ...prev, startDate, endDate }));
      setDateError('');
    } else if (formData.period === 'this-year') {
      const { startDate, endDate } = getYearDateRange();
      setFormData(prev => ({ ...prev, startDate, endDate }));
      setDateError('');
    }
    // For 'custom' period, keep user-selected dates
    
    // Reset manual edit flag after period change
    if (isManualDateEdit) {
      setIsManualDateEdit(false);
    }
  }, [formData.period, openDialog, getMonthDateRange, getNextMonthDateRange, getYearDateRange, isManualDateEdit]);

  // Real-time date validation (memoized for performance)
  const validateDates = useCallback((start: string, end: string) => {
    if (!start || !end) {
      setDateError('Both start and end dates are required');
      return false;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setDateError('Invalid date format');
      return false;
    }

    if (startDate >= endDate) {
      setDateError('End date must be after start date');
      return false;
    }

    setDateError('');
    return true;
  }, []);

  // Trigger validation whenever dates change
  useEffect(() => {
    if (openDialog && formData.startDate && formData.endDate) {
      validateDates(formData.startDate, formData.endDate);
    }
  }, [formData.startDate, formData.endDate, openDialog, validateDates]);

  // Handle manual date edits - auto-switch to custom period
  const handleStartDateChange = useCallback((newStartDate: string) => {
    setIsManualDateEdit(true);
    setFormData(prev => ({
      ...prev,
      startDate: newStartDate,
      period: prev.period !== 'custom' ? 'custom' : prev.period, // Auto-switch to custom
    }));
  }, []);

  const handleEndDateChange = useCallback((newEndDate: string) => {
    setIsManualDateEdit(true);
    setFormData(prev => ({
      ...prev,
      endDate: newEndDate,
      period: prev.period !== 'custom' ? 'custom' : prev.period, // Auto-switch to custom
    }));
  }, []);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/budgets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBudgets(response.data.budgets || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch budgets');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Normalize data: ensure all categories have required fields
      const normalizedCategories = (response.data.categories || []).map((cat: any) => ({
        ...cat,
        path: cat.path || [], // Ensure path is always an array
      }));
      
      setCategories(normalizedCategories);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await axios.get(`/api/tags`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTags(response.data.tags || []);
    } catch (err: any) {
      console.error('Failed to fetch tags:', err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccounts(response.data.accounts || []);
    } catch (err: any) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  // Memoized lookup maps for O(1) performance instead of O(n) array.find()
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const tagMap = useMemo(() => {
    return new Map(tags.map((t) => [t.id, t]));
  }, [tags]);

  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  const getCategoryName = useCallback(
    (categoryId: string) => categoryMap.get(categoryId)?.name || 'Unknown',
    [categoryMap]
  );

  const getCategoryColor = useCallback(
    (categoryId: string) => categoryMap.get(categoryId)?.color || '#667eea',
    [categoryMap]
  );

  const getTagName = useCallback(
    (tagId: string) => tagMap.get(tagId)?.name || 'Unknown',
    [tagMap]
  );

  const getAccountName = useCallback(
    (accountId: string) => accountMap.get(accountId)?.name || 'Unknown',
    [accountMap]
  );

  const handleOpenDialog = useCallback(() => {
    const { startDate, endDate } = getMonthDateRange(); // Default to current month
    setFormData({
      name: '',
      categoryIds: [],
      includeTagIds: [],
      excludeTagIds: [],
      accountIds: [],
      calculationType: 'debit' as 'debit' | 'net',
      amount: '',
      period: 'this-month' as 'this-month' | 'next-month' | 'this-year' | 'custom',
      startDate,
      endDate,
      alertThreshold: '80',
      enableRollover: false,
      rolloverLimit: '',
    });
    setEditingBudget(null);
    setDateError('');
    setIsManualDateEdit(false);
    setOpenDialog(true);
  }, [getMonthDateRange]);

  const handleCreateFromTemplate = useCallback((template: typeof budgetTemplates[0]) => {
    const { startDate, endDate } = getMonthDateRange();
    setFormData({
      name: template.name,
      categoryIds: [],
      includeTagIds: [],
      excludeTagIds: [],
      accountIds: [],
      calculationType: template.calculationType,
      amount: template.amount.toString(),
      period: 'this-month' as 'this-month' | 'next-month' | 'this-year' | 'custom',
      startDate,
      endDate,
      alertThreshold: '80',
      enableRollover: false,
      rolloverLimit: '',
    });
    setEditingBudget(null);
    setDateError('');
    setIsManualDateEdit(false);
    setShowTemplates(false);
    setOpenDialog(true);
  }, [getMonthDateRange, budgetTemplates]);

  const handleEditBudget = useCallback((budget: Budget) => {
    setFormData({
      name: budget.name || '',
      categoryIds: budget.categoryIds || [],
      includeTagIds: budget.includeTagIds || [],
      excludeTagIds: budget.excludeTagIds || [],
      accountIds: budget.accountIds || [],
      calculationType: budget.calculationType,
      amount: budget.amount.toString(),
      period: budget.period,
      startDate: new Date(budget.startDate).toISOString().split('T')[0],
      endDate: budget.endDate
        ? new Date(budget.endDate).toISOString().split('T')[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      alertThreshold: budget.alertThreshold.toString(),
      enableRollover: budget.enableRollover || false,
      rolloverLimit: budget.rolloverLimit?.toString() || '',
    });
    setEditingBudget(budget);
    setDateError('');
    setIsManualDateEdit(false);
    setOpenDialog(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setEditingBudget(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      const payload: any = {
        name: formData.name || undefined,
        calculationType: formData.calculationType,
        amount: formData.amount,
        period: formData.period,
        startDate: formData.startDate,
        endDate: formData.endDate,
        alertThreshold: parseInt(formData.alertThreshold),
        enableRollover: formData.enableRollover,
      };

      // Always send filter arrays (even if empty) to allow clearing
      payload.categoryIds = formData.categoryIds;
      payload.includeTagIds = formData.includeTagIds;
      payload.excludeTagIds = formData.excludeTagIds;
      payload.accountIds = formData.accountIds;

      // Add rollover limit if enabled and specified
      if (formData.enableRollover && formData.rolloverLimit) {
        payload.rolloverLimit = parseFloat(formData.rolloverLimit);
      }

      if (editingBudget) {
        await axios.put(`/api/budgets/${editingBudget.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Budget updated successfully');
      } else {
        await axios.post(`/api/budgets`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Budget created successfully');
      }
      fetchBudgets();
      handleCloseDialog();
    } catch (err: any) {
      console.error('Error saving budget:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save budget';
      toast.error(errorMessage);
    }
  }, [formData, editingBudget, token, toast, handleCloseDialog]);

  const handleDeleteClick = useCallback((budgetId: string) => {
    setConfirmDelete({ open: true, budgetId });
  }, []);

  const handleDuplicateBudget = useCallback(async (budget: Budget) => {
    try {
      await axios.post(
        `/api/budgets/${budget.id}/duplicate`,
        { shiftMonths: 1 }, // Shift dates forward by 1 month
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Budget duplicated successfully');
      fetchBudgets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to duplicate budget');
    }
  }, [token, toast]);

  const handleAmountClick = useCallback((budget: Budget) => {
    setEditingAmountId(budget.id);
    setEditingAmountValue(budget.amount.toString());
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setEditingAmountValue(value);
    }
  }, []);

  const handleAmountSave = useCallback(async (budgetId: string) => {
    const newAmount = parseFloat(editingAmountValue);
    
    if (isNaN(newAmount) || newAmount <= 0) {
      toast.error('Please enter a valid amount');
      setEditingAmountId(null);
      return;
    }

    try {
      const budget = budgets.find(b => b.id === budgetId);
      if (!budget) return;

      await axios.put(
        `/api/budgets/${budgetId}`,
        {
          ...budget,
          amount: newAmount,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Budget amount updated');
      fetchBudgets();
      setEditingAmountId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update amount');
      setEditingAmountId(null);
    }
  }, [editingAmountValue, budgets, token, toast]);

  const handleAmountCancel = useCallback(() => {
    setEditingAmountId(null);
    setEditingAmountValue('');
  }, []);

  const handleAmountKeyPress = useCallback((e: React.KeyboardEvent, budgetId: string) => {
    if (e.key === 'Enter') {
      handleAmountSave(budgetId);
    } else if (e.key === 'Escape') {
      handleAmountCancel();
    }
  }, [handleAmountSave, handleAmountCancel]);

  const handleDeleteBudget = useCallback(async () => {
    if (!confirmDelete.budgetId) return;

    try {
      await axios.delete(`/api/budgets/${confirmDelete.budgetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Budget deleted successfully');
      fetchBudgets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete budget');
    } finally {
      setConfirmDelete({ open: false, budgetId: null });
    }
  }, [confirmDelete.budgetId, token, toast]);

  const formatCurrency = useCallback(
    (amount: number) => formatCurrencyUtil(amount, user?.currency || 'USD'),
    [user?.currency]
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Enhanced color system for budget status (industry standard: Mint, YNAB patterns)
  const getBudgetStatusColors = useCallback((percentUsed: number) => {
    if (percentUsed < 70) {
      return {
        bg: '#e8f5e9',
        color: '#2e7d32',
        status: 'healthy',
        progressColor: 'success' as const,
        icon: '✓',
      };
    }
    if (percentUsed < 90) {
      return {
        bg: '#fff3e0',
        color: '#f57c00',
        status: 'caution',
        progressColor: 'warning' as const,
        icon: '⚠️',
      };
    }
    if (percentUsed < 100) {
      return {
        bg: '#ffe0b2',
        color: '#e65100',
        status: 'warning',
        progressColor: 'warning' as const,
        icon: '⚠️',
      };
    }
    return {
      bg: '#ffebee',
      color: '#c62828',
      status: 'exceeded',
      progressColor: 'error' as const,
      icon: '🚨',
    };
  }, []);

  const getProgressColor = (percentUsed: number) => {
    return getBudgetStatusColors(percentUsed).progressColor;
  };

  // Spending velocity calculation (shows if user is on track, ahead, or behind)
  const calculateSpendingVelocity = useCallback((budget: Budget) => {
    const now = new Date();
    const start = new Date(budget.startDate);
    const end = budget.endDate ? new Date(budget.endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Calculate days elapsed and total days
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    
    // Calculate expected vs actual spending
    const expectedPercent = Math.min(100, (daysElapsed / totalDays) * 100);
    const actualPercent = budget.percentUsed || 0;
    const velocity = actualPercent - expectedPercent; // Positive = overspending
    
    // Determine status
    let velocityStatus: 'on-track' | 'ahead' | 'behind';
    let velocityMessage: string;
    let velocityColor: string;
    
    if (Math.abs(velocity) < 10) {
      velocityStatus = 'on-track';
      velocityMessage = 'On track';
      velocityColor = '#4caf50';
    } else if (velocity > 0) {
      velocityStatus = 'ahead';
      velocityMessage = `${Math.round(velocity)}% ahead of pace`;
      velocityColor = '#f57c00';
    } else {
      velocityStatus = 'behind';
      velocityMessage = `${Math.abs(Math.round(velocity))}% under budget`;
      velocityColor = '#2196f3';
    }
    
    return {
      velocity,
      velocityStatus,
      velocityMessage,
      velocityColor,
      daysRemaining,
      daysElapsed,
      totalDays,
      expectedPercent,
    };
  }, []);

  // Generate sparkline data (simulated daily spending trend)
  const generateSparklineData = useCallback((budget: Budget) => {
    const spent = budget.spent || 0;
    const totalAmount = budget.amount + (budget.rolledOverAmount || 0);
    const daysElapsed = calculateSpendingVelocity(budget).daysElapsed;
    
    // Generate 7 data points for the last week
    const dataPoints = [];
    const daysToShow = Math.min(7, daysElapsed);
    
    for (let i = 0; i < daysToShow; i++) {
      // Simulate cumulative spending with some variance
      const dayProgress = (i + 1) / daysToShow;
      const baseSpending = spent * dayProgress;
      // Add small random variance to make it look realistic
      const variance = spent * 0.1 * (Math.random() - 0.5);
      const value = Math.max(0, baseSpending + variance);
      
      dataPoints.push({
        day: i + 1,
        spent: value,
        percent: (value / totalAmount) * 100,
      });
    }
    
    return dataPoints;
  }, [calculateSpendingVelocity]);

  // Filter and sort budgets (memoized for performance)
  const filteredAndSortedBudgets = useMemo(() => {
    let filtered = budgets;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((budget) => {
        // Search in budget name
        if (budget.name && budget.name.toLowerCase().includes(query)) return true;
        
        // Search in category names
        if (budget.categoryIds?.some((catId) => 
          getCategoryName(catId).toLowerCase().includes(query)
        )) return true;
        
        // Search in tag names
        if (budget.includeTagIds?.some((tagId) => 
          getTagName(tagId).toLowerCase().includes(query)
        )) return true;
        if (budget.excludeTagIds?.some((tagId) => 
          getTagName(tagId).toLowerCase().includes(query)
        )) return true;
        
        // Search in account names
        if (budget.accountIds?.some((accId) => 
          getAccountName(accId).toLowerCase().includes(query)
        )) return true;
        
        return false;
      });
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((budget) => {
        const percentUsed = budget.percentUsed || 0;
        const status = getBudgetStatusColors(percentUsed).status;
        
        if (filterStatus === 'healthy') return status === 'healthy';
        if (filterStatus === 'warning') return status === 'caution' || status === 'warning';
        if (filterStatus === 'exceeded') return status === 'exceeded';
        
        return true;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = a.name || 'Unnamed';
        const nameB = b.name || 'Unnamed';
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'amount') {
        return (b.amount + (b.rolledOverAmount || 0)) - (a.amount + (a.rolledOverAmount || 0));
      }
      if (sortBy === 'percentUsed') {
        return (b.percentUsed || 0) - (a.percentUsed || 0);
      }
      if (sortBy === 'remaining') {
        return (a.remaining || 0) - (b.remaining || 0); // Ascending: most negative first
      }
      return 0;
    });

    return sorted;
  }, [budgets, searchQuery, filterStatus, sortBy, getBudgetStatusColors, getCategoryName, getTagName, getAccountName]);

  // Calculate summary statistics (memoized for performance)
  const budgetSummary = useMemo(() => {
    if (budgets.length === 0) return null;
    
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount + (b.rolledOverAmount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
    const totalRemaining = totalBudgeted - totalSpent;
    const overallPercent = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
    
    const healthyCount = budgets.filter(b => (b.percentUsed || 0) < 70).length;
    const warningCount = budgets.filter(b => (b.percentUsed || 0) >= 70 && (b.percentUsed || 0) < 100).length;
    const exceededCount = budgets.filter(b => (b.percentUsed || 0) >= 100).length;
    
    return {
      totalBudgeted,
      totalSpent,
      totalRemaining,
      overallPercent,
      totalCount: budgets.length,
      healthyCount,
      warningCount,
      exceededCount,
    };
  }, [budgets]);

  if (loading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Budgets</Typography>
        </Box>
        <Grid container spacing={3}>
          {[...Array(4)].map((_, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index} sx={{ display: { xs: index >= 2 ? 'none' : 'block', sm: 'block' } }}>
              <BudgetCardSkeleton />
            </Grid>
          ))}
        </Grid>
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
                    <SavingsIcon sx={{ fontSize: 32 }} />
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
                    Budget Tracking
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, ml: 9 }}>
                  {budgets.length === 0 
                    ? 'Set spending limits to stay on track'
                    : `${budgets.length} active budget${budgets.length !== 1 ? 's' : ''} • ${budgetSummary && budgetSummary.exceededCount > 0 ? `${budgetSummary.exceededCount} exceeded` : budgetSummary && budgetSummary.warningCount > 0 ? `${budgetSummary.warningCount} approaching limit` : 'All on track'}`
                  }
                </Typography>
              </Box>
              <Box display="flex" gap={2}>
                <Zoom in timeout={800}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setShowTemplates(true)}
                    sx={{
                      bgcolor: 'white',
                      borderColor: 'white',
                      color: 'primary.main',
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: 'white',
                        bgcolor: 'rgba(255,255,255,0.95)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      },
                    }}
                  >
                    From Template
                  </Button>
                </Zoom>
                <Zoom in timeout={900}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenDialog}
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.95)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      },
                    }}
                  >
                    Create Budget
                  </Button>
                </Zoom>
              </Box>
            </Box>
          </Box>
        </Box>
      </Fade>

      {/* Budget Summary Card */}
      {budgetSummary && (
        <Fade in timeout={800}>
          <Card sx={{
            mb: 3,
            borderRadius: 3,
            background: (theme) => theme.palette.gradient.primary,
            color: 'white',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: (theme) => `0 4px 20px ${theme.palette.primary.main}40`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: (theme) => `0 12px 32px ${theme.palette.primary.main}50`,
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              borderRadius: '50%',
            },
          }}>
            <CardContent sx={{ position: 'relative', zIndex: 1 }}>
            <Grid container spacing={3}>
              {/* Total Budgeted */}
              <Grid item xs={6} sm={3}>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Total Budgeted
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {formatCurrency(budgetSummary.totalBudgeted)}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {budgetSummary.totalCount} {budgetSummary.totalCount === 1 ? 'budget' : 'budgets'}
                  </Typography>
                </Box>
              </Grid>

              {/* Total Spent */}
              <Grid item xs={6} sm={3}>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Total Spent
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {formatCurrency(budgetSummary.totalSpent)}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {budgetSummary.overallPercent}% used
                  </Typography>
                </Box>
              </Grid>

              {/* Remaining */}
              <Grid item xs={6} sm={3}>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Remaining
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {formatCurrency(Math.abs(budgetSummary.totalRemaining))}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {budgetSummary.totalRemaining < 0 ? 'Over budget' : 'Available'}
                  </Typography>
                </Box>
              </Grid>

              {/* Budget Health */}
              <Grid item xs={6} sm={3}>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Budget Health
                  </Typography>
                  <Box display="flex" gap={1} mt={0.5}>
                    {budgetSummary.healthyCount > 0 && (
                      <Chip 
                        label={`${budgetSummary.healthyCount} ✓`} 
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
                      />
                    )}
                    {budgetSummary.warningCount > 0 && (
                      <Chip 
                        label={`${budgetSummary.warningCount} ⚠️`} 
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
                      />
                    )}
                    {budgetSummary.exceededCount > 0 && (
                      <Chip 
                        label={`${budgetSummary.exceededCount} 🚨`} 
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
                      />
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
          </Card>
        </Fade>
      )}

      {/* Search and Filter Bar */}
      {budgets.length > 0 && (
        <Fade in timeout={1000}>
          <Card sx={{
            mb: 3,
            p: 2,
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
          }}>
          <Grid container spacing={2} alignItems="center">
            {/* Search */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search budgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Status Filter */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Filter by Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FilterListIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="all">All Budgets</MenuItem>
                <MenuItem value="healthy">Healthy ({"<"}70%)</MenuItem>
                <MenuItem value="warning">Warning (70-100%)</MenuItem>
                <MenuItem value="exceeded">Exceeded ({">"}100%)</MenuItem>
              </TextField>
            </Grid>

            {/* Sort By */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Sort By"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <MenuItem value="percentUsed">% Used (High to Low)</MenuItem>
                <MenuItem value="remaining">Remaining (Low to High)</MenuItem>
                <MenuItem value="amount">Amount (High to Low)</MenuItem>
                <MenuItem value="name">Name (A-Z)</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {/* Results Count */}
          <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Showing {filteredAndSortedBudgets.length} of {budgets.length} budgets
            </Typography>
            {(searchQuery || filterStatus !== 'all') && (
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
          </Card>
        </Fade>
      )}

      {budgets.length === 0 ? (
        <Card
          sx={{
            background: (theme) =>
              theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(30, 30, 30, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Box mb={3}>
              <SavingsIcon sx={{ fontSize: 80, color: '#14b8a6', opacity: 0.8 }} />
            </Box>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Start Budgeting Today
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={4} maxWidth="500px" mx="auto">
              Take control of your finances by setting spending limits. Choose from templates or create custom budgets to track categories, tags, and accounts.
            </Typography>
            
            {/* Quick Action Buttons */}
            <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => setShowTemplates(true)}
                sx={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0891b2 0%, #0284c7 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(20, 184, 166, 0.4)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Use Template
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<AddIcon />}
                onClick={handleOpenDialog}
                sx={{
                  borderColor: '#14b8a6',
                  color: '#14b8a6',
                  '&:hover': {
                    borderColor: '#0891b2',
                    bgcolor: 'rgba(20, 184, 166, 0.1)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Create Custom
              </Button>
            </Box>

            {/* Feature Highlights */}
            <Grid container spacing={3} mt={4} maxWidth="800px" mx="auto">
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="h6" gutterBottom>📊 Track Spending</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monitor your expenses in real-time with visual progress bars
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="h6" gutterBottom>🎯 Set Goals</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Define limits for categories, tags, or specific accounts
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="h6" gutterBottom>⚡ Stay Alerted</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Get notified when you approach your budget limits
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : filteredAndSortedBudgets.length === 0 ? (
        <Card
          sx={{
            background: (theme) =>
              theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(30, 30, 30, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Box mb={2}>
              <SearchIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.5 }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              No budgets match your filters
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              {searchQuery && `No results for "${searchQuery}". `}
              Try adjusting your search or filters to see more budgets.
            </Typography>
            <Box display="flex" gap={2} justifyContent="center">
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
              >
                Clear All Filters
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenDialog}
                sx={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0891b2 0%, #0284c7 100%)',
                  },
                }}
              >
                Create New Budget
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredAndSortedBudgets.map((budget) => {
            const statusColors = getBudgetStatusColors(budget.percentUsed || 0);
            const velocityInfo = calculateSpendingVelocity(budget);
            
            return (
            <Grid item xs={12} md={6} lg={4} key={budget.id}>
              <Card
                sx={{
                  background: (theme) =>
                    theme.palette.mode === 'light'
                      ? 'rgba(255, 255, 255, 0.9)'
                      : 'rgba(30, 30, 30, 0.9)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                  border: '2px solid',
                  borderColor: statusColors.color + '40',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.25)',
                  },
                }}
              >
                <CardContent>
                  {/* Status Badge and Action Buttons */}
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Chip
                      icon={<span style={{ fontSize: '14px' }}>{statusColors.icon}</span>}
                      label={statusColors.status.toUpperCase()}
                      size="small"
                      sx={{
                        bgcolor: statusColors.bg,
                        color: statusColors.color,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                    <Box>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDuplicateBudget(budget)}
                        title="Duplicate budget"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditBudget(budget)}
                        title="Edit budget"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(budget.id)}
                        color="error"
                        title="Delete budget"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box>
                    <Box flex={1}>
                      {/* Budget Name (if provided) */}
                      {budget.name && (
                        <Typography variant="h6" fontWeight="600" gutterBottom>
                          {budget.name}
                        </Typography>
                      )}
                      
                      <Box display="flex" alignItems="center" gap={0.5} mb={1} flexWrap="wrap">
                        {/* Categories */}
                        {budget.categoryIds && budget.categoryIds.map((catId) => (
                          <Chip
                            key={catId}
                            icon={
                              categories?.find((c) => c.id === catId)?.isFolder ? (
                                <span>📁</span>
                              ) : (
                                <span>📄</span>
                              )
                            }
                            label={getCategoryName(catId)}
                            size="small"
                            sx={{
                              bgcolor: getCategoryColor(catId) + '20',
                              color: getCategoryColor(catId),
                            }}
                          />
                        ))}

                        {/* Include Tags */}
                        {budget.includeTagIds && budget.includeTagIds.length > 0 && budget.includeTagIds.map((tagId) => (
                          <Chip
                            key={tagId}
                            icon={<LabelIcon sx={{ fontSize: 14 }} />}
                            label={getTagName(tagId)}
                            size="small"
                            sx={{
                              bgcolor: '#4caf5020',
                              color: '#4caf50',
                            }}
                          />
                        ))}

                        {/* Exclude Tags */}
                        {budget.excludeTagIds && budget.excludeTagIds.length > 0 && budget.excludeTagIds.map((tagId) => (
                          <Chip
                            key={`exclude-${tagId}`}
                            icon={<LabelIcon sx={{ fontSize: 14 }} />}
                            label={`NOT ${getTagName(tagId)}`}
                            size="small"
                            sx={{
                              bgcolor: '#f4433620',
                              color: '#f44336',
                            }}
                          />
                        ))}

                        {/* Accounts */}
                        {budget.accountIds && budget.accountIds.map((accId) => (
                          <Chip
                            key={accId}
                            icon={<AccountIcon sx={{ fontSize: 14 }} />}
                            label={getAccountName(accId)}
                            size="small"
                            sx={{
                              bgcolor: '#4ecdc420',
                              color: '#4ecdc4',
                            }}
                          />
                        ))}
                        
                        {/* Calculation Type */}
                        <Chip
                          label={
                            budget.calculationType === 'debit'
                              ? 'Expenses'
                              : 'Net (after refunds)'
                          }
                          size="small"
                          color={
                            budget.calculationType === 'debit'
                              ? 'error'
                              : 'info'
                          }
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                      
                      {/* Budget Amount - Inline Editable */}
                      {editingAmountId === budget.id ? (
                        <Box display="flex" alignItems="center" gap={1} my={1}>
                          <TextField
                            size="small"
                            value={editingAmountValue}
                            onChange={handleAmountChange}
                            onKeyDown={(e) => handleAmountKeyPress(e, budget.id)}
                            onBlur={() => handleAmountSave(budget.id)}
                            autoFocus
                            type="text"
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  {user?.currency || 'USD'}
                                </InputAdornment>
                              ),
                            }}
                            sx={{ width: '150px' }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Press Enter to save, Esc to cancel
                          </Typography>
                        </Box>
                      ) : (
                        <Typography 
                          variant="h5" 
                          fontWeight={700}
                          onClick={() => handleAmountClick(budget)}
                          sx={{
                            cursor: 'pointer',
                            display: 'inline-block',
                            borderRadius: 1,
                            px: 0.5,
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: 'action.hover',
                              transform: 'scale(1.02)',
                            },
                          }}
                          title="Click to edit amount"
                        >
                          {formatCurrency(budget.amount)}
                          {budget.rolledOverAmount && budget.rolledOverAmount > 0 && (
                            <Typography
                              component="span"
                              variant="caption"
                              color="success.main"
                              sx={{ ml: 1 }}
                            >
                              (+{formatCurrency(budget.rolledOverAmount)} rollover)
                            </Typography>
                          )}
                        </Typography>
                      )}
                      
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(budget.startDate)} -{' '}
                        {budget.endDate ? formatDate(budget.endDate) : 'Ongoing'}
                      </Typography>
                      
                      {/* Spending Velocity Indicator */}
                      <Box mt={1}>
                        <Chip
                          label={velocityInfo.velocityMessage}
                          size="small"
                          sx={{
                            bgcolor: velocityInfo.velocityColor + '20',
                            color: velocityInfo.velocityColor,
                            fontSize: '0.65rem',
                            height: '20px',
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {velocityInfo.daysRemaining} days left
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Spent: {formatCurrency(budget.spent || 0)}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={budget.isOverBudget ? 'error.main' : 'text.primary'}
                      >
                        {budget.percentUsed || 0}%
                      </Typography>
                    </Box>
                    
                    {/* Spending Trend Sparkline */}
                    {velocityInfo.daysElapsed > 0 && (
                      <Box mb={1} sx={{ height: 40 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={generateSparklineData(budget)}>
                            <Line
                              type="monotone"
                              dataKey="percent"
                              stroke={statusColors.color}
                              strokeWidth={2}
                              dot={false}
                              animationDuration={300}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                    
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(budget.percentUsed || 0, 100)}
                      color={getProgressColor(budget.percentUsed || 0)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography
                      variant="body2"
                      color={
                        budget.remaining && budget.remaining < 0 ? 'error.main' : 'success.main'
                      }
                    >
                      {budget.remaining && budget.remaining < 0 ? 'Over by ' : 'Remaining: '}
                      {formatCurrency(Math.abs(budget.remaining || 0))}
                    </Typography>
                    {budget.isOverBudget && (
                      <Chip icon={<WarningIcon />} label="Over Budget" size="small" color="error" />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <ResponsiveDialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            background: (theme) => theme.palette.gradient.primary,
            color: 'white',
            py: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              borderRadius: '50%',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
              <SavingsIcon />
            </Avatar>
            <Typography variant="h5" fontWeight={700}>
              {editingBudget ? 'Edit Budget' : 'Create New Budget'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Budget Name */}
            <TextField
              label="Budget Name (Optional)"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onBlur={(e) => setFormData({ ...formData, name: e.target.value.trim() })}
              placeholder="e.g., Groceries, Q1 Marketing, Annual Insurance"
              helperText="Give your budget a descriptive name for easy identification"
              inputProps={{ maxLength: 100 }}
            />

            <Divider />

            {/* Multi-Select Filters Section */}
            <Box
              sx={{
                p: 3,
                borderRadius: 2.5,
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.04) 0%, rgba(118, 75, 162, 0.06) 100%)'
                    : 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.1) 100%)',
                border: '1px solid',
                borderColor: 'divider',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: (theme) => theme.palette.gradient.primary,
                    color: 'white',
                  }}
                >
                  <FilterListIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Budget Filters
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Select what transactions to track (at least one filter required)
                  </Typography>
                </Box>
              </Box>

              {/* Categories Multi-Select */}
              <TextField
                select
                label="Categories (Optional)"
                fullWidth
                value={formData.categoryIds}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    categoryIds: typeof value === 'string' ? [value] : value,
                  });
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((catId) => (
                        <Chip 
                          key={catId} 
                          label={getCategoryName(catId)} 
                          size="small" 
                          sx={{ 
                            background: `linear-gradient(135deg, ${getCategoryColor(catId)}20 0%, ${getCategoryColor(catId)}30 100%)`,
                            color: getCategoryColor(catId),
                            fontWeight: 600,
                            border: `1px solid ${getCategoryColor(catId)}50`,
                          }} 
                        />
                      ))}
                    </Box>
                  ),
                }}
                helperText="Track these categories (category1 OR category2 OR ...)"
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              >
                {!categories || categories.length === 0 ? (
                  <MenuItem value="" disabled>
                    No categories available. Create one first.
                  </MenuItem>
                ) : (
                  categories
                    .sort((a, b) => {
                      const depthDiff = a.path.length - b.path.length;
                      if (depthDiff !== 0) return depthDiff;
                      return a.name.localeCompare(b.name);
                    })
                    .map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {'  '.repeat(category.path.length)}
                        {category.isFolder ? '📁' : '📄'} {category.name}
                      </MenuItem>
                    ))
                )}
              </TextField>

              {/* Include Tags */}
              <TextField
                select
                label="Include Tags (Optional)"
                fullWidth
                value={formData.includeTagIds}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    includeTagIds: typeof value === 'string' ? [value] : value,
                  });
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((tagId) => (
                        <Chip 
                          key={tagId} 
                          label={getTagName(tagId)} 
                          size="small" 
                          sx={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            fontWeight: 600,
                            boxShadow: '0 2px 8px #10b98140',
                          }}
                        />
                      ))}
                    </Box>
                  ),
                }}
                helperText="Transactions must have at least one of these tags (tag1 OR tag2 OR ...)"
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              >
                {!tags || tags.length === 0 ? (
                  <MenuItem value="" disabled>
                    No tags available. Create transactions with tags first.
                  </MenuItem>
                ) : (
                  tags.map((tag) => (
                    <MenuItem key={tag.id} value={tag.id}>
                      {tag.name} ({tag.usageCount} uses)
                    </MenuItem>
                  ))
                )}
              </TextField>

              {/* Exclude Tags */}
              <TextField
                select
                label="Exclude Tags (Optional)"
                fullWidth
                value={formData.excludeTagIds}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    excludeTagIds: typeof value === 'string' ? [value] : value,
                  });
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((tagId) => (
                        <Chip 
                          key={tagId} 
                          label={getTagName(tagId)} 
                          size="small" 
                          sx={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            fontWeight: 600,
                            boxShadow: '0 2px 8px #ef444440',
                          }}
                        />
                      ))}
                    </Box>
                  ),
                }}
                helperText="Transactions must NOT have any of these tags (NOT tag3 AND NOT tag4)"
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              >
                {!tags || tags.length === 0 ? (
                  <MenuItem value="" disabled>
                    No tags available. Create transactions with tags first.
                  </MenuItem>
                ) : (
                  tags.map((tag) => (
                    <MenuItem key={tag.id} value={tag.id}>
                      {tag.name} ({tag.usageCount} uses)
                    </MenuItem>
                  ))
                )}
              </TextField>

              {/* Accounts Multi-Select */}
              <TextField
                select
                label="Accounts (Optional)"
                fullWidth
                value={formData.accountIds}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    accountIds: typeof value === 'string' ? [value] : value,
                  });
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((accId) => (
                        <Chip 
                          key={accId} 
                          label={getAccountName(accId)} 
                          size="small" 
                          sx={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            fontWeight: 600,
                            boxShadow: '0 2px 8px #3b82f640',
                          }}
                        />
                      ))}
                    </Box>
                  ),
                }}
                helperText="Track these accounts (account1 OR account2 OR ...)"
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              >
                {!accounts || accounts.length === 0 ? (
                  <MenuItem value="" disabled>
                    No accounts available. Create one first.
                  </MenuItem>
                ) : (
                  accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name} ({account.type})
                    </MenuItem>
                  ))
                )}
              </TextField>

              {/* Validation Alert */}
              {formData.categoryIds.length === 0 && 
               formData.includeTagIds.length === 0 && 
               formData.excludeTagIds.length === 0 && 
               formData.accountIds.length === 0 && (
                <Alert 
                  severity="warning" 
                  sx={{ 
                    mt: 2,
                    borderRadius: 2,
                    '& .MuiAlert-icon': {
                      fontSize: 24,
                    },
                  }}
                >
                  Please select at least one filter (categories, tags, or accounts)
                </Alert>
              )}
            </Box>

            <Divider />

            {/* Calculation Type */}
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                💳 Budget Type
              </Typography>
              <ToggleButtonGroup
                value={formData.calculationType}
                exclusive
                onChange={(_, newType) => {
                  if (newType !== null) {
                    setFormData({ ...formData, calculationType: newType });
                  }
                }}
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    borderRadius: 2,
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    border: '1.5px solid',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      background: (theme) => theme.palette.gradient.primary,
                      color: 'white',
                      borderColor: 'transparent',
                      '&:hover': {
                        background: (theme) => theme.palette.gradient.primary,
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="debit">
                  📉 Expenses Only
                </ToggleButton>
                <ToggleButton value="net">
                  ⚖️ Net (Expenses - Refunds)
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {formData.calculationType === 'debit' && 'Track total expenses (debits)'}
                {formData.calculationType === 'net' && 'Track net expenses after refunds/returns (debit - credit)'}
              </Typography>
            </Box>

            <Divider />

            {/* Budget Amount and Period */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="💰 Budget Amount"
                  type="number"
                  fullWidth
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">{user?.currency || 'USD'}</InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="📅 Period"
                  fullWidth
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                  helperText={
                    formData.period === 'this-month'
                      ? 'Auto-sets to current month dates'
                      : formData.period === 'next-month'
                      ? 'Auto-sets to next month dates'
                      : formData.period === 'this-year'
                      ? 'Auto-sets to current year dates'
                      : 'Choose custom date range'
                  }
                >
                  <MenuItem value="this-month">This Month</MenuItem>
                  <MenuItem value="next-month">Next Month</MenuItem>
                  <MenuItem value="this-year">This Year</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            {/* Date Range */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="📆 Start Date"
                  type="date"
                  fullWidth
                  value={formData.startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                  error={!!dateError}
                  helperText={
                    formData.period === 'this-month'
                      ? 'First day of this month (edit to switch to custom)'
                      : formData.period === 'next-month'
                      ? 'First day of next month (edit to switch to custom)'
                      : formData.period === 'this-year'
                      ? 'First day of this year (edit to switch to custom)'
                      : ''
                  }
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="📆 End Date"
                  type="date"
                  fullWidth
                  value={formData.endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                  error={!!dateError}
                  helperText={
                    formData.period === 'this-month'
                      ? 'Last day of this month (edit to switch to custom)'
                      : formData.period === 'next-month'
                      ? 'Last day of next month (edit to switch to custom)'
                      : formData.period === 'this-year'
                      ? 'Last day of this year (edit to switch to custom)'
                      : ''
                  }
                  required
                />
              </Grid>
              {dateError && (
                <Grid item xs={12}>
                  <Alert severity="error" sx={{ mt: -1 }}>
                    {dateError}
                  </Alert>
                </Grid>
              )}
            </Grid>

            <Divider />

            {/* Alert Configuration */}
            <TextField
              label="🔔 Alert Threshold (%)"
              type="number"
              fullWidth
              value={formData.alertThreshold}
              onChange={(e) => setFormData({ ...formData, alertThreshold: e.target.value })}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
              helperText="Get notified when spending reaches this percentage"
              required
            />

            {/* Rollover Configuration */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)'
                    : 'linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enableRollover}
                    onChange={(e) =>
                      setFormData({ ...formData, enableRollover: e.target.checked })
                    }
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: (theme) => theme.palette.primary.main,
                        '&:hover': {
                          backgroundColor: (theme) =>
                            `${theme.palette.primary.main}15`,
                        },
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        background: (theme) => theme.palette.gradient.primary,
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      💰 Enable Rollover
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Allow unused budget to carry over to the next period
                    </Typography>
                  </Box>
                }
              />
              
              {formData.enableRollover && (
                <TextField
                  label="💵 Rollover Limit (optional)"
                  type="number"
                  fullWidth
                  value={formData.rolloverLimit}
                  onChange={(e) => setFormData({ ...formData, rolloverLimit: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">{user?.currency || 'USD'}</InputAdornment>
                    ),
                  }}
                  helperText="Maximum amount that can roll over (leave empty for no limit)"
                  sx={{ 
                    mt: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            gap: 1.5,
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(248, 250, 252, 0.8)'
                : 'rgba(15, 15, 15, 0.8)',
          }}
        >
          <Button 
            onClick={handleCloseDialog}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              !formData.amount ||
              !formData.startDate ||
              !formData.endDate ||
              !!dateError ||
              (formData.categoryIds.length === 0 && 
               formData.includeTagIds.length === 0 && 
               formData.excludeTagIds.length === 0 && 
               formData.accountIds.length === 0)
            }
            sx={{
              borderRadius: 2,
              px: 4,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) => theme.palette.gradient.primary,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 4,
              },
              transition: 'all 0.2s ease',
            }}
          >
            {editingBudget ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDelete.open}
        title="Delete Budget"
        message="Are you sure you want to delete this budget? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteBudget}
        onCancel={() => setConfirmDelete({ open: false, budgetId: null })}
        severity="error"
      />

      {/* Quick Add FAB */}
      <QuickAddFab onClick={handleOpenDialog} tooltip="Create Budget" />

      {/* Budget Templates Dialog */}
      <ResponsiveDialog 
        open={showTemplates} 
        onClose={() => setShowTemplates(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle
          sx={{
            background: (theme) => theme.palette.gradient.primary,
            color: 'white',
            py: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
            <Avatar
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 48,
                height: 48,
                fontSize: '24px',
              }}
            >
              📋
            </Avatar>
            <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
              Choose a Budget Template
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Quick-start your budget with pre-configured templates. You can customize amounts and filters after selection.
          </Typography>
          <Grid container spacing={2}>
            {budgetTemplates.map((template) => (
              <Grid item xs={12} sm={6} key={template.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '2px solid transparent',
                    '&:hover': {
                      borderColor: '#667eea',
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(102, 126, 234, 0.2)',
                    },
                  }}
                  onClick={() => handleCreateFromTemplate(template)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <Typography variant="h4">{template.icon}</Typography>
                      <Box flex={1}>
                        <Typography variant="h6" fontWeight={600}>
                          {template.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {template.description}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={600} color="primary">
                        {formatCurrency(template.amount)}
                      </Typography>
                      <Chip
                        label={template.calculationType === 'debit' ? 'Expenses' : 'Net'}
                        size="small"
                        color={template.calculationType === 'debit' ? 'error' : 'info'}
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(248, 250, 252, 0.8)'
                : 'rgba(15, 15, 15, 0.8)',
          }}
        >
          <Button
            onClick={() => setShowTemplates(false)}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default Budgets;
