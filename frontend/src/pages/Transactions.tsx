import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Menu,
  Chip,
  InputAdornment,
  Grid,
  Collapse,
  Checkbox,
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
  FormControlLabel,
  Switch,
  TablePagination,
  Tooltip,
  Alert,
  Snackbar,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
  TrendingUp as CreditIcon,
  TrendingDown as DebitIcon,
  LocalOffer as TagIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ReceiptLong as ReceiptIcon,
  Sms as SmsIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Email as EmailIcon,
  CloudUpload as ImportIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  UnfoldMore as UnfoldMoreIcon,
  HourglassEmpty as PendingIcon,
  Block as RejectedIcon,
  AccountBalanceWallet,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useToast } from '../components/Toast';
import {
  useAccounts,
  useCategories,
  useTags,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  type Account,
} from '../hooks/useApi';
import { api } from '../services/api';
import QuickAddFab from '../components/QuickAddFab';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeletons';
import TransactionCard from '../components/TransactionCard';
import SwipeableTransactionCard from '../components/SwipeableTransactionCard';
import ResponsiveDialog from '../components/ResponsiveDialog';
import PullToRefresh from '../components/PullToRefresh';
import SMSImportModal from '../components/SMSImportModal';
import FilterPanel, { FilterValues } from '../components/FilterPanel';
import { useResponsive } from '../hooks/useResponsive';
import { useIsTouchDevice } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { formatCurrency as formatCurrencyUtil, CURRENCIES } from '../utils/currency';
import { ModernDatePicker } from '../components/ModernDatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

interface Category {
  id: string;
  name: string;
  isFolder: boolean;
  parentId?: string;
  icon?: string;
  color?: string;
}

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface Transaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  accountId: string;
  categoryId?: string; // @deprecated - use splits instead
  description: string;
  tags?: string[]; // @deprecated - use splits instead
  date: string;
  isRecurring: boolean;
  recurrencePattern?: string;
  source?: string;
  merchantName?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  linkedTransactionId?: string;
  splits?: TransactionSplit[]; // New: array of splits
  createdAt: string;
  updatedAt: string;
}

