import React, { useState, useEffect } from 'react';
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
  Divider,
  Checkbox,
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
  FormControlLabel,
  Switch,
  TablePagination,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
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
} from '@mui/icons-material';
import axios from 'axios';
import { useToast } from '../components/Toast';
import QuickAddFab from '../components/QuickAddFab';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeletons';
import TransactionCard from '../components/TransactionCard';
import SwipeableTransactionCard from '../components/SwipeableTransactionCard';
import ResponsiveDialog from '../components/ResponsiveDialog';
import PullToRefresh from '../components/PullToRefresh';
import SMSImportModal from '../components/SMSImportModal';
import { useResponsive } from '../hooks/useResponsive';
import { useIsTouchDevice } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

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

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  isDefault?: boolean;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  color?: string;
  isFolder?: boolean;
  parentId?: string | null;
  path?: string[];
}

interface Tag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
}

// Smart tag mapping: category names (lowercase) to suggested tags
const CATEGORY_TAG_SUGGESTIONS: Record<string, { suggestedTags: string[]; removeTags: string[] }> = {
  // Investment categories
  'stocks': { suggestedTags: ['investment'], removeTags: ['expense'] },
  'mutual funds': { suggestedTags: ['investment'], removeTags: ['expense'] },
  'crypto': { suggestedTags: ['investment'], removeTags: ['expense'] },
  'cryptocurrency': { suggestedTags: ['investment'], removeTags: ['expense'] },
  'investment': { suggestedTags: ['investment'], removeTags: ['expense'] },
  'bonds': { suggestedTags: ['investment'], removeTags: ['expense'] },
  'real estate': { suggestedTags: ['investment'], removeTags: ['expense'] },
  
  // Transfer categories
  'transfer': { suggestedTags: ['transfer'], removeTags: ['expense', 'income'] },
  'account transfer': { suggestedTags: ['transfer'], removeTags: ['expense', 'income'] },
  
  // Savings categories
  'savings': { suggestedTags: ['savings'], removeTags: ['expense'] },
  'emergency fund': { suggestedTags: ['savings'], removeTags: ['expense'] },
  
  // Loan/Debt categories
  'loan payment': { suggestedTags: ['loan'], removeTags: ['expense'] },
  'loan': { suggestedTags: ['loan'], removeTags: ['expense'] },
  'debt payment': { suggestedTags: ['loan'], removeTags: ['expense'] },
  'emi': { suggestedTags: ['loan'], removeTags: ['expense'] },
  
  // Refund categories
  'refund': { suggestedTags: ['refund'], removeTags: ['income'] },
  'cashback': { suggestedTags: ['refund'], removeTags: ['income'] },
  'return': { suggestedTags: ['refund'], removeTags: ['income'] },
};

// Tags to exclude from expense calculations in dashboards
const EXPENSE_EXCLUDE_TAGS = ['investment', 'transfer', 'savings', 'loan', 'refund'];

// Tags to exclude from income calculations in dashboards
const INCOME_EXCLUDE_TAGS = ['transfer', 'refund'];

