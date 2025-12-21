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
  Chip,
  Alert,
  CircularProgress,
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
} from '@mui/icons-material';
import axios from 'axios';
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
  notes?: string;
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
}

interface Tag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
}

const Transactions: React.FC = () => {
  const { token, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'credit' | 'debit'>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(3, 'months').startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs().endOf('month'));
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
    notes: '',
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
      } catch (err) {
        console.error('Error initializing transactions page:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const fetchTransactions = async () => {
    try {
      setError('');

      const params: any = {
        sortBy,
        sortOrder,
      };

      if (selectedType !== 'all') params.type = selectedType;
      if (selectedAccount) params.accountId = selectedAccount;
      if (selectedCategory) params.categoryId = selectedCategory;
      if (selectedTags.length > 0) params.tags = selectedTags.join(',');
      if (startDate) params.startDate = startDate.startOf('day').toISOString();
      if (endDate) params.endDate = endDate.endOf('day').toISOString();
      if (reviewStatus !== 'all') params.reviewStatus = reviewStatus;
      params.includeSplits = 'true'; // Always fetch splits

      const response = await axios.get(`/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setTransactions(response.data.transactions || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.response?.data?.message || 'Failed to fetch transactions');
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
      setCategories(response.data.categories?.filter((c: Category) => !c.isFolder) || []);
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
        notes: transaction.notes || '',
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
        notes: '',
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

    // Remove old auto-tag and add new one
    const updatedTags = formData.tags.filter((tag) => tag !== oldTag && tag !== newTag);
    updatedTags.push(newTag);

    setFormData({
      ...formData,
      type: newType,
      tags: updatedTags,
    });
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setSuccess('');

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
          setError('Split amounts must equal the total transaction amount');
          return;
        }
      }

      const payload: any = {
        type: formData.type,
        amount: amount,
        accountId: formData.accountId,
        description: formData.description,
        date: formData.date,
        notes: formData.notes,
        merchantName: formData.merchantName,
        isRecurring: formData.isRecurring,
        reviewStatus: 'approved' as const,
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
        setSuccess('Transaction updated successfully');
      } else {
        await axios.post(`/api/transactions`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccess('Transaction created successfully');
      }

      handleCloseDialog();
      fetchTransactions();
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save transaction');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      setError('');
      setSuccess('');

      await axios.delete(`/api/transactions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess('Transaction deleted successfully');
      fetchTransactions();
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete transaction');
    }
  };

  // Split management functions
  const addSplit = () => {
    const newSplit: TransactionSplit = {
      categoryId: '',
      amount: 0,
      tags: [],
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
      setError('');
      setSuccess('');

      await axios.delete(`/api/transactions/bulk`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { ids: Array.from(selectedTransactions) },
      });

      setSuccess(`${selectedTransactions.size} transactions deleted`);
      setSelectedTransactions(new Set());
      setSelectAll(false);
      fetchTransactions();
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete transactions');
    }
  };

  const handleExportCSV = () => {
    const filteredTransactions = getFilteredTransactions();

    const headers = [
      'Date',
      'Type',
      'Account',
      'Category',
      'Description',
      'Amount',
      'Tags',
      'Status',
    ];
    const rows = filteredTransactions.map((t) => [
      dayjs(t.date).format('YYYY-MM-DD'),
      t.type.toUpperCase(),
      getAccountName(t.accountId),
      getCategoryName(t.categoryId),
      t.description,
      t.amount.toFixed(2),
      t.tags?.join('; ') || '',
      t.reviewStatus,
    ]);

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
      setSelectedTransactions(new Set(getFilteredTransactions().map((t) => t.id)));
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
    setSelectAll(newSelected.size === getFilteredTransactions().length);
  };

  const getFilteredTransactions = () => {
    return transactions.filter((transaction) => {
      const matchesSearch =
        searchQuery === '' ||
        transaction.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.merchantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedAccount('');
    setSelectedCategory('');
    setSelectedTags([]);
    setStartDate(dayjs().startOf('month'));
    setEndDate(dayjs());
    setReviewStatus('all');
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const filteredTransactions = getFilteredTransactions();
  const totalCredits = filteredTransactions
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = filteredTransactions
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);
  const netAmount = totalCredits - totalDebits;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track all your income and expenses
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCSV}
              disabled={filteredTransactions.length === 0}
            >
              Export CSV
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Add Transaction
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

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
                  selectedCategory ||
                  selectedTags.length > 0 ||
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
                  <TextField
                    select
                    label="Category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={(date) => setStartDate(date)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={(date) => setEndDate(date)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Autocomplete
                    multiple
                    options={tags.map((t) => t.name)}
                    value={selectedTags}
                    onChange={(_, value) => setSelectedTags(value)}
                    renderInput={(params) => <TextField {...params} label="Tags" size="small" />}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip label={option} size="small" {...getTagProps({ index })} />
                      ))
                    }
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select
                    label="Status"
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="approved">Approved</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select
                    label="Sort By"
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortBy(field);
                      setSortOrder(order as 'asc' | 'desc');
                    }}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="date-desc">Date (Newest)</MenuItem>
                    <MenuItem value="date-asc">Date (Oldest)</MenuItem>
                    <MenuItem value="amount-desc">Amount (High to Low)</MenuItem>
                    <MenuItem value="amount-asc">Amount (Low to High)</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </Collapse>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectAll}
                      onChange={handleSelectAll}
                      disabled={filteredTransactions.length === 0}
                    />
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                      <Typography variant="body1" color="text.secondary">
                        No transactions found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((transaction) => {
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
                                    onClick={() => handleDelete(transaction.id)}
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
            count={filteredTransactions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
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
                  <TextField
                    label="Date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
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
                      <TextField
                        select
                        label="Category"
                        value={formData.categoryId}
                        onChange={(e) => {
                          setFormData({ ...formData, categoryId: e.target.value });
                          // Update the single split
                          if (formData.splits.length > 0) {
                            const newSplits = [...formData.splits];
                            newSplits[0] = { ...newSplits[0], categoryId: e.target.value };
                            setFormData({
                              ...formData,
                              categoryId: e.target.value,
                              splits: newSplits,
                            });
                          }
                        }}
                        fullWidth
                        required
                      >
                        {categories.map((category) => (
                          <MenuItem key={category.id} value={category.id}>
                            {category.name}
                          </MenuItem>
                        ))}
                      </TextField>
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
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold">
                          Split Details
                        </Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={addSplit}>
                          Add Split
                        </Button>
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
                                onChange={(e) => updateSplit(index, 'categoryId', e.target.value)}
                                fullWidth
                                required
                                size="small"
                              >
                                {categories.map((category) => (
                                  <MenuItem key={category.id} value={category.id}>
                                    {category.name}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Grid>

                            <Grid item xs={12} sm={3}>
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
                  <TextField
                    label="Merchant Name"
                    value={formData.merchantName}
                    onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    multiline
                    rows={3}
                    fullWidth
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
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Transactions;