interface TransactionSplit {
  id?: string;
  transactionId?: string;
  userId?: string;
  categoryId: string;
  amount: number;
  tags: string[];
  notes?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

// Smart tag mapping: category names (lowercase) to suggested tags
const CATEGORY_TAG_SUGGESTIONS: Record<string, { suggestedTags: string[]; removeTags: string[] }> =
  {
    // Investment categories
    stocks: { suggestedTags: ['investment'], removeTags: ['expense'] },
    'mutual funds': { suggestedTags: ['investment'], removeTags: ['expense'] },
    crypto: { suggestedTags: ['investment'], removeTags: ['expense'] },
    cryptocurrency: { suggestedTags: ['investment'], removeTags: ['expense'] },
    investment: { suggestedTags: ['investment'], removeTags: ['expense'] },
    bonds: { suggestedTags: ['investment'], removeTags: ['expense'] },
    'real estate': { suggestedTags: ['investment'], removeTags: ['expense'] },

    // Transfer categories
    transfer: { suggestedTags: ['transfer'], removeTags: ['expense', 'income'] },
    'account transfer': { suggestedTags: ['transfer'], removeTags: ['expense', 'income'] },

    // Savings categories
    savings: { suggestedTags: ['savings'], removeTags: ['expense'] },
    'emergency fund': { suggestedTags: ['savings'], removeTags: ['expense'] },

    // Loan/Debt categories
    'loan payment': { suggestedTags: ['loan'], removeTags: ['expense'] },
    loan: { suggestedTags: ['loan'], removeTags: ['expense'] },
    'debt payment': { suggestedTags: ['loan'], removeTags: ['expense'] },
    emi: { suggestedTags: ['loan'], removeTags: ['expense'] },

    // Refund categories
    refund: { suggestedTags: ['refund'], removeTags: ['income'] },
    cashback: { suggestedTags: ['refund'], removeTags: ['income'] },
    return: { suggestedTags: ['refund'], removeTags: ['income'] },
  };

// Tags to exclude from expense calculations in dashboards
const EXPENSE_EXCLUDE_TAGS = ['investment', 'transfer', 'savings', 'loan', 'refund'];

// Tags to exclude from income calculations in dashboards
const INCOME_EXCLUDE_TAGS = ['transfer', 'refund'];

const Transactions: React.FC = () => {
  const { token, user } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const { isMobile } = useResponsive();
  const userCurrency = user?.currency || 'USD';
  const currencySymbol = CURRENCIES[userCurrency]?.symbol || '$';
  const isTouchDevice = useIsTouchDevice();

  // React Query hooks for data fetching
  const { data: accountsData } = useAccounts();
  const { data: categoriesData } = useCategories();
  const { data: tagsData } = useTags();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const accounts = (accountsData?.data?.accounts || []).filter((a: Account) => a.isActive);
  const categories = categoriesData?.data?.categories || [];
  const tags = tagsData?.data?.tags || [];

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0); // Total records from API
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    transactionId: string | null;
  }>({
    open: false,
    transactionId: null,
  });

  // Filter states - using centralized FilterPanel
  const [filterValues, setFilterValues] = useState<FilterValues>({
    searchQuery: '',
    transactionType: 'all',
    selectedAccount: '',
    selectedCategories: [],
    includeTags: [],
    excludeTags: [],
    minAmount: '',
    maxAmount: '',
    amountQuickFilter: 'any',
    startDate: dayjs().startOf('month'),
    endDate: dayjs().endOf('month'),
    activeDateFilter: 'thisMonth',
  });
  const [reviewStatus, setReviewStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [useSplitMode, setUseSplitMode] = useState(false); // Toggle between quick add and split mode
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [smsImportOpen, setSmsImportOpen] = useState(false);
  const [emailImportOpen, setEmailImportOpen] = useState(false);
  const [importMenuAnchor, setImportMenuAnchor] = useState<null | HTMLElement>(null);
  const [pendingCount, setPendingCount] = useState(0); // All-time pending count
  const [merchants, setMerchants] = useState<string[]>([]); // Unique merchant names
  const [recentCategories, setRecentCategories] = useState<string[]>([]); // Recent category IDs

  // Undo reject state
  const [undoRejectInfo, setUndoRejectInfo] = useState<{
    transactionId: string;
    timeoutId: number;
  } | null>(null);

  // Approve mode state
  const [approveMode, setApproveMode] = useState(false); // Track if we're in "Complete & Approve" mode

  // Form states
  const [formData, setFormData] = useState({
    type: 'debit' as 'credit' | 'debit',
    amount: '',
    accountId: '',
    categoryId: '', // Used for quick add (single split)
    description: '',
    tags: [] as string[], // Used for quick add (single split)
    splits: [
      {
        categoryId: '',
        amount: 0,
        tags: [] as string[],
        notes: '',
        order: 1,
      },
    ] as TransactionSplit[],
    date: dayjs().format('YYYY-MM-DD'),
    merchantName: '',
    isRecurring: false,
    recurrencePattern: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    recurrenceDay: new Date().getDate(),
    recurrenceEndDate: '',
  });

  useEffect(() => {
    const initializeData = async () => {
      if (!token) return; // Wait for authentication

      try {
        setLoading(true);
        // React Query hooks already fetched accounts, categories, tags
        await fetchTransactions();
        await fetchPendingCount();
        await fetchMerchantsAndRecentCategories();
      } catch (err) {
        console.error('Error initializing transactions page:', err);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [token]);

  // Handle navigation state from other pages (e.g., clicking "View Transactions" from Accounts)
  useEffect(() => {
    if (location.state) {
      const state = location.state as any;

      // Apply category filter
      if (state.filterCategoryId) {
        setFilterValues((prev) => ({
          ...prev,
          selectedCategories: [state.filterCategoryId],
        }));
        toast.success('Filtered by category');
      }

      // Open add transaction dialog with pre-filled data
      if (state.addTransaction) {
        const transactionType = state.type || 'debit';
        const defaultTag = transactionType === 'debit' ? 'expense' : 'income';

        setFormData((prev) => ({
          ...prev,
          accountId: state.accountId || prev.accountId,
          type: transactionType,
          tags: [defaultTag],
          splits: [
            {
              ...prev.splits[0],
              tags: [defaultTag],
            },
          ],
        }));
        setOpenDialog(true);
      }

      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoRejectInfo) {
        clearTimeout(undoRejectInfo.timeoutId);
      }
    };
  }, [undoRejectInfo]);

  // Reset to first page when filters change (industry standard: API filtering)
  useEffect(() => {
    if (token) {
      setPage(0);
    }
  }, [
    filterValues.transactionType,
    filterValues.selectedAccount,
    filterValues.selectedCategories,
    filterValues.includeTags,
    filterValues.excludeTags,
    filterValues.startDate,
    filterValues.endDate,
    reviewStatus,
    sortBy,
    sortOrder,
    filterValues.searchQuery,
    token,
  ]);

  // Fetch transactions when page, rowsPerPage, or any filter changes
  useEffect(() => {
    if (!token) return;

    // Debounce only for search query to avoid excessive API calls while typing
    const debounceTimer = setTimeout(
      () => {
        fetchTransactions();
      },
      filterValues.searchQuery ? 500 : 0
    ); // Debounce search, immediate for other filters

    return () => clearTimeout(debounceTimer);
  }, [
    page,
    rowsPerPage,
    filterValues.transactionType,
    filterValues.selectedAccount,
    filterValues.selectedCategories,
    filterValues.includeTags,
    filterValues.excludeTags,
    filterValues.startDate,
    filterValues.endDate,
    reviewStatus,
    sortBy,
    sortOrder,
    filterValues.searchQuery,
    filterValues.minAmount,
    filterValues.maxAmount,
    token,
  ]);

  const fetchTransactions = async () => {
    try {
      const params: any = {
        sortBy,
        sortOrder,
        limit: rowsPerPage.toString(),
        skip: (page * rowsPerPage).toString(),
      };

      if (filterValues.searchQuery) params.search = filterValues.searchQuery;
      if (filterValues.transactionType && filterValues.transactionType !== 'all')
        params.type = filterValues.transactionType;
      if (filterValues.selectedAccount) params.accountId = filterValues.selectedAccount;
      if (filterValues.minAmount) params.minAmount = filterValues.minAmount;
      if (filterValues.maxAmount) params.maxAmount = filterValues.maxAmount;
      if (filterValues.selectedCategories && filterValues.selectedCategories.length > 0) {
        // Expand folders to category IDs before sending to backend
        const expandedCategoryIds = new Set<string>();

        const getAllDescendants = (folderId: string): string[] => {
          const descendants: string[] = [];
          const children = categories.filter((c: Category) => c.parentId === folderId);

          children.forEach((child: Category) => {
            if (child.isFolder) {
              descendants.push(...getAllDescendants(child.id));
            } else {
              descendants.push(child.id);
            }
          });

          return descendants;
        };

        filterValues.selectedCategories.forEach((catId) => {
          const cat = categories.find((c: Category) => c.id === catId);
          if (cat?.isFolder) {
            getAllDescendants(cat.id).forEach((id) => expandedCategoryIds.add(id));
          } else {
            expandedCategoryIds.add(catId);
          }
        });

        params.categoryIds = Array.from(expandedCategoryIds).join(',');
      }
      if (filterValues.includeTags && filterValues.includeTags.length > 0)
        params.includeTags = filterValues.includeTags.join(',');
      if (filterValues.excludeTags && filterValues.excludeTags.length > 0)
        params.excludeTags = filterValues.excludeTags.join(',');
      if (filterValues.startDate)
        params.startDate = filterValues.startDate.startOf('day').toISOString();
      if (filterValues.endDate) params.endDate = filterValues.endDate.endOf('day').toISOString();
      if (reviewStatus !== 'all') params.reviewStatus = reviewStatus;
      params.includeSplits = 'true'; // Always fetch splits

      const response = await api.get('/api/transactions', params);

      setTransactions(response.data?.transactions || []);
      setTotalCount(response.data?.pagination?.total || 0);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      toast.error(err.message || 'Failed to fetch transactions');
      setTransactions([]); // Set empty array on error
    }
  };

  const fetchPendingCount = async () => {
    try {
      const response = await api.get('/api/transactions/pending/count');
      setPendingCount(response.count || 0);
    } catch (err: any) {
      console.error('Failed to fetch pending count:', err);
      setPendingCount(0);
    }
  };

  const fetchMerchantsAndRecentCategories = async () => {
    try {
      // Fetch unique merchants from transactions
      const txnResponse = await api.get('/api/transactions', {
        limit: '1000',
        sortBy: 'date',
        sortOrder: 'desc',
      });

      const txns = txnResponse.data?.transactions || [];

      // Extract unique merchants
      const uniqueMerchants = [
        ...new Set(
          txns
            .map((t: Transaction) => t.merchantName)
            .filter((m: string | undefined) => m && m.trim())
        ),
      ] as string[];
      setMerchants(uniqueMerchants);

      // Extract recent categories (most used in last 30 days)
      const recentTxns = txns.slice(0, 100); // Last 100 transactions
      const categoryCounts: Record<string, number> = {};

      recentTxns.forEach((t: Transaction) => {
        if (t.splits && t.splits.length > 0) {
          t.splits.forEach((s: TransactionSplit) => {
            categoryCounts[s.categoryId] = (categoryCounts[s.categoryId] || 0) + 1;
          });
        } else if (t.categoryId) {
          categoryCounts[t.categoryId] = (categoryCounts[t.categoryId] || 0) + 1;
        }
      });

      // Sort by frequency and take top 5
      const topCategories = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([catId]) => catId);

      setRecentCategories(topCategories);
    } catch (err: any) {
      console.error('Failed to fetch merchants/recent categories:', err);
    }
  };

  // Validation: Check if transaction is complete and ready for approval
  const isTransactionComplete = (
    transaction: Transaction
  ): { complete: boolean; missing: string[] } => {
    const missing: string[] = [];

    // Check account
    if (!transaction.accountId) {
      missing.push('Account');
    }

    // Check amount
    if (!transaction.amount || transaction.amount <= 0) {
      missing.push('Amount');
    }

    // Check splits for categories
    if (transaction.splits && transaction.splits.length > 0) {
      const incompleteSplits = transaction.splits.filter((s) => !s.categoryId);
      if (incompleteSplits.length > 0) {
        missing.push(`Category for ${incompleteSplits.length} split(s)`);
      }
    } else {
      // Check legacy categoryId if no splits
      if (!transaction.categoryId) {
        missing.push('Category');
      }
    }

    return {
      complete: missing.length === 0,
      missing,
    };
  };

  const changeTransactionStatus = async (
    id: string,
    status: 'pending' | 'approved' | 'rejected',
    reason?: string
  ) => {
    try {
      await api.patch(`/api/transactions/${id}/status`, { status, reason });
      return true;
    } catch (error: any) {
      console.error('Error changing transaction status:', error);
      toast.error(error.response?.data?.message || 'Failed to change transaction status');
      return false;
    }
  };

  const handleApprove = async (id: string) => {
    try {
      // Find the transaction
      const transaction = transactions.find((t) => t.id === id);
      if (!transaction) {
        toast.error('Transaction not found');
        return;
      }

      // Validate if transaction is complete
      const validation = isTransactionComplete(transaction);

      if (!validation.complete) {
        // Open edit dialog with approve mode
        setApproveMode(true);
        handleOpenDialog(transaction);
        toast.warning(`Please complete: ${validation.missing.join(', ')}`);
        return;
      }

      // Transaction is complete, proceed with approval
      await api.patch(`/api/transactions/${id}/approve`, {});
      toast.success('Transaction approved');
      await fetchTransactions();
      await fetchPendingCount();
    } catch (error: any) {
      console.error('Error approving transaction:', error);
      toast.error(error.response?.data?.message || 'Failed to approve transaction');
    }
  };

  const handleReject = async (id: string) => {
    try {
      // Clear any existing undo timeout
      if (undoRejectInfo) {
        clearTimeout(undoRejectInfo.timeoutId);
      }

      await api.patch(`/api/transactions/${id}/reject`, {});

      await fetchTransactions();
      await fetchPendingCount();

      // Show undo toast with 5 second timeout
      const timeoutId = window.setTimeout(() => {
        setUndoRejectInfo(null);
      }, 5000);

      setUndoRejectInfo({ transactionId: id, timeoutId });

      // Note: Snackbar with undo button is rendered at the bottom of the component
    } catch (error: any) {
      console.error('Error rejecting transaction:', error);
      toast.error(error.response?.data?.message || 'Failed to reject transaction');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedTransactions.size === 0) {
      toast.error('No transactions selected');
      return;
    }

    // Validate selected transactions
    const selectedTxns = transactions.filter((t) => selectedTransactions.has(t.id));
    const incompleteTransactions = selectedTxns.filter((t) => !isTransactionComplete(t).complete);

    if (incompleteTransactions.length > 0) {
      const proceed = window.confirm(
        `${incompleteTransactions.length} of ${selectedTransactions.size} transactions are incomplete and cannot be approved.\n\n` +
          `Complete transactions: ${selectedTxns.length - incompleteTransactions.length}\n` +
          `Incomplete transactions: ${incompleteTransactions.length}\n\n` +
          `Do you want to approve only the complete transactions?`
      );

      if (!proceed) {
        return;
      }

      // Filter to only complete transactions
      const completeTransactionIds = selectedTxns
        .filter((t) => isTransactionComplete(t).complete)
        .map((t) => t.id);

      if (completeTransactionIds.length === 0) {
        toast.error('All selected transactions are incomplete. Please complete them first.');
        return;
      }

      try {
        await api.post('/api/transactions/bulk-approve', {
          transactionIds: completeTransactionIds,
        });
        toast.success(
          `${completeTransactionIds.length} transactions approved. ` +
            `${incompleteTransactions.length} skipped (incomplete).`
        );
        setSelectedTransactions(new Set());
        await fetchTransactions();
        await fetchPendingCount();
      } catch (error: any) {
        console.error('Error bulk approving:', error);
        toast.error(error.response?.data?.message || 'Failed to approve transactions');
      }

      return;
    }

    // All transactions are complete, proceed normally
    try {
      await api.post('/api/transactions/bulk-approve', {
        transactionIds: Array.from(selectedTransactions),
      });
      toast.success(`${selectedTransactions.size} transactions approved`);
      setSelectedTransactions(new Set());
      await fetchTransactions();
      await fetchPendingCount();
    } catch (error: any) {
      console.error('Error bulk approving:', error);
      toast.error(error.response?.data?.message || 'Failed to approve transactions');
    }
  };

  const handleImportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setImportMenuAnchor(event.currentTarget);
  }, []);

  const handleImportMenuClose = useCallback(() => {
    setImportMenuAnchor(null);
  }, []);

  const handleSMSImport = useCallback(() => {
    handleImportMenuClose();
    setSmsImportOpen(true);
  }, [handleImportMenuClose]);

  const handleEmailImport = useCallback(() => {
    handleImportMenuClose();
    setEmailImportOpen(true);
  }, [handleImportMenuClose]);

  const handleImportSuccess = useCallback(async () => {
    await fetchTransactions();

    toast.success('Transactions imported successfully');
  }, [fetchTransactions, toast]);

  const handleOpenDialog = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      // Initialize splits from transaction data
      const splits =
        transaction.splits && transaction.splits.length > 0
          ? transaction.splits
          : [
              {
                categoryId: transaction.categoryId || '',
                amount: transaction.amount,
                tags: transaction.tags || [],
                notes: '',
                order: 1,
              },
            ];

      // Determine if we should use split mode
      const shouldUseSplitMode = splits.length > 1;
      setUseSplitMode(shouldUseSplitMode);

      // For Quick Add mode (single split), use the category from the first split
      const categoryId = splits.length > 0 ? splits[0].categoryId : transaction.categoryId || '';
      const tags = splits.length > 0 ? splits[0].tags : transaction.tags || [];

      setFormData({
        type: transaction.type,
        amount: transaction.amount.toString(),
        accountId: transaction.accountId,
        categoryId: categoryId,
        description: transaction.description,
        tags: tags,
        splits: splits,
        date: dayjs(transaction.date).format('YYYY-MM-DD'),
        merchantName: transaction.merchantName || '',
        isRecurring: transaction.isRecurring,
        recurrencePattern: (transaction.recurrencePattern as any)?.frequency || 'monthly',
        recurrenceDay: (transaction.recurrencePattern as any)?.day || new Date().getDate(),
        recurrenceEndDate: (transaction.recurrencePattern as any)?.endDate || '',
      });
    } else {
      setEditingTransaction(null);
      setUseSplitMode(false); // Default to quick add mode
      const defaultTag = 'expense';
      setFormData({
        type: 'debit',
        amount: '',
        accountId: accounts.find((a: Account) => a.isDefault)?.id || '',
        categoryId: '',
        description: '',
        tags: [defaultTag],
        splits: [
          {
            categoryId: '',
            amount: 0,
            tags: [defaultTag],
            notes: '',
            order: 1,
          },
        ],
        date: dayjs().format('YYYY-MM-DD'),
        merchantName: '',
        isRecurring: false,
        recurrencePattern: 'monthly',
        recurrenceDay: new Date().getDate(),
        recurrenceEndDate: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTransaction(null);
    setApproveMode(false); // Reset approve mode
  };

  const handleTypeChange = (newType: 'credit' | 'debit') => {
    const oldTag = formData.type === 'debit' ? 'expense' : 'income';
    const newTag = newType === 'debit' ? 'expense' : 'income';

    // Remove old auto-tag and add new one for Quick Add mode tags
    const updatedTags = formData.tags.filter((tag) => tag !== oldTag && tag !== newTag);
    updatedTags.push(newTag);

    // Update all split tags as well (replace old default tag with new one)
    const updatedSplits = formData.splits.map((split) => ({
      ...split,
      tags: [...split.tags.filter((tag) => tag !== oldTag && tag !== newTag), newTag],
    }));

    setFormData({
      ...formData,
      type: newType,
      tags: updatedTags,
      splits: updatedSplits,
    });
  };

  const handleSubmit = async () => {
    try {
      const amount = parseFloat(formData.amount);

      // Prepare splits for submission
      const splits = formData.splits.map((split, index) => ({
        categoryId: split.categoryId,
        amount: split.amount,
        tags: split.tags,
        notes: split.notes || '',
        order: index + 1,
      }));

      // In quick add mode, ensure the single split amount matches total
      if (!useSplitMode && splits.length === 1) {
        splits[0].amount = amount;
      }

      // Validate splits sum equals total in split mode
      if (useSplitMode) {
        const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
        if (Math.abs(splitTotal - amount) > 0.01) {
          toast.error('Split amounts must equal the total transaction amount');
          return;
        }
      }

      const payload: any = {
        type: formData.type,
        amount: amount,
        accountId: formData.accountId,
        description: formData.description,
        date: formData.date,
        merchantName: formData.merchantName,
        isRecurring: formData.isRecurring,
        reviewStatus: editingTransaction ? editingTransaction.reviewStatus : 'approved',
        splits: splits,
      };

      // Add recurrence pattern if recurring
      if (formData.isRecurring) {
        payload.recurrencePattern = {
          frequency: formData.recurrencePattern,
          day: formData.recurrenceDay,
          endDate: formData.recurrenceEndDate || undefined,
        };
      }

      if (editingTransaction) {
        await updateTransaction.mutateAsync({ id: editingTransaction.id, data: payload });

        // If in approve mode, also approve the transaction after saving
        if (approveMode) {
          await api.patch(`/api/transactions/${editingTransaction.id}/approve`, {});
          toast.success('Transaction completed and approved');
        } else {
          toast.success('Transaction updated successfully');
        }
      } else {
        await createTransaction.mutateAsync(payload);
        toast.success('Transaction created successfully');
      }

      handleCloseDialog();
      fetchTransactions();
      fetchPendingCount(); // Refresh pending count
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save transaction');
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDelete({ open: true, transactionId: id });
  };

  const handleDelete = async () => {
    if (!confirmDelete.transactionId) return;

    try {
      await deleteTransaction.mutateAsync(confirmDelete.transactionId);

      toast.success('Transaction deleted successfully');
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete transaction');
    } finally {
      setConfirmDelete({ open: false, transactionId: null });
    }
  };

  // Split management functions
  const addSplit = () => {
    // New splits should inherit the default tag based on transaction type
    const defaultTag = formData.type === 'debit' ? 'expense' : 'income';

    const newSplit: TransactionSplit = {
      categoryId: '',
      amount: 0,
      tags: [defaultTag], // Auto-add default tag
      notes: '',
      order: formData.splits.length + 1,
    };
    setFormData({
      ...formData,
      splits: [...formData.splits, newSplit],
    });
  };

  const removeSplit = (index: number) => {
    if (formData.splits.length === 1) return; // Keep at least one split
    const newSplits = formData.splits.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      splits: newSplits,
    });
  };

  const updateSplit = (index: number, field: keyof TransactionSplit, value: any) => {
    const newSplits = [...formData.splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setFormData({
      ...formData,
      splits: newSplits,
    });
  };

  const getSplitTotal = () => {
    return formData.splits.reduce((sum, split) => sum + split.amount, 0);
  };

  const getRemainingAmount = () => {
    const total = parseFloat(formData.amount) || 0;
    return total - getSplitTotal();
  };

  // Auto-fill split amounts
  const distributeEqually = () => {
    const total = parseFloat(formData.amount) || 0;
    const splitCount = formData.splits.length;
    if (splitCount === 0) return;

    const amountPerSplit = total / splitCount;
    const newSplits = formData.splits.map((split) => ({
      ...split,
      amount: Math.round(amountPerSplit * 100) / 100, // Round to 2 decimals
    }));

    // Adjust last split to account for rounding
    const distributedTotal = newSplits.reduce((sum, s) => sum + s.amount, 0);
    const diff = total - distributedTotal;
    if (diff !== 0 && newSplits.length > 0) {
      newSplits[newSplits.length - 1].amount += diff;
    }

    setFormData({ ...formData, splits: newSplits });
  };

  const fillRemaining = (index: number) => {
    const remaining = getRemainingAmount();
    if (remaining <= 0) return;

    const newSplits = [...formData.splits];
    newSplits[index] = { ...newSplits[index], amount: (newSplits[index].amount || 0) + remaining };
    setFormData({ ...formData, splits: newSplits });
  };

  // Smart date setters
  const setDateToToday = () => {
    setFormData({ ...formData, date: dayjs().format('YYYY-MM-DD') });
  };

  const setDateToYesterday = () => {
    setFormData({ ...formData, date: dayjs().subtract(1, 'day').format('YYYY-MM-DD') });
  };

  const setDateToStartOfMonth = () => {
    setFormData({ ...formData, date: dayjs().startOf('month').format('YYYY-MM-DD') });
  };

  // Merchant selection with category suggestion
  const handleMerchantSelect = (merchantName: string) => {
    // Find most common category for this merchant
    const merchantTransactions = transactions.filter(
      (t) => t.merchantName?.toLowerCase() === merchantName.toLowerCase()
    );

    if (merchantTransactions.length > 0) {
      const categoryCounts: Record<string, number> = {};

      merchantTransactions.forEach((t) => {
        if (t.splits && t.splits.length > 0) {
          t.splits.forEach((s) => {
            categoryCounts[s.categoryId] = (categoryCounts[s.categoryId] || 0) + 1;
          });
        } else if (t.categoryId) {
          categoryCounts[t.categoryId] = (categoryCounts[t.categoryId] || 0) + 1;
        }
      });

      // Get most common category
      const suggestedCategoryId = Object.entries(categoryCounts).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0];

      if (suggestedCategoryId && !formData.categoryId) {
        setFormData({
          ...formData,
          merchantName,
          categoryId: suggestedCategoryId,
          splits: [
            {
              ...formData.splits[0],
              categoryId: suggestedCategoryId,
            },
          ],
        });
        toast.success(`Category suggested based on "${merchantName}" history`);
      } else {
        setFormData({ ...formData, merchantName });
      }
    } else {
      setFormData({ ...formData, merchantName });
    }
  };

  // Smart tag suggestion based on category
  const handleCategoryChange = (categoryId: string, splitIndex?: number) => {
    const category = categories.find((c: Category) => c.id === categoryId);
    if (!category) return;

    const categoryNameLower = category.name.toLowerCase();
    const suggestion = CATEGORY_TAG_SUGGESTIONS[categoryNameLower];

    if (suggestion) {
      // For Quick Add mode (no splitIndex)
      if (splitIndex === undefined) {
        const currentTags = formData.tags || [];
        const updatedTags = [
          ...currentTags.filter((tag) => !suggestion.removeTags.includes(tag)),
          ...suggestion.suggestedTags.filter((tag) => !currentTags.includes(tag)),
        ];

        setFormData({
          ...formData,
          categoryId,
          tags: updatedTags,
          splits: [
            {
              ...formData.splits[0],
              categoryId,
              tags: updatedTags,
            },
          ],
        });

        if (suggestion.suggestedTags.length > 0) {
          toast.success(
            `Added "${suggestion.suggestedTags.join(', ')}" tag${suggestion.suggestedTags.length > 1 ? 's' : ''} for ${category.name}`
          );
        }
      } else {
        // For Split mode
        const currentSplit = formData.splits[splitIndex];
        const currentTags = currentSplit.tags || [];
        const updatedTags = [
          ...currentTags.filter((tag) => !suggestion.removeTags.includes(tag)),
          ...suggestion.suggestedTags.filter((tag) => !currentTags.includes(tag)),
        ];

        updateSplit(splitIndex, 'categoryId', categoryId);
        updateSplit(splitIndex, 'tags', updatedTags);

        if (suggestion.suggestedTags.length > 0) {
          toast.success(
            `Added "${suggestion.suggestedTags.join(', ')}" tag${suggestion.suggestedTags.length > 1 ? 's' : ''} for ${category.name}`
          );
        }
      }
    } else {
      // No suggestion, just update category
      if (splitIndex === undefined) {
        setFormData({
          ...formData,
          categoryId,
          splits: [
            {
              ...formData.splits[0],
              categoryId,
            },
          ],
        });
      } else {
        updateSplit(splitIndex, 'categoryId', categoryId);
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!openDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }

      // Ctrl+S or Cmd+S to toggle split mode
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setUseSplitMode(!useSplitMode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openDialog, useSplitMode, formData]);

  const toggleRowExpansion = (transactionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedRows(newExpanded);
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;
    if (!window.confirm(`Delete ${selectedTransactions.size} selected transactions?`)) return;

    try {
      // api.delete doesn't support data parameter, use POST for bulk delete
      await api.post('/api/transactions/bulk-delete', { ids: Array.from(selectedTransactions) });

      toast.success(`${selectedTransactions.size} transactions deleted`);
      setSelectedTransactions(new Set());
      setSelectAll(false);
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete transactions');
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Type',
      'Account',
      'Description',
      'Category',
      'Split Amount',
      'Tags',
      'Status',
      'Total Amount',
    ];

    // Each split becomes a separate row (industry standard)
    const rows: string[][] = [];
    transactions.forEach((t) => {
      const splits =
        t.splits && t.splits.length > 0
          ? t.splits
          : [{ categoryId: t.categoryId || '', amount: t.amount, tags: t.tags || [] }];

      splits.forEach((split) => {
        rows.push([
          dayjs(t.date).format('YYYY-MM-DD'),
          t.type.toUpperCase(),
          getAccountName(t.accountId),
          t.description,
          getCategoryName(split.categoryId),
          split.amount.toFixed(2),
          split.tags?.join('; ') || '',
          t.reviewStatus,
          t.amount.toFixed(2),
        ]);
      });
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map((t) => t.id)));
    }
    setSelectAll(!selectAll);
  }, [selectAll, transactions]);

  const handleSelectTransaction = useCallback(
    (id: string) => {
      const newSelected = new Set(selectedTransactions);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedTransactions(newSelected);
      setSelectAll(newSelected.size === transactions.length);
    },
    [selectedTransactions, transactions.length]
  );

  const clearFilters = () => {
    setFilterValues({
      searchQuery: '',
      transactionType: 'all',
      selectedAccount: '',
      selectedCategories: [],
      includeTags: [],
      excludeTags: [],
      minAmount: '',
      maxAmount: '',
      amountQuickFilter: 'any',
      startDate: dayjs().startOf('month'),
      endDate: dayjs().endOf('month'),
      activeDateFilter: 'thisMonth',
    });
    setReviewStatus('all');
    setPage(0); // Reset to first page
  };

  const getAccountName = (accountId: string) => {
    return accounts.find((a: Account) => a.id === accountId)?.name || 'Unknown';
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Uncategorized';
    return categories.find((c: Category) => c.id === categoryId)?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId?: string) => {
    if (!categoryId) return '#999999';
    return categories.find((c: Category) => c.id === categoryId)?.color || '#667eea';
  };

  const formatCurrency = useCallback(
    (amount: number, accountId: string) => {
      const account = accounts.find((a: Account) => a.id === accountId);
      const currency = account?.currency || user?.currency || 'USD';
      return formatCurrencyUtil(amount, currency);
    },
    [accounts, user?.currency]
  );

  const formatUserCurrency = useCallback(
    (amount: number) => {
      return formatCurrencyUtil(amount, user?.currency || 'USD');
    },
    [user?.currency]
  );

  if (loading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Transactions</Typography>
        </Box>
        <TableSkeleton rows={10} />
      </Box>
    );
  }

  // Summary cards should ONLY show approved transactions for accurate financial position
  // This follows industry standard: list is flexible, but totals are always accurate
  // Also exclude investment/transfer/savings tags from totals

  const shouldExcludeFromExpenses = (t: Transaction): boolean => {
    if (t.splits && t.splits.length > 0) {
      return t.splits.some((split) =>
        split.tags?.some((tag) => EXPENSE_EXCLUDE_TAGS.includes(tag.toLowerCase()))
      );
    }
    return t.tags?.some((tag) => EXPENSE_EXCLUDE_TAGS.includes(tag.toLowerCase())) || false;
  };

  const shouldExcludeFromIncome = (t: Transaction): boolean => {
    if (t.splits && t.splits.length > 0) {
      return t.splits.some((split) =>
        split.tags?.some((tag) => INCOME_EXCLUDE_TAGS.includes(tag.toLowerCase()))
      );
    }
    return t.tags?.some((tag) => INCOME_EXCLUDE_TAGS.includes(tag.toLowerCase())) || false;
  };

  const totalCredits = transactions
    .filter(
      (t) => t.type === 'credit' && t.reviewStatus === 'approved' && !shouldExcludeFromIncome(t)
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = transactions
    .filter(
      (t) => t.type === 'debit' && t.reviewStatus === 'approved' && !shouldExcludeFromExpenses(t)
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const netAmount = totalCredits - totalDebits;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        {/* Enhanced Header */}
        <Box
          sx={{
            mb: 4,
            p: 3,
            borderRadius: 3,
            background: (theme) =>
              theme.palette.mode === 'light'
                ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`
                : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.dark} 100%)`,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: (theme) => `0 4px 20px ${theme.palette.primary.main}33`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)',
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
              display="flex"
              justifyContent="space-between"
              alignItems="flex-start"
              flexWrap="wrap"
              gap={2}
            >
              <Box>
                <Typography
                  variant="h4"
                  gutterBottom
                  sx={{
                    fontWeight: 800,
                    color: 'white',
                    letterSpacing: '-0.02em',
                    textShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  Transactions
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500 }}
                >
                  {transactions.length} this month
                  {transactions.length > 0 && transactions[0] && (
                    <>
                      {' '}
                      • Last: {transactions[0].description || 'Untitled'}{' '}
                      {formatUserCurrency(transactions[0].amount)} •{' '}
                      {new Date(transactions[0].date).toLocaleDateString()}
                    </>
                  )}
                </Typography>
              </Box>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={<ImportIcon sx={{ display: { xs: 'none', sm: 'inline' } }} />}
                  onClick={handleImportMenuOpen}
                  size="small"
                  sx={{
                    minWidth: { xs: 80, sm: 'auto' },
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.3)',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.5)',
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  {isMobile ? 'Import' : 'Import'}
                </Button>
                <Menu
                  anchorEl={importMenuAnchor}
                  open={Boolean(importMenuAnchor)}
                  onClose={handleImportMenuClose}
                >
                  <MenuItem onClick={handleSMSImport}>
                    <SmsIcon fontSize="small" sx={{ mr: 1 }} />
                    Import from SMS
                  </MenuItem>
                  <MenuItem onClick={handleEmailImport}>
                    <EmailIcon fontSize="small" sx={{ mr: 1 }} />
                    Import from Email
                  </MenuItem>
                </Menu>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon sx={{ display: { xs: 'none', sm: 'inline' } }} />}
                  onClick={handleExportCSV}
                  disabled={transactions.length === 0}
                  size="small"
                  sx={{
                    minWidth: { xs: 80, sm: 'auto' },
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.3)',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.5)',
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                    '&.Mui-disabled': {
                      color: 'rgba(255,255,255,0.3)',
                      borderColor: 'rgba(255,255,255,0.2)',
                    },
                  }}
                >
                  Export
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                  size="small"
                  sx={{
                    minWidth: { xs: 80, sm: 'auto' },
                    bgcolor: 'white',
                    color: 'primary.main',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      bgcolor: 'rgba(255,255,255,0.95)',
                    },
                  }}
                >
                  Add
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} mb={3}>
          <Grid size={{ md: 4, xs: 12 }}>
            <Card
              sx={{
                background: (theme) => theme.palette.gradient.success,
                color: 'white',
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-6px)',
                  boxShadow: '0 12px 32px rgba(16, 185, 129, 0.35)',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                },
              }}
            >
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem',
                    }}
                  >
                    Total Credits
                  </Typography>
                  <CreditIcon sx={{ opacity: 0.7 }} />
                </Box>
                <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                  {formatUserCurrency(totalCredits)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ md: 4, xs: 12 }}>
            <Card
              sx={{
                background: (theme) => theme.palette.gradient.error,
                color: 'white',
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-6px)',
                  boxShadow: '0 12px 32px rgba(239, 68, 68, 0.35)',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                },
              }}
            >
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem',
                    }}
                  >
                    Total Debits
                  </Typography>
                  <DebitIcon sx={{ opacity: 0.7 }} />
                </Box>
                <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                  {formatUserCurrency(totalDebits)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ md: 4, xs: 12 }}>
            <Card
              sx={{
                background: (theme) =>
                  netAmount >= 0
                    ? theme.palette.gradient.info
                    : 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                color: 'white',
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                boxShadow:
                  netAmount >= 0
                    ? '0 4px 20px rgba(59, 130, 246, 0.25)'
                    : '0 4px 20px rgba(249, 115, 22, 0.25)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-6px)',
                  boxShadow:
                    netAmount >= 0
                      ? '0 12px 32px rgba(59, 130, 246, 0.35)'
                      : '0 12px 32px rgba(249, 115, 22, 0.35)',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                },
              }}
            >
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem',
                    }}
                  >
                    Net Amount
                  </Typography>
                  <AccountBalanceWallet sx={{ opacity: 0.7 }} />
                </Box>
                <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                  {formatUserCurrency(Math.abs(netAmount))}
                  {netAmount < 0 && ' deficit'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Review Status Filter and Search/Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box
              display="flex"
              gap={1.5}
              alignItems="center"
              flexWrap="wrap"
              justifyContent="space-between"
            >
              <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
                <Chip
                  label="All"
                  onClick={() => setReviewStatus('all')}
                  color={reviewStatus === 'all' ? 'primary' : 'default'}
                  variant={reviewStatus === 'all' ? 'filled' : 'outlined'}
                  size="medium"
                  sx={{
                    fontWeight: reviewStatus === 'all' ? 600 : 400,
                    fontSize: '0.875rem',
                    height: 32,
                  }}
                />
                <Chip
                  icon={<PendingIcon fontSize="small" />}
                  label={`Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
                  onClick={() => {
                    setReviewStatus('pending');
                    setFilterValues((prev) => ({
                      ...prev,
                      startDate: null,
                      endDate: null,
                      activeDateFilter: '',
                    }));
                  }}
                  color={reviewStatus === 'pending' ? 'warning' : 'default'}
                  variant={reviewStatus === 'pending' ? 'filled' : 'outlined'}
                  size="medium"
                  sx={{
                    fontWeight: reviewStatus === 'pending' ? 600 : 400,
                    fontSize: '0.875rem',
                    height: 32,
                    '& .MuiChip-label': {
                      fontWeight: pendingCount > 0 ? 600 : 400,
                    },
                  }}
                />
                <Chip
                  icon={<ApproveIcon fontSize="small" />}
                  label="Approved"
                  onClick={() => setReviewStatus('approved')}
                  color={reviewStatus === 'approved' ? 'success' : 'default'}
                  variant={reviewStatus === 'approved' ? 'filled' : 'outlined'}
                  size="medium"
                  sx={{
                    fontWeight: reviewStatus === 'approved' ? 600 : 400,
                    fontSize: '0.875rem',
                    height: 32,
                  }}
                />
                <Chip
                  icon={<RejectedIcon fontSize="small" />}
                  label="Rejected"
                  onClick={() => setReviewStatus('rejected')}
                  color={reviewStatus === 'rejected' ? 'error' : 'default'}
                  variant={reviewStatus === 'rejected' ? 'filled' : 'outlined'}
                  size="medium"
                  sx={{
                    fontWeight: reviewStatus === 'rejected' ? 600 : 400,
                    fontSize: '0.875rem',
                    height: 32,
                  }}
                />
              </Box>

              <Box display="flex" gap={1.5} alignItems="center">
                <TextField
                  placeholder="Search transactions..."
                  value={filterValues.searchQuery || ''}
                  onChange={(e) =>
                    setFilterValues((prev) => ({ ...prev, searchQuery: e.target.value }))
                  }
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ minWidth: 250 }}
                />
                <FilterPanel
                  config={{
                    showSearch: false,
                    showTransactionType: true,
                    showAccount: true,
                    showCategories: true,
                    showDateRange: true,
                    showQuickDatePresets: true,
                    showTags: true,
                    showAmountRange: true,
                    collapsible: true,
                    defaultExpanded: false,
                    inline: true,
                  }}
                  values={filterValues}
                  onChange={setFilterValues}
                  accounts={accounts}
                  categories={categories}
                  tags={tags}
                  currencySymbol={currencySymbol}
                  onClearAll={clearFilters}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedTransactions.size > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
                <Chip
                  label={`${selectedTransactions.size} selected`}
                  color="primary"
                  variant="filled"
                  onDelete={() => {
                    setSelectedTransactions(new Set());
                    setSelectAll(false);
                  }}
                  size="small"
                  sx={{ fontWeight: 600, fontSize: '0.8125rem', height: 28 }}
                />
                {reviewStatus === 'pending' && (
                  <Button
                    size="small"
                    color="success"
                    variant="contained"
                    startIcon={<ApproveIcon />}
                    onClick={handleBulkApprove}
                    sx={{ fontSize: '0.875rem', minHeight: 32 }}
                  >
                    Approve
                  </Button>
                )}
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={handleBulkDelete}
                  sx={{ fontSize: '0.875rem', minHeight: 32 }}
                >
                  Delete
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Transactions - Table for desktop, Cards for mobile */}
        {isMobile ? (
          // Mobile Card View with Pull-to-Refresh
          <PullToRefresh onRefresh={async () => await fetchTransactions()}>
            <Box>
              {transactions.length === 0 ? (
                <EmptyState
                  icon={<ReceiptIcon />}
                  title="No transactions found"
                  description="Start tracking your finances by adding your first transaction"
                  actionLabel="Add Transaction"
                  onAction={() => handleOpenDialog()}
                />
              ) : (
                <>
                  {transactions.map((transaction) => {
                    const CardComponent = isTouchDevice
                      ? SwipeableTransactionCard
                      : TransactionCard;
                    const isPending = transaction.reviewStatus === 'pending';
                    const isRejected = transaction.reviewStatus === 'rejected';
                    const validation = isPending
                      ? isTransactionComplete(transaction)
                      : { complete: true, missing: [] };

                    return (
                      <Box key={transaction.id} sx={{ position: 'relative' }}>
                        {isPending && !validation.complete && (
                          <Chip
                            label={`Incomplete: ${validation.missing.join(', ')}`}
                            color="warning"
                            size="small"
                            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                          />
                        )}
                        <CardComponent
                          transaction={transaction}
                          onEdit={() => handleOpenDialog(transaction)}
                          onDelete={() => handleDeleteClick(transaction.id)}
                          formatCurrency={(amount) => formatCurrency(amount, transaction.accountId)}
                          getCategoryName={getCategoryName}
                          getCategoryColor={getCategoryColor}
                          getAccountName={getAccountName}
                          isExpanded={expandedRows.has(transaction.id)}
                          onToggleExpand={() => toggleRowExpansion(transaction.id)}
                        />
                        {isPending && (
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 1,
                              mt: 1,
                              px: 2,
                              pb: 2,
                            }}
                          >
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<ApproveIcon />}
                              onClick={() => handleApprove(transaction.id)}
                              fullWidth
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<RejectIcon />}
                              onClick={() => handleReject(transaction.id)}
                              fullWidth
                            >
                              Reject
                            </Button>
                          </Box>
                        )}
                        {isRejected && (
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 1,
                              mt: 1,
                              px: 2,
                              pb: 2,
                            }}
                          >
                            <Button
                              variant="contained"
                              color="warning"
                              size="small"
                              startIcon={<ApproveIcon />}
                              onClick={async () => {
                                const success = await changeTransactionStatus(
                                  transaction.id,
                                  'pending'
                                );
                                if (success) {
                                  toast.success('Transaction restored to pending');
                                  await fetchTransactions();
                                  await fetchPendingCount();
                                }
                              }}
                              fullWidth
                            >
                              Restore to Pending
                            </Button>
                            <Button
                              variant="outlined"
                              color="success"
                              size="small"
                              startIcon={<ApproveIcon />}
                              onClick={async () => {
                                const success = await changeTransactionStatus(
                                  transaction.id,
                                  'approved'
                                );
                                if (success) {
                                  toast.success('Transaction approved');
                                  await fetchTransactions();
                                  await fetchPendingCount();
                                }
                              }}
                              fullWidth
                            >
                              Approve Anyway
                            </Button>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                  <TablePagination
                    component="div"
                    count={totalCount}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                  />
                </>
              )}
            </Box>
          </PullToRefresh>
        ) : (
          // Desktop Table View
          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectAll}
                        onChange={handleSelectAll}
                        disabled={transactions.length === 0}
                      />
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell
                      sx={{
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover .sort-icon': { opacity: 1 },
                      }}
                      onClick={() => {
                        if (sortBy === 'date') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('date');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Date
                        {sortBy === 'date' ? (
                          sortOrder === 'desc' ? (
                            <ArrowDownwardIcon fontSize="small" />
                          ) : (
                            <ArrowUpwardIcon fontSize="small" />
                          )
                        ) : (
                          <UnfoldMoreIcon
                            fontSize="small"
                            className="sort-icon"
                            sx={{ opacity: 0, color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover .sort-icon': { opacity: 1 },
                      }}
                      onClick={() => {
                        if (sortBy === 'type') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('type');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Type
                        {sortBy === 'type' ? (
                          sortOrder === 'desc' ? (
                            <ArrowDownwardIcon fontSize="small" />
                          ) : (
                            <ArrowUpwardIcon fontSize="small" />
                          )
                        ) : (
                          <UnfoldMoreIcon
                            fontSize="small"
                            className="sort-icon"
                            sx={{ opacity: 0, color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover .sort-icon': { opacity: 1 },
                      }}
                      onClick={() => {
                        if (sortBy === 'description') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('description');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Description
                        {sortBy === 'description' ? (
                          sortOrder === 'desc' ? (
                            <ArrowDownwardIcon fontSize="small" />
                          ) : (
                            <ArrowUpwardIcon fontSize="small" />
                          )
                        ) : (
                          <UnfoldMoreIcon
                            fontSize="small"
                            className="sort-icon"
                            sx={{ opacity: 0, color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover .sort-icon': { opacity: 1 },
                      }}
                      onClick={() => {
                        if (sortBy === 'amount') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('amount');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 0.5,
                        }}
                      >
                        Amount
                        {sortBy === 'amount' ? (
                          sortOrder === 'desc' ? (
                            <ArrowDownwardIcon fontSize="small" />
                          ) : (
                            <ArrowUpwardIcon fontSize="small" />
                          )
                        ) : (
                          <UnfoldMoreIcon
                            fontSize="small"
                            className="sort-icon"
                            sx={{ opacity: 0, color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ border: 'none', p: 0 }}>
                        <EmptyState
                          icon={<ReceiptIcon />}
                          title="No transactions found"
                          description="Start tracking your finances by adding your first transaction"
                          actionLabel="Add Transaction"
                          onAction={() => handleOpenDialog()}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => {
                      const isExpanded = expandedRows.has(transaction.id);
                      const hasSplits = transaction.splits && transaction.splits.length > 1;

                      return (
                        <React.Fragment key={transaction.id}>
                          <TableRow
                            hover
                            selected={selectedTransactions.has(transaction.id)}
                            sx={{
                              '& > *': { borderBottom: isExpanded ? 'none !important' : undefined },
                            }}
                          >
                            <TableCell padding="checkbox" sx={{ width: 50 }}>
                              <Checkbox
                                checked={selectedTransactions.has(transaction.id)}
                                onChange={() => handleSelectTransaction(transaction.id)}
                              />
                            </TableCell>
                            <TableCell padding="none" sx={{ width: 48 }}>
                              {hasSplits && (
                                <Tooltip
                                  title={isExpanded ? 'Hide split details' : 'Show split details'}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => toggleRowExpansion(transaction.id)}
                                  >
                                    {isExpanded ? (
                                      <ExpandMoreIcon fontSize="small" />
                                    ) : (
                                      <ChevronRightIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell sx={{ width: 120 }}>
                              {dayjs(transaction.date).format('MMM DD, YYYY')}
                            </TableCell>
                            <TableCell sx={{ width: 100 }}>
                              <Chip
                                icon={
                                  transaction.type === 'credit' ? <CreditIcon /> : <DebitIcon />
                                }
                                label={transaction.type === 'credit' ? 'Credit' : 'Debit'}
                                color={transaction.type === 'credit' ? 'success' : 'error'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {transaction.description}
                                </Typography>
                                {transaction.merchantName && (
                                  <Typography variant="caption" color="text.secondary">
                                    {transaction.merchantName}
                                  </Typography>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                >
                                  {getAccountName(transaction.accountId)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ minWidth: 150, maxWidth: 250 }}>
                              {hasSplits ? (
                                <Box display="flex" gap={0.5} flexWrap="wrap">
                                  {(transaction.splits || []).slice(0, 3).map((split, idx) => (
                                    <Chip
                                      key={idx}
                                      label={getCategoryName(split.categoryId)}
                                      size="small"
                                      sx={{
                                        backgroundColor: `${getCategoryColor(split.categoryId)}20`,
                                        color: getCategoryColor(split.categoryId),
                                      }}
                                    />
                                  ))}
                                  {(transaction.splits || []).length > 3 && (
                                    <Chip
                                      label={`+${(transaction.splits || []).length - 3} more`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                              ) : (
                                <Chip
                                  label={getCategoryName(
                                    transaction.splits?.[0]?.categoryId || transaction.categoryId
                                  )}
                                  size="small"
                                  sx={{
                                    backgroundColor: `${getCategoryColor(transaction.splits?.[0]?.categoryId || transaction.categoryId)}20`,
                                    color: getCategoryColor(
                                      transaction.splits?.[0]?.categoryId || transaction.categoryId
                                    ),
                                  }}
                                />
                              )}
                            </TableCell>
                            <TableCell sx={{ minWidth: 180, maxWidth: 280 }}>
                              <Box display="flex" gap={0.5} flexWrap="wrap" alignItems="center">
                                {transaction.reviewStatus === 'pending' &&
                                  !isTransactionComplete(transaction).complete && (
                                    <Tooltip
                                      title={`Incomplete: ${isTransactionComplete(transaction).missing.join(', ')}`}
                                    >
                                      <Chip
                                        label="⚠"
                                        color="warning"
                                        size="small"
                                        sx={{ fontSize: '0.7rem', minWidth: 24, height: 20 }}
                                      />
                                    </Tooltip>
                                  )}
                                {transaction.splits && transaction.splits.length > 0
                                  ? Array.from(
                                      new Set(transaction.splits.flatMap((s) => s.tags || []))
                                    )
                                      .slice(0, 3)
                                      .map((tag, idx) => (
                                        <Chip
                                          key={idx}
                                          label={tag}
                                          size="small"
                                          variant="outlined"
                                          icon={<TagIcon />}
                                        />
                                      ))
                                  : transaction.tags
                                      ?.slice(0, 3)
                                      .map((tag, idx) => (
                                        <Chip
                                          key={idx}
                                          label={tag}
                                          size="small"
                                          variant="outlined"
                                          icon={<TagIcon />}
                                        />
                                      ))}
                                {transaction.splits &&
                                  Array.from(
                                    new Set(transaction.splits.flatMap((s) => s.tags || []))
                                  ).length > 3 && (
                                    <Chip
                                      label={`+${Array.from(new Set(transaction.splits.flatMap((s) => s.tags || []))).length - 3}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ width: 110 }}>
                              <Chip
                                label={
                                  transaction.reviewStatus
                                    ? transaction.reviewStatus.charAt(0).toUpperCase() +
                                      transaction.reviewStatus.slice(1)
                                    : 'Pending'
                                }
                                size="small"
                                color={
                                  transaction.reviewStatus === 'pending' ||
                                  !transaction.reviewStatus
                                    ? 'warning'
                                    : transaction.reviewStatus === 'approved'
                                      ? 'success'
                                      : 'error'
                                }
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ width: 130 }}>
                              <Typography
                                variant="body2"
                                fontWeight="bold"
                                color={
                                  transaction.type === 'credit' ? 'success.main' : 'error.main'
                                }
                              >
                                {transaction.type === 'credit' ? '+' : '-'}
                                {formatCurrency(transaction.amount, transaction.accountId)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ width: 100 }}>
                              <Box display="flex" gap={0.5} justifyContent="flex-end">
                                {transaction.reviewStatus === 'pending' && (
                                  <>
                                    <Tooltip title="Approve">
                                      <IconButton
                                        size="small"
                                        color="success"
                                        onClick={() => handleApprove(transaction.id)}
                                      >
                                        <ApproveIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Reject">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleReject(transaction.id)}
                                      >
                                        <RejectIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                                {transaction.reviewStatus === 'rejected' && (
                                  <>
                                    <Tooltip title="Restore to Pending">
                                      <IconButton
                                        size="small"
                                        color="warning"
                                        onClick={async () => {
                                          const success = await changeTransactionStatus(
                                            transaction.id,
                                            'pending'
                                          );
                                          if (success) {
                                            toast.success('Transaction restored to pending');
                                            await fetchTransactions();
                                            await fetchPendingCount();
                                          }
                                        }}
                                      >
                                        <RejectIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Approve Anyway">
                                      <IconButton
                                        size="small"
                                        color="success"
                                        onClick={async () => {
                                          const success = await changeTransactionStatus(
                                            transaction.id,
                                            'approved'
                                          );
                                          if (success) {
                                            toast.success('Transaction approved');
                                            await fetchTransactions();
                                            await fetchPendingCount();
                                          }
                                        }}
                                      >
                                        <ApproveIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                                <Tooltip title="Edit">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenDialog(transaction)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteClick(transaction.id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Row for Split Details */}
                          {hasSplits && isExpanded && (
                            <TableRow>
                              <TableCell colSpan={9} sx={{ py: 0, bgcolor: 'action.hover' }}>
                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                  <Box sx={{ py: 2, px: 6 }}>
                                    <Typography
                                      variant="subtitle2"
                                      fontWeight="bold"
                                      gutterBottom
                                      sx={{ mb: 2 }}
                                    >
                                      Split Breakdown
                                    </Typography>
                                    <Grid container spacing={2}>
                                      {(transaction.splits || []).map((split, idx) => (
                                        <Grid size={{ sm: 6, xs: 12, md: 4 }} key={idx}>
                                          <Card variant="outlined" sx={{ p: 2 }}>
                                            <Box
                                              display="flex"
                                              justifyContent="space-between"
                                              alignItems="flex-start"
                                              mb={1}
                                            >
                                              <Chip
                                                label={getCategoryName(split.categoryId)}
                                                size="small"
                                                sx={{
                                                  backgroundColor: `${getCategoryColor(split.categoryId)}20`,
                                                  color: getCategoryColor(split.categoryId),
                                                  fontWeight: 'bold',
                                                }}
                                              />
                                              <Typography
                                                variant="body1"
                                                fontWeight="bold"
                                                color={
                                                  transaction.type === 'credit'
                                                    ? 'success.main'
                                                    : 'error.main'
                                                }
                                              >
                                                {formatCurrency(
                                                  split.amount,
                                                  transaction.accountId
                                                )}
                                              </Typography>
                                            </Box>
                                            {split.tags && split.tags.length > 0 && (
                                              <Box
                                                display="flex"
                                                gap={0.5}
                                                flexWrap="wrap"
                                                mt={1.5}
                                              >
                                                {split.tags.map((tag, tagIdx) => (
                                                  <Chip
                                                    key={tagIdx}
                                                    label={tag}
                                                    size="small"
                                                    variant="outlined"
                                                    icon={<TagIcon />}
                                                  />
                                                ))}
                                              </Box>
                                            )}
                                            {split.notes && (
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                display="block"
                                                mt={1.5}
                                                sx={{ fontStyle: 'italic' }}
                                              >
                                                Note: {split.notes}
                                              </Typography>
                                            )}
                                          </Card>
                                        </Grid>
                                      ))}
                                    </Grid>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Card>
        )}

        {/* Add/Edit Dialog */}
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
                width: '150px',
                height: '150px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                borderRadius: '50%',
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 40, height: 40 }}>
                    {formData.type === 'credit' ? '💰' : '💸'}
                  </Avatar>
                  <Typography variant="h5" fontWeight={700}>
                    {approveMode
                      ? 'Complete Transaction to Approve'
                      : editingTransaction
                        ? 'Edit Transaction'
                        : 'Add Transaction'}
                  </Typography>
                </Box>
                {approveMode && (
                  <Chip label="Approval Required" color="warning" size="small" sx={{ ml: 7 }} />
                )}
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.9, fontStyle: 'italic' }}>
                Ctrl+Enter to save • Ctrl+S to toggle mode
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Credit/Debit Type Toggle */}
              <Box
                sx={{
                  p: 0.5,
                  borderRadius: 3,
                  background: (theme) =>
                    theme.palette.mode === 'light'
                      ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
                      : 'linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(20,20,20,0.8) 100%)',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ToggleButtonGroup
                  value={formData.type}
                  exclusive
                  onChange={(_, value) => value && handleTypeChange(value as 'credit' | 'debit')}
                  fullWidth
                  sx={{
                    '& .MuiToggleButton-root': {
                      border: 'none',
                      borderRadius: 2.5,
                      py: 1.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                      },
                      '&.Mui-selected': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      },
                      '&.Mui-selected.MuiToggleButton-success': {
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        },
                      },
                      '&.Mui-selected.MuiToggleButton-error': {
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="credit" color="success">
                    <CreditIcon sx={{ mr: 1 }} />
                    Credit (Money IN)
                  </ToggleButton>
                  <ToggleButton value="debit" color="error">
                    <DebitIcon sx={{ mr: 1 }} />
                    Debit (Money OUT)
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ sm: 6, xs: 12 }}>
                  <TextField
                    label="Amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    fullWidth
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {formData.accountId
                            ? new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency:
                                  accounts.find((a: Account) => a.id === formData.accountId)
                                    ?.currency ||
                                  user?.currency ||
                                  'USD',
                              })
                                .format(0)
                                .replace(/[\d.,]/g, '')
                            : user?.currency === 'USD'
                              ? '$'
                              : user?.currency === 'EUR'
                                ? '€'
                                : user?.currency === 'GBP'
                                  ? '£'
                                  : user?.currency === 'INR'
                                    ? '₹'
                                    : '$'}
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={{ sm: 6, xs: 12 }}>
                  <Box>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <ModernDatePicker
                        label="Date"
                        value={formData.date ? dayjs(formData.date) : null}
                        onChange={(newValue) => {
                          if (newValue) {
                            setFormData({ ...formData, date: newValue.format('YYYY-MM-DD') });
                          }
                        }}
                        fullWidth
                        required
                      />
                    </LocalizationProvider>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={setDateToToday}
                        sx={{
                          fontSize: '0.7rem',
                          minWidth: 'auto',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1.5,
                          textTransform: 'none',
                          borderColor: (theme) => theme.palette.primary.main,
                          color: (theme) => theme.palette.primary.main,
                          '&:hover': {
                            background: (theme) => theme.palette.primary.main,
                            color: 'white',
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        Today
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={setDateToYesterday}
                        sx={{
                          fontSize: '0.7rem',
                          minWidth: 'auto',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1.5,
                          textTransform: 'none',
                          borderColor: (theme) => theme.palette.primary.main,
                          color: (theme) => theme.palette.primary.main,
                          '&:hover': {
                            background: (theme) => theme.palette.primary.main,
                            color: 'white',
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        Yesterday
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={setDateToStartOfMonth}
                        sx={{
                          fontSize: '0.7rem',
                          minWidth: 'auto',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1.5,
                          textTransform: 'none',
                          borderColor: (theme) => theme.palette.primary.main,
                          color: (theme) => theme.palette.primary.main,
                          '&:hover': {
                            background: (theme) => theme.palette.primary.main,
                            color: 'white',
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        Month Start
                      </Button>
                    </Box>
                  </Box>
                </Grid>

                <Grid size={{ sm: 6, xs: 12 }}>
                  <TextField
                    select
                    label="Account"
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    fullWidth
                    required
                  >
                    {accounts.map((account: Account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    fullWidth
                    required
                  />
                </Grid>

                {/* Split Mode Toggle */}
                <Grid size={{ xs: 12 }}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      background: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
                      border: '1px solid',
                      borderColor: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'rgba(20, 184, 166, 0.2)'
                          : 'rgba(20, 184, 166, 0.3)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Typography variant="body2" fontWeight="600" color="primary">
                        Transaction Mode:
                      </Typography>
                      <Box
                        sx={{
                          p: 0.5,
                          borderRadius: 2,
                          background: (theme) =>
                            theme.palette.mode === 'light'
                              ? 'rgba(255,255,255,0.8)'
                              : 'rgba(0,0,0,0.3)',
                        }}
                      >
                        <ToggleButtonGroup
                          value={useSplitMode}
                          exclusive
                          onChange={(_, value) => {
                            if (value !== null) {
                              setUseSplitMode(value);
                              if (!value) {
                                // Quick add mode - sync first split with form data
                                const amount = parseFloat(formData.amount) || 0;
                                setFormData({
                                  ...formData,
                                  splits: [
                                    {
                                      categoryId: formData.categoryId,
                                      amount: amount,
                                      tags: formData.tags,
                                      notes: '',
                                      order: 1,
                                    },
                                  ],
                                });
                              } else {
                                // Split mode - ensure splits array has at least one entry
                                if (formData.splits.length === 0) {
                                  setFormData({
                                    ...formData,
                                    splits: [
                                      {
                                        categoryId: '',
                                        amount: 0,
                                        tags: [],
                                        notes: '',
                                        order: 1,
                                      },
                                    ],
                                  });
                                }
                              }
                            }
                          }}
                          fullWidth
                          sx={{
                            '& .MuiToggleButton-root': {
                              border: 'none',
                              borderRadius: 1.5,
                              py: 1,
                              textTransform: 'none',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              transition: 'all 0.3s ease',
                              '&.Mui-selected': {
                                background: (theme) => theme.palette.gradient.primary,
                                color: 'white',
                                boxShadow: '0 2px 8px rgba(20, 184, 166, 0.3)',
                                '&:hover': {
                                  background: (theme) => theme.palette.gradient.primary,
                                },
                              },
                            },
                          }}
                        >
                          <ToggleButton value={false}>Quick Add (Single Category)</ToggleButton>
                          <ToggleButton value={true}>Split (Multiple Categories)</ToggleButton>
                        </ToggleButtonGroup>
                      </Box>
                      {useSplitMode && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontStyle: 'italic' }}
                        >
                          💡 Split this transaction across multiple categories
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>

                {/* Simple Mode - Single Category & Tags */}
                {!useSplitMode && (
                  <>
                    <Grid size={{ sm: 6, xs: 12 }}>
                      <Autocomplete
                        options={[
                          ...categories.filter((c: Category) => recentCategories.includes(c.id)),
                          ...categories.filter((c: Category) => !recentCategories.includes(c.id)),
                        ].filter((c: Category) => !c.isFolder)}
                        getOptionLabel={(option) => option.name}
                        value={
                          categories.find((c: Category) => c.id === formData.categoryId) || null
                        }
                        onChange={(_, newValue) => {
                          if (newValue) {
                            handleCategoryChange(newValue.id);
                          } else {
                            setFormData({
                              ...formData,
                              categoryId: '',
                              splits: [
                                {
                                  ...formData.splits[0],
                                  categoryId: '',
                                },
                              ],
                            });
                          }
                        }}
                        groupBy={(option) =>
                          recentCategories.includes(option.id) ? 'Recent' : 'All Categories'
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Category"
                            required
                            placeholder="Select category..."
                          />
                        )}
                        renderOption={(props, option) => (
                          <li {...props}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  bgcolor: option.color || '#667eea',
                                }}
                              />
                              {option.name}
                            </Box>
                          </li>
                        )}
                      />
                    </Grid>

                    <Grid size={{ sm: 6, xs: 12 }}>
                      <Autocomplete
                        multiple
                        freeSolo
                        options={tags.map((t: Tag) => t.name)}
                        value={formData.tags}
                        onChange={(_, value) => {
                          setFormData({ ...formData, tags: value });
                          // Update the single split
                          if (formData.splits.length > 0) {
                            const newSplits = [...formData.splits];
                            newSplits[0] = { ...newSplits[0], tags: value };
                            setFormData({ ...formData, tags: value, splits: newSplits });
                          }
                        }}
                        renderInput={(params) => (
                          <TextField {...params} label="Tags" placeholder="Add tags..." />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              icon={<TagIcon />}
                              label={option}
                              size="small"
                              {...getTagProps({ index })}
                              key={index}
                            />
                          ))
                        }
                      />
                    </Grid>
                  </>
                )}

                {/* Split Mode - Multiple Splits */}
                {useSplitMode && (
                  <Grid size={{ xs: 12 }}>
                    <Box
                      sx={{
                        borderRadius: 3,
                        p: 3,
                        background: (theme) =>
                          theme.palette.mode === 'light'
                            ? 'linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(241, 245, 249, 0.8) 100%)'
                            : 'linear-gradient(135deg, rgba(30, 30, 30, 0.5) 0%, rgba(20, 20, 20, 0.5) 100%)',
                        border: '1px solid',
                        borderColor: 'divider',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 3,
                          flexWrap: 'wrap',
                          gap: 1,
                        }}
                      >
                        <Typography variant="subtitle1" fontWeight="700" color="primary">
                          📊 Split Details
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={distributeEqually}
                            disabled={!formData.amount || formData.splits.length === 0}
                            sx={{
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                              '&:hover': {
                                transform: 'translateY(-1px)',
                              },
                            }}
                          >
                            Distribute Equally
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={addSplit}
                            sx={{
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                              background: (theme) => theme.palette.gradient.primary,
                              '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: 4,
                              },
                            }}
                          >
                            Add Split
                          </Button>
                        </Box>
                      </Box>

                      {formData.splits.map((split, index) => (
                        <Box
                          key={index}
                          sx={{
                            mb: 2,
                            p: 2.5,
                            borderRadius: 2.5,
                            background: (theme) =>
                              theme.palette.mode === 'light'
                                ? 'rgba(255, 255, 255, 0.9)'
                                : 'rgba(40, 40, 40, 0.6)',
                            border: '1px solid',
                            borderColor: (theme) =>
                              theme.palette.mode === 'light'
                                ? 'rgba(0, 0, 0, 0.06)'
                                : 'rgba(255, 255, 255, 0.06)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                              transform: 'translateY(-2px)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              mb: 1.5,
                            }}
                          >
                            <Chip
                              label={`Split ${index + 1}`}
                              size="small"
                              sx={{
                                background: (theme) => theme.palette.gradient.primary,
                                color: 'white',
                                fontWeight: 600,
                              }}
                            />
                            {formData.splits.length > 1 && (
                              <IconButton
                                size="small"
                                onClick={() => removeSplit(index)}
                                sx={{
                                  color: 'error.main',
                                  '&:hover': {
                                    background: 'rgba(239, 68, 68, 0.1)',
                                  },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>

                          <Grid container spacing={2}>
                            <Grid size={{ sm: 4, xs: 12 }}>
                              <TextField
                                select
                                label="Category"
                                value={split.categoryId}
                                onChange={(e) => handleCategoryChange(e.target.value, index)}
                                fullWidth
                                required
                                size="small"
                                error={Boolean(!split.categoryId && split.amount > 0)}
                              >
                                {categories
                                  .filter((c: Category) => !c.isFolder)
                                  .map((category: Category) => (
                                    <MenuItem key={category.id} value={category.id}>
                                      {category.name}
                                    </MenuItem>
                                  ))}
                              </TextField>
                            </Grid>

                            <Grid size={{ sm: 3, xs: 12 }}>
                              <Box sx={{ position: 'relative' }}>
                                <TextField
                                  label="Amount"
                                  type="number"
                                  value={split.amount || ''}
                                  onChange={(e) =>
                                    updateSplit(index, 'amount', parseFloat(e.target.value) || 0)
                                  }
                                  fullWidth
                                  required
                                  size="small"
                                  error={Boolean(split.categoryId && !split.amount)}
                                  InputProps={{
                                    startAdornment: (
                                      <InputAdornment position="start">
                                        {formData.accountId
                                          ? new Intl.NumberFormat('en-US', {
                                              style: 'currency',
                                              currency:
                                                accounts.find(
                                                  (a: Account) => a.id === formData.accountId
                                                )?.currency ||
                                                user?.currency ||
                                                'USD',
                                            })
                                              .format(0)
                                              .replace(/[\d.,]/g, '')
                                          : user?.currency === 'USD'
                                            ? '$'
                                            : user?.currency === 'EUR'
                                              ? '€'
                                              : user?.currency === 'GBP'
                                                ? '£'
                                                : user?.currency === 'INR'
                                                  ? '₹'
                                                  : '$'}
                                      </InputAdornment>
                                    ),
                                  }}
                                />
                                {getRemainingAmount() > 0 && (
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => fillRemaining(index)}
                                    sx={{
                                      position: 'absolute',
                                      right: 0,
                                      top: -24,
                                      fontSize: '0.7rem',
                                      minWidth: 'auto',
                                      px: 0.5,
                                      py: 0,
                                    }}
                                  >
                                    + Remaining
                                  </Button>
                                )}
                              </Box>
                            </Grid>

                            <Grid size={{ sm: 5, xs: 12 }}>
                              <Autocomplete
                                multiple
                                freeSolo
                                options={tags.map((t: Tag) => t.name)}
                                value={split.tags}
                                onChange={(_, value) => updateSplit(index, 'tags', value)}
                                renderInput={(params) => (
                                  <TextField {...params} label="Tags" size="small" />
                                )}
                                size="small"
                              />
                            </Grid>

                            <Grid size={{ xs: 12 }}>
                              <TextField
                                label="Notes (optional)"
                                value={split.notes}
                                onChange={(e) => updateSplit(index, 'notes', e.target.value)}
                                fullWidth
                                size="small"
                                multiline
                                rows={1}
                              />
                            </Grid>
                          </Grid>
                        </Box>
                      ))}

                      {/* Split Summary */}
                      <Box
                        sx={{
                          mt: 2,
                          p: 2,
                          bgcolor: getRemainingAmount() !== 0 ? 'error.lighter' : 'success.lighter',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="body2" fontWeight="bold">
                          Total Amount:{' '}
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency:
                              accounts.find((a: Account) => a.id === formData.accountId)
                                ?.currency ||
                              user?.currency ||
                              'USD',
                          }).format(parseFloat(formData.amount) || 0)}
                        </Typography>
                        <Typography variant="body2">
                          Split Total:{' '}
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency:
                              accounts.find((a: Account) => a.id === formData.accountId)
                                ?.currency ||
                              user?.currency ||
                              'USD',
                          }).format(getSplitTotal())}
                        </Typography>
                        <Typography
                          variant="body2"
                          color={getRemainingAmount() !== 0 ? 'error' : 'success.main'}
                          fontWeight="bold"
                        >
                          Remaining:{' '}
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency:
                              accounts.find((a: Account) => a.id === formData.accountId)
                                ?.currency ||
                              user?.currency ||
                              'USD',
                          }).format(getRemainingAmount())}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                  <Autocomplete
                    freeSolo
                    options={merchants}
                    value={formData.merchantName}
                    onChange={(_, newValue) => {
                      if (newValue) {
                        handleMerchantSelect(newValue);
                      } else {
                        setFormData({ ...formData, merchantName: '' });
                      }
                    }}
                    onInputChange={(_, newInputValue) => {
                      setFormData({ ...formData, merchantName: newInputValue });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Merchant Name"
                        placeholder="Enter or select merchant..."
                        helperText={
                          merchants.length > 0 && formData.merchantName.length >= 2
                            ? 'Start typing to see suggestions'
                            : ''
                        }
                      />
                    )}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      background: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)',
                      border: '1px solid',
                      borderColor: (theme) =>
                        theme.palette.mode === 'light'
                          ? 'rgba(139, 92, 246, 0.2)'
                          : 'rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.isRecurring}
                          onChange={(e) => {
                            const isRecurring = e.target.checked;
                            const updatedTags = isRecurring
                              ? [...formData.tags, 'recurring'].filter(
                                  (tag, index, self) => self.indexOf(tag) === index
                                ) // Add and dedupe
                              : formData.tags.filter((tag) => tag !== 'recurring'); // Remove tag
                            setFormData({ ...formData, isRecurring, tags: updatedTags });
                          }}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#8b5cf6',
                              '&:hover': {
                                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                              },
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            🔄 Recurring Transaction
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Automatically repeat this transaction
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                </Grid>

                {formData.isRecurring && (
                  <>
                    <Grid size={{ sm: 6, xs: 12 }}>
                      <TextField
                        select
                        label="Recurrence Frequency"
                        value={formData.recurrencePattern}
                        onChange={(e) =>
                          setFormData({ ...formData, recurrencePattern: e.target.value as any })
                        }
                        fullWidth
                        required
                      >
                        <MenuItem value="daily">Daily</MenuItem>
                        <MenuItem value="weekly">Weekly</MenuItem>
                        <MenuItem value="monthly">Monthly</MenuItem>
                        <MenuItem value="yearly">Yearly</MenuItem>
                      </TextField>
                    </Grid>

                    <Grid size={{ sm: 6, xs: 12 }}>
                      <TextField
                        label="Day of Month (for monthly/yearly)"
                        type="number"
                        value={formData.recurrenceDay}
                        onChange={(e) =>
                          setFormData({ ...formData, recurrenceDay: parseInt(e.target.value) || 1 })
                        }
                        fullWidth
                        InputProps={{ inputProps: { min: 1, max: 31 } }}
                        helperText="Day when transaction should repeat"
                        disabled={
                          formData.recurrencePattern === 'daily' ||
                          formData.recurrencePattern === 'weekly'
                        }
                      />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <ModernDatePicker
                          label="End Date (Optional)"
                          value={
                            formData.recurrenceEndDate ? dayjs(formData.recurrenceEndDate) : null
                          }
                          onChange={(newValue) =>
                            setFormData({
                              ...formData,
                              recurrenceEndDate: newValue ? newValue.format('YYYY-MM-DD') : '',
                            })
                          }
                          fullWidth
                          helperText="Leave empty for indefinite recurrence"
                        />
                      </LocalizationProvider>
                    </Grid>
                  </>
                )}
              </Grid>
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
              color={approveMode ? 'success' : 'primary'}
              disabled={
                !formData.amount ||
                !formData.accountId ||
                !formData.description ||
                (useSplitMode
                  ? formData.splits.length === 0 ||
                    formData.splits.some((s) => !s.categoryId || !s.amount)
                  : !formData.categoryId)
              }
              sx={{
                borderRadius: 2,
                px: 4,
                textTransform: 'none',
                fontWeight: 600,
                background: approveMode ? undefined : (theme) => theme.palette.gradient.primary,
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: 4,
                },
                transition: 'all 0.2s ease',
              }}
            >
              {approveMode ? 'Complete & Approve' : editingTransaction ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </ResponsiveDialog>

        {/* Confirmation Dialog */}
        <ConfirmDialog
          open={confirmDelete.open}
          title="Delete Transaction"
          message="Are you sure you want to delete this transaction? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete({ open: false, transactionId: null })}
          severity="error"
        />

        {/* Quick Add FAB */}
        <QuickAddFab onClick={() => handleOpenDialog()} tooltip="Quick Add Transaction" />

        {/* SMS Import Modal */}
        <SMSImportModal
          open={smsImportOpen}
          onClose={() => setSmsImportOpen(false)}
          onImportComplete={handleImportSuccess}
        />

        {/* Email Import Info Dialog */}
        <Dialog
          open={emailImportOpen}
          onClose={() => setEmailImportOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Email Import</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Email import works through Gmail integration. Transactions from bank notification
              emails are automatically imported when you connect your Gmail account.
            </Alert>
            <Typography variant="body2" gutterBottom>
              To enable email import:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mt: 1 }}>
              1. Go to Profile Settings
              <br />
              2. Connect your Gmail account
              <br />
              3. Grant required permissions
              <br />
              4. Transactions will be automatically imported from bank emails
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmailImportOpen(false)}>Close</Button>
            <Button
              onClick={() => {
                setEmailImportOpen(false);
                window.location.href = '/profile';
              }}
              variant="contained"
            >
              Go to Profile
            </Button>
          </DialogActions>
        </Dialog>

        {/* Undo Reject Snackbar */}
        <Snackbar
          open={!!undoRejectInfo}
          autoHideDuration={5000}
          onClose={() => setUndoRejectInfo(null)}
          message="Transaction rejected"
          action={
            <Button
              color="secondary"
              size="small"
              onClick={async () => {
                if (undoRejectInfo) {
                  clearTimeout(undoRejectInfo.timeoutId);
                  const success = await changeTransactionStatus(
                    undoRejectInfo.transactionId,
                    'pending'
                  );
                  if (success) {
                    await fetchTransactions();
                    await fetchPendingCount();
                    toast.success('Rejection undone');
                  }
                  setUndoRejectInfo(null);
                }
              }}
            >
              UNDO
            </Button>
          }
        />
      </Box>
    </LocalizationProvider>
  );
};

export default Transactions;