const Transactions: React.FC = () => {
  const { token, user } = useAuth();
  const toast = useToast();
  const { isMobile } = useResponsive();
  const isTouchDevice = useIsTouchDevice();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; transactionId: string | null }>({
    open: false,
    transactionId: null,
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'credit' | 'debit'>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs().endOf('month'));
  const [activeDateFilter, setActiveDateFilter] = useState<string>('thisMonth'); // Track active quick filter
  const [reviewStatus, setReviewStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
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
  const [totalCount, setTotalCount] = useState(0); // Total records from API
  const [pendingCount, setPendingCount] = useState(0); // All-time pending count
  const [merchants, setMerchants] = useState<string[]>([]); // Unique merchant names
  const [recentCategories, setRecentCategories] = useState<string[]>([]); // Recent category IDs

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
      try {
        setLoading(true);
        await Promise.all([fetchAccounts(), fetchCategories(), fetchTags()]);
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
  }, []);

  // Reset to first page when filters change (industry standard: API filtering)
  useEffect(() => {
    if (token) {
      setPage(0);
    }
  }, [selectedType, selectedAccount, selectedCategories, includeTags, excludeTags, startDate, endDate, reviewStatus, sortBy, sortOrder, searchQuery]);

  // Fetch transactions when page, rowsPerPage, or any filter changes
  useEffect(() => {
    if (!token) return;
    
    // Debounce only for search query to avoid excessive API calls while typing
    const debounceTimer = setTimeout(() => {
      fetchTransactions();
    }, searchQuery ? 500 : 0); // Debounce search, immediate for other filters

    return () => clearTimeout(debounceTimer);
  }, [page, rowsPerPage, selectedType, selectedAccount, selectedCategories, includeTags, excludeTags, startDate, endDate, reviewStatus, sortBy, sortOrder, searchQuery]);

  const fetchTransactions = async () => {
    try {
      const params: any = {
        sortBy,
        sortOrder,
        limit: rowsPerPage.toString(),
        skip: (page * rowsPerPage).toString(),
      };

      if (searchQuery) params.search = searchQuery;
      if (selectedType !== 'all') params.type = selectedType;
      if (selectedAccount) params.accountId = selectedAccount;
      if (selectedCategories.length > 0) {
        // Expand folders to category IDs before sending to backend
        const expandedCategoryIds = new Set<string>();
        
        const getAllDescendants = (folderId: string): string[] => {
          const descendants: string[] = [];
          const children = categories.filter((c) => c.parentId === folderId);
          
          children.forEach((child) => {
            if (child.isFolder) {
              descendants.push(...getAllDescendants(child.id));
            } else {
              descendants.push(child.id);
            }
          });
          
          return descendants;
        };
        
        selectedCategories.forEach((catId) => {
          const cat = categories.find((c) => c.id === catId);
          if (cat?.isFolder) {
            getAllDescendants(cat.id).forEach((id) => expandedCategoryIds.add(id));
          } else {
            expandedCategoryIds.add(catId);
          }
        });
        
        params.categoryIds = Array.from(expandedCategoryIds).join(',');
      }
      if (includeTags.length > 0) params.includeTags = includeTags.join(',');
      if (excludeTags.length > 0) params.excludeTags = excludeTags.join(',');
      if (startDate) params.startDate = startDate.startOf('day').toISOString();
      if (endDate) params.endDate = endDate.endOf('day').toISOString();
      if (reviewStatus !== 'all') params.reviewStatus = reviewStatus;
      params.includeSplits = 'true'; // Always fetch splits

      const response = await axios.get(`/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setTransactions(response.data.transactions || []);
      setTotalCount(response.data.pagination?.total || 0);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch transactions');
      setTransactions([]); // Set empty array on error
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccounts((response.data.accounts || []).filter((a: Account) => a.isActive));
    } catch (err: any) {
      console.error('Failed to fetch accounts:', err);
      setAccounts([]); // Set empty array on error
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Include both folders and categories for smart folder selection
      setCategories(response.data.categories || []);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
      setCategories([]); // Set empty array on error
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
      setTags([]); // Set empty array on error to prevent white screen
    }
  };

  const fetchPendingCount = async () => {
    try {
      const response = await axios.get(`/api/transactions/pending/count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingCount(response.data.count || 0);
    } catch (err: any) {
      console.error('Failed to fetch pending count:', err);
      setPendingCount(0);
    }
  };

  const fetchMerchantsAndRecentCategories = async () => {
    try {
      // Fetch unique merchants from transactions
      const txnResponse = await axios.get(`/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: '1000', sortBy: 'date', sortOrder: 'desc' },
      });
      
      const txns = txnResponse.data.transactions || [];
      
      // Extract unique merchants
      const uniqueMerchants = [...new Set(
        txns
          .map((t: Transaction) => t.merchantName)
          .filter((m: string | undefined) => m && m.trim())
      )] as string[];
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

  const handleApprove = async (id: string) => {
    try {
      await axios.patch(`/api/transactions/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      await axios.patch(`/api/transactions/${id}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Transaction rejected');
      await fetchTransactions();
      await fetchPendingCount();
      
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

    try {
      await axios.post('/api/transactions/bulk-approve', {
        transactionIds: Array.from(selectedTransactions),
      }, {
        headers: { Authorization: `Bearer ${token}` },
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

  const handleImportMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setImportMenuAnchor(event.currentTarget);
  };

  const handleImportMenuClose = () => {
    setImportMenuAnchor(null);
  };

  const handleSMSImport = () => {
    handleImportMenuClose();
    setSmsImportOpen(true);
  };

  const handleEmailImport = () => {
    handleImportMenuClose();
    setEmailImportOpen(true);
  };

  const handleImportSuccess = async () => {
    await fetchTransactions();
    
    toast.success('Transactions imported successfully');
  };

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
      const categoryId = splits.length > 0 ? splits[0].categoryId : (transaction.categoryId || '');
      const tags = splits.length > 0 ? splits[0].tags : (transaction.tags || []);

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
        accountId: accounts.find((a) => a.isDefault)?.id || '',
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
      tags: [
        ...split.tags.filter((tag) => tag !== oldTag && tag !== newTag),
        newTag,
      ],
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
      let splits = formData.splits.map((split, index) => ({
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
        await axios.put(`/api/transactions/${editingTransaction.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Transaction updated successfully');
      } else {
        await axios.post(`/api/transactions`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Transaction created successfully');
      }

      handleCloseDialog();
      fetchTransactions();
      fetchAccounts();
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
      await axios.delete(`/api/transactions/${confirmDelete.transactionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Transaction deleted successfully');
      fetchTransactions();
      fetchAccounts();
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
      const suggestedCategoryId = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0];
      
      if (suggestedCategoryId && !formData.categoryId) {
        setFormData({
          ...formData,
          merchantName,
          categoryId: suggestedCategoryId,
          splits: [{
            ...formData.splits[0],
            categoryId: suggestedCategoryId,
          }],
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
    const category = categories.find((c) => c.id === categoryId);
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
          splits: [{
            ...formData.splits[0],
            categoryId,
            tags: updatedTags,
          }],
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
          splits: [{
            ...formData.splits[0],
            categoryId,
          }],
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
      await axios.delete(`/api/transactions/bulk`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { ids: Array.from(selectedTransactions) },
      });

      toast.success(`${selectedTransactions.size} transactions deleted`);
      setSelectedTransactions(new Set());
      setSelectAll(false);
      fetchTransactions();
      fetchAccounts();
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
      const splits = t.splits && t.splits.length > 0 ? t.splits : [
        { categoryId: t.categoryId || '', amount: t.amount, tags: t.tags || [] }
      ];
      
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

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map((t) => t.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectTransaction = (id: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
    setSelectAll(newSelected.size === transactions.length);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedAccount('');
    setSelectedCategories([]);
    setIncludeTags([]);
    setExcludeTags([]);
    setStartDate(dayjs().startOf('month'));
    setEndDate(dayjs().endOf('month'));
    setActiveDateFilter('thisMonth');
    setReviewStatus('all');
    setPage(0); // Reset to first page
  };

  const getAccountName = (accountId: string) => {
    return accounts.find((a) => a.id === accountId)?.name || 'Unknown';
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Uncategorized';
    return categories.find((c) => c.id === categoryId)?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId?: string) => {
    if (!categoryId) return '#999999';
    return categories.find((c) => c.id === categoryId)?.color || '#667eea';
  };

  const formatCurrency = (amount: number, accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    const currency = account?.currency || user?.currency || 'USD';
    return formatCurrencyUtil(amount, currency);
  };

  const formatUserCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'USD');
  };

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
    .filter((t) => t.type === 'credit' && t.reviewStatus === 'approved' && !shouldExcludeFromIncome(t))
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = transactions
    .filter((t) => t.type === 'debit' && t.reviewStatus === 'approved' && !shouldExcludeFromExpenses(t))
    .reduce((sum, t) => sum + t.amount, 0);
  const netAmount = totalCredits - totalDebits;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              Track all your income and expenses
            </Typography>
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<ImportIcon sx={{ display: { xs: 'none', sm: 'inline' } }} />}
              onClick={handleImportMenuOpen}
              size="small"
              sx={{ minWidth: { xs: 80, sm: 'auto' } }}
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
              sx={{ minWidth: { xs: 80, sm: 'auto' } }}
            >
              Export
            </Button>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => handleOpenDialog()}
              size="small"
              sx={{ minWidth: { xs: 80, sm: 'auto' } }}
            >
              Add
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)' }}>
              <CardContent>
                <Typography variant="body2" color="white" gutterBottom>
                  Total Credits
                </Typography>
                <Typography variant="h4" color="white" fontWeight="bold">
                  {formatUserCurrency(totalCredits)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #f44336 0%, #e57373 100%)' }}>
              <CardContent>
                <Typography variant="body2" color="white" gutterBottom>
                  Total Debits
                </Typography>
                <Typography variant="h4" color="white" fontWeight="bold">
                  {formatUserCurrency(totalDebits)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                background:
                  netAmount >= 0
                    ? 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)'
                    : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
              }}
            >
              <CardContent>
                <Typography variant="body2" color="white" gutterBottom>
                  Net Amount
                </Typography>
                <Typography variant="h4" color="white" fontWeight="bold">
                  {formatUserCurrency(Math.abs(netAmount))}
                  {netAmount < 0 && ' deficit'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" gap={2} alignItems="center" flexWrap="wrap" flex={1}>
                <TextField
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ minWidth: 250 }}
                />

                <ToggleButtonGroup
                  value={selectedType}
                  exclusive
                  onChange={(_, value) => value && setSelectedType(value)}
                  size="small"
                >
                  <ToggleButton value="all">All</ToggleButton>
                  <ToggleButton value="credit">
                    <CreditIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Credits
                  </ToggleButton>
                  <ToggleButton value="debit">
                    <DebitIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Debits
                  </ToggleButton>
                </ToggleButtonGroup>

                <ToggleButtonGroup
                  value={reviewStatus}
                  exclusive
                  onChange={(_, value) => value && setReviewStatus(value)}
                  size="small"
                >
                  <ToggleButton value="all">
                    All
                  </ToggleButton>
                  <ToggleButton value="pending">
                    Pending
                    {pendingCount > 0 && (
                      <Chip 
                        label={pendingCount} 
                        size="small" 
                        color="warning" 
                        sx={{ ml: 1, height: 20, minWidth: 20, cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent toggle button click
                          setReviewStatus('pending');
                          setStartDate(null);
                          setEndDate(null);
                          setActiveDateFilter('');
                        }}
                      />
                    )}
                  </ToggleButton>
                  <ToggleButton value="approved">
                    Approved
                  </ToggleButton>
                  <ToggleButton value="rejected">
                    Rejected
                  </ToggleButton>
                </ToggleButtonGroup>

                <Button
                  variant={showFilters ? 'contained' : 'outlined'}
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                  size="small"
                >
                  Filters
                </Button>

                {(searchQuery ||
                  selectedType !== 'all' ||
                  selectedAccount ||
                  selectedCategories.length > 0 ||
                  includeTags.length > 0 ||
                  excludeTags.length > 0 ||
                  reviewStatus !== 'all') && (
                  <Chip
                    label="Clear Filters"
                    onDelete={clearFilters}
                    color="primary"
                    size="small"
                  />
                )}
              </Box>

              {selectedTransactions.size > 0 && (
                <Box display="flex" gap={1}>
                  <Chip
                    label={`${selectedTransactions.size} selected`}
                    color="primary"
                    onDelete={() => {
                      setSelectedTransactions(new Set());
                      setSelectAll(false);
                    }}
                  />
                  {reviewStatus === 'pending' && (
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      startIcon={<ApproveIcon />}
                      onClick={handleBulkApprove}
                    >
                      Approve Selected
                    </Button>
                  )}
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    onClick={handleBulkDelete}
                  >
                    Delete Selected
                  </Button>
                </Box>
              )}
            </Box>

            <Collapse in={showFilters}>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select
                    label="Account"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="">All Accounts</MenuItem>
                    {accounts.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={categories}
                    getOptionLabel={(option) => option.name}
                    value={categories.filter((c) => selectedCategories.includes(c.id))}
                    onChange={(_, newValue) => {
                      // Store folders and categories as-is (no expansion in state)
                      // Expansion happens only when making API call
                      setSelectedCategories(newValue.map((cat) => cat.id));
                    }}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Categories" 
                        size="small"
                        placeholder="Select categories or folders..."
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props}>
                        {option.isFolder ? '📁 ' : ''}{option.name}
                      </li>
                    )}
                    renderTags={(value, getTagProps) => {
                      // Helper to count descendants for folders
                      const getDescendantCount = (folderId: string): number => {
                        let count = 0;
                        const children = categories.filter((c) => c.parentId === folderId);
                        
                        children.forEach((child) => {
                          if (child.isFolder) {
                            count += getDescendantCount(child.id);
                          } else {
                            count++;
                          }
                        });
                        
                        return count;
                      };

                      return value.map((option, index) => {
                        const label = option.isFolder 
                          ? `📁 ${option.name} (${getDescendantCount(option.id)})`
                          : option.name;
                        
                        return (
                          <Chip 
                            label={label}
                            size="small"
                            style={{ backgroundColor: option.color || '#667eea', color: '#fff' }}
                            {...getTagProps({ index })} 
                          />
                        );
                      });
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={(date) => {
                      setStartDate(date);
                      setActiveDateFilter(''); // Clear active filter on manual change
                    }}
                    slotProps={{ 
                      textField: { size: 'small', fullWidth: true },
                      field: { clearable: true }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={(date) => {
                      setEndDate(date);
                      setActiveDateFilter(''); // Clear active filter on manual change
                    }}
                    slotProps={{ 
                      textField: { size: 'small', fullWidth: true },
                      field: { clearable: true }
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label="Today"
                      size="small"
                      variant={activeDateFilter === 'today' ? 'filled' : 'outlined'}
                      color={activeDateFilter === 'today' ? 'primary' : 'default'}
                      onClick={() => {
                        setStartDate(dayjs().startOf('day'));
                        setEndDate(dayjs().endOf('day'));
                        setActiveDateFilter('today');
                      }}
                      sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                      label="Last 7 Days"
                      size="small"
                      variant={activeDateFilter === 'last7' ? 'filled' : 'outlined'}
                      color={activeDateFilter === 'last7' ? 'primary' : 'default'}
                      onClick={() => {
                        setStartDate(dayjs().subtract(7, 'days'));
                        setEndDate(dayjs());
                        setActiveDateFilter('last7');
                      }}
                      sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                      label="Last 30 Days"
                      size="small"
                      variant={activeDateFilter === 'last30' ? 'filled' : 'outlined'}
                      color={activeDateFilter === 'last30' ? 'primary' : 'default'}
                      onClick={() => {
                        setStartDate(dayjs().subtract(30, 'days'));
                        setEndDate(dayjs());
                        setActiveDateFilter('last30');
                      }}
                      sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                      label="This Month"
                      size="small"
                      variant={activeDateFilter === 'thisMonth' ? 'filled' : 'outlined'}
                      color={activeDateFilter === 'thisMonth' ? 'primary' : 'default'}
                      onClick={() => {
                        setStartDate(dayjs().startOf('month'));
                        setEndDate(dayjs().endOf('month'));
                        setActiveDateFilter('thisMonth');
                      }}
                      sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                      label="Last Month"
                      size="small"
                      variant={activeDateFilter === 'lastMonth' ? 'filled' : 'outlined'}
                      color={activeDateFilter === 'lastMonth' ? 'primary' : 'default'}
                      onClick={() => {
                        setStartDate(dayjs().subtract(1, 'month').startOf('month'));
                        setEndDate(dayjs().subtract(1, 'month').endOf('month'));
                        setActiveDateFilter('lastMonth');
                      }}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Autocomplete
                    multiple
                    options={tags.map((t) => t.name)}
                    value={includeTags}
                    onChange={(_, value) => setIncludeTags(value)}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Include Tags (show WITH these)" 
                        size="small"
                        placeholder="Select tags to include..."
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip 
                          label={option} 
                          size="small" 
                          color="success"
                          {...getTagProps({ index })} 
                        />
                      ))
                    }
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Autocomplete
                    multiple
                    options={tags.map((t) => t.name)}
                    value={excludeTags}
                    onChange={(_, value) => setExcludeTags(value)}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Exclude Tags (hide WITH these)" 
                        size="small"
                        placeholder="Select tags to exclude..."
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip 
                          label={option} 
                          size="small" 
                          color="error"
                          {...getTagProps({ index })} 
                        />
                      ))
                    }
                  />
                </Grid>
              </Grid>
            </Collapse>
          </CardContent>
        </Card>

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
                      const CardComponent = isTouchDevice ? SwipeableTransactionCard : TransactionCard;
                      const isPending = transaction.reviewStatus === 'pending';
                      
                      return (
                        <Box key={transaction.id} sx={{ position: 'relative' }}>
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
                                pb: 2 
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
                      '&:hover .sort-icon': { opacity: 1 }
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
                        sortOrder === 'desc' ? 
                          <ArrowDownwardIcon fontSize="small" /> : 
                          <ArrowUpwardIcon fontSize="small" />
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
                      '&:hover .sort-icon': { opacity: 1 }
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
                        sortOrder === 'desc' ? 
                          <ArrowDownwardIcon fontSize="small" /> : 
                          <ArrowUpwardIcon fontSize="small" />
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
                      '&:hover .sort-icon': { opacity: 1 }
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
                        sortOrder === 'desc' ? 
                          <ArrowDownwardIcon fontSize="small" /> : 
                          <ArrowUpwardIcon fontSize="small" />
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
                      '&:hover .sort-icon': { opacity: 1 }
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
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      Amount
                      {sortBy === 'amount' ? (
                        sortOrder === 'desc' ? 
                          <ArrowDownwardIcon fontSize="small" /> : 
                          <ArrowUpwardIcon fontSize="small" />
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
                              <Box display="flex" gap={0.5} flexWrap="wrap">
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
                                    ? transaction.reviewStatus.charAt(0).toUpperCase() + transaction.reviewStatus.slice(1)
                                    : 'Pending'
                                }
                                size="small"
                                color={
                                  transaction.reviewStatus === 'pending' || !transaction.reviewStatus
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
                                        <Grid item xs={12} sm={6} md={4} key={idx}>
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
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</span>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'normal' }}>
                Ctrl+Enter to save • Ctrl+S to toggle mode
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <ToggleButtonGroup
                value={formData.type}
                exclusive
                onChange={(_, value) => value && handleTypeChange(value as 'credit' | 'debit')}
                fullWidth
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

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
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
                                  accounts.find((a) => a.id === formData.accountId)?.currency ||
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

                <Grid item xs={12} sm={6}>
                  <Box>
                    <TextField
                      label="Date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      fullWidth
                      required
                      InputLabelProps={{ shrink: true }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={setDateToToday}
                        sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1, py: 0.25 }}
                      >
                        Today
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={setDateToYesterday}
                        sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1, py: 0.25 }}
                      >
                        Yesterday
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={setDateToStartOfMonth}
                        sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1, py: 0.25 }}
                      >
                        Month Start
                      </Button>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Account"
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    fullWidth
                    required
                  >
                    {accounts.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    fullWidth
                    required
                  />
                </Grid>

                {/* Split Mode Toggle */}
                <Grid item xs={12}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 2,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" fontWeight="medium">
                      Transaction Mode:
                    </Typography>
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
                      size="small"
                    >
                      <ToggleButton value={false}>Quick Add (Single Category)</ToggleButton>
                      <ToggleButton value={true}>Split (Multiple Categories)</ToggleButton>
                    </ToggleButtonGroup>
                    {useSplitMode && (
                      <Typography variant="caption" color="text.secondary">
                        Split this transaction across multiple categories
                      </Typography>
                    )}
                  </Box>
                </Grid>

                {/* Simple Mode - Single Category & Tags */}
                {!useSplitMode && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        options={[
                          ...categories.filter((c) => recentCategories.includes(c.id)),
                          ...categories.filter((c) => !recentCategories.includes(c.id)),
                        ].filter((c) => !c.isFolder)}
                        getOptionLabel={(option) => option.name}
                        value={categories.find((c) => c.id === formData.categoryId) || null}
                        onChange={(_, newValue) => {
                          if (newValue) {
                            handleCategoryChange(newValue.id);
                          } else {
                            setFormData({
                              ...formData,
                              categoryId: '',
                              splits: [{
                                ...formData.splits[0],
                                categoryId: '',
                              }],
                            });
                          }
                        }}
                        groupBy={(option) =>
                          recentCategories.includes(option.id) ? 'Recent' : 'All Categories'
                        }
                        renderInput={(params) => (
                          <TextField {...params} label="Category" required placeholder="Select category..." />
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

                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        multiple
                        freeSolo
                        options={tags.map((t) => t.name)}
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
                            />
                          ))
                        }
                      />
                    </Grid>
                  </>
                )}

                {/* Split Mode - Multiple Splits */}
                {useSplitMode && (
                  <Grid item xs={12}>
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 2,
                          flexWrap: 'wrap',
                          gap: 1,
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold">
                          Split Details
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={distributeEqually}
                            disabled={!formData.amount || formData.splits.length === 0}
                          >
                            Distribute Equally
                          </Button>
                          <Button size="small" startIcon={<AddIcon />} onClick={addSplit}>
                            Add Split
                          </Button>
                        </Box>
                      </Box>

                      {formData.splits.map((split, index) => (
                        <Box
                          key={index}
                          sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              mb: 1,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              Split {index + 1}
                            </Typography>
                            {formData.splits.length > 1 && (
                              <IconButton
                                size="small"
                                onClick={() => removeSplit(index)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
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
                                {categories.filter((c) => !c.isFolder).map((category) => (
                                  <MenuItem key={category.id} value={category.id}>
                                    {category.name}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Grid>

                            <Grid item xs={12} sm={3}>
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
                                                accounts.find((a) => a.id === formData.accountId)
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

                            <Grid item xs={12} sm={5}>
                              <Autocomplete
                                multiple
                                freeSolo
                                options={tags.map((t) => t.name)}
                                value={split.tags}
                                onChange={(_, value) => updateSplit(index, 'tags', value)}
                                renderInput={(params) => (
                                  <TextField {...params} label="Tags" size="small" />
                                )}
                                size="small"
                              />
                            </Grid>

                            <Grid item xs={12}>
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
                              accounts.find((a) => a.id === formData.accountId)?.currency ||
                              user?.currency ||
                              'USD',
                          }).format(parseFloat(formData.amount) || 0)}
                        </Typography>
                        <Typography variant="body2">
                          Split Total:{' '}
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency:
                              accounts.find((a) => a.id === formData.accountId)?.currency ||
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
                              accounts.find((a) => a.id === formData.accountId)?.currency ||
                              user?.currency ||
                              'USD',
                          }).format(getRemainingAmount())}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}

                <Grid item xs={12}>
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

                <Grid item xs={12}>
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
                      />
                    }
                    label="Recurring Transaction"
                  />
                </Grid>

                {formData.isRecurring && (
                  <>
                    <Grid item xs={12} sm={6}>
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

                    <Grid item xs={12} sm={6}>
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

                    <Grid item xs={12}>
                      <TextField
                        label="End Date (Optional)"
                        type="date"
                        value={formData.recurrenceEndDate}
                        onChange={(e) =>
                          setFormData({ ...formData, recurrenceEndDate: e.target.value })
                        }
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        helperText="Leave empty for indefinite recurrence"
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={
                !formData.amount ||
                !formData.accountId ||
                !formData.description ||
                (useSplitMode
                  ? formData.splits.length === 0 ||
                    formData.splits.some((s) => !s.categoryId || !s.amount)
                  : !formData.categoryId)
              }
            >
              {editingTransaction ? 'Update' : 'Create'}
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
              Email import works through Gmail integration. Transactions from bank notification emails 
              are automatically imported when you connect your Gmail account.
            </Alert>
            <Typography variant="body2" gutterBottom>
              To enable email import:
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mt: 1 }}>
              1. Go to Profile Settings<br />
              2. Connect your Gmail account<br />
              3. Grant required permissions<br />
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
      </Box>
    </LocalizationProvider>
  );
};

export default Transactions;
