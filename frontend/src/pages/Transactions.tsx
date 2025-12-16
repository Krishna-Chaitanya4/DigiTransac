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
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Transaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  accountId: string;
  categoryId: string;
  description: string;
  tags: string[];
  date: string;
  notes?: string;
  isRecurring: boolean;
  recurrencePattern?: string;
  source?: string;
  merchantName?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  linkedTransactionId?: string;
  createdAt: string;
  updatedAt: string;
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
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [reviewStatus, setReviewStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    type: 'debit' as 'credit' | 'debit',
    amount: '',
    accountId: '',
    categoryId: '',
    description: '',
    tags: [] as string[],
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
        await Promise.all([
          fetchAccounts(),
          fetchCategories(),
          fetchTags(),
        ]);
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
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      if (reviewStatus !== 'all') params.reviewStatus = reviewStatus;

      const response = await axios.get(`${API_URL}/api/transactions`, {
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
      const response = await axios.get(`${API_URL}/api/accounts`, {
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
      const response = await axios.get(`${API_URL}/api/categories`, {
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
      const response = await axios.get(`${API_URL}/api/tags`, {
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
      setFormData({
        type: transaction.type,
        amount: transaction.amount.toString(),
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        description: transaction.description,
        tags: transaction.tags || [],
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
      const defaultTag = 'expense'; // Default for debit transactions
      setFormData({
        type: 'debit',
        amount: '',
        accountId: accounts.find(a => a.isDefault)?.id || '',
        categoryId: '',
        description: '',
        tags: [defaultTag],
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
    const updatedTags = formData.tags.filter(tag => tag !== oldTag && tag !== newTag);
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

      const payload: any = {
        ...formData,
        amount: parseFloat(formData.amount),
        reviewStatus: 'approved' as const,
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
        await axios.put(
          `${API_URL}/api/transactions/${editingTransaction.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Transaction updated successfully');
      } else {
        await axios.post(
          `${API_URL}/api/transactions`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Transaction created successfully');
      }

      handleCloseDialog();
      fetchTransactions();
      fetchAccounts(); // Refresh balances
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save transaction');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      setError('');
      setSuccess('');
      
      await axios.delete(`${API_URL}/api/transactions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess('Transaction deleted successfully');
      fetchTransactions();
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete transaction');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;
    if (!window.confirm(`Delete ${selectedTransactions.size} selected transactions?`)) return;

    try {
      setError('');
      setSuccess('');

      await axios.delete(`${API_URL}/api/transactions/bulk`, {
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
    
    const headers = ['Date', 'Type', 'Account', 'Category', 'Description', 'Amount', 'Tags', 'Status'];
    const rows = filteredTransactions.map(t => [
      dayjs(t.date).format('YYYY-MM-DD'),
      t.type.toUpperCase(),
      getAccountName(t.accountId),
      getCategoryName(t.categoryId),
      t.description,
      t.amount.toFixed(2),
      t.tags?.join('; ') || '',
      t.reviewStatus,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
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
      setSelectedTransactions(new Set(getFilteredTransactions().map(t => t.id)));
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
    return transactions.filter(transaction => {
      const matchesSearch = searchQuery === '' || 
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
    return accounts.find(a => a.id === accountId)?.name || 'Unknown';
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.color || '#667eea';
  };

  const formatCurrency = (amount: number, accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    const currency = account?.currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatUserCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
    }).format(amount);
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
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = filteredTransactions
    .filter(t => t.type === 'debit')
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
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
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
            <Card sx={{ 
              background: netAmount >= 0 
                ? 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)'
                : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)'
            }}>
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

                {(searchQuery || selectedType !== 'all' || selectedAccount || selectedCategory || 
                  selectedTags.length > 0 || reviewStatus !== 'all') && (
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
                    {accounts.map(account => (
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
                    {categories.map(category => (
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
                    options={tags.map(t => t.name)}
                    value={selectedTags}
                    onChange={(_, value) => setSelectedTags(value)}
                    renderInput={(params) => (
                      <TextField {...params} label="Tags" size="small" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option}
                          size="small"
                          {...getTagProps({ index })}
                        />
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
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                      <Typography variant="body1" color="text.secondary">
                        No transactions found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      hover
                      selected={selectedTransactions.has(transaction.id)}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedTransactions.has(transaction.id)}
                          onChange={() => handleSelectTransaction(transaction.id)}
                        />
                      </TableCell>
                      <TableCell>{dayjs(transaction.date).format('MMM DD, YYYY')}</TableCell>
                      <TableCell>
                        <Chip
                          icon={transaction.type === 'credit' ? <CreditIcon /> : <DebitIcon />}
                          label={transaction.type.toUpperCase()}
                          color={transaction.type === 'credit' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{getAccountName(transaction.accountId)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getCategoryName(transaction.categoryId)}
                          size="small"
                          sx={{
                            backgroundColor: `${getCategoryColor(transaction.categoryId)}20`,
                            color: getCategoryColor(transaction.categoryId),
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{transaction.description}</Typography>
                          {transaction.merchantName && (
                            <Typography variant="caption" color="text.secondary">
                              {transaction.merchantName}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {transaction.tags?.map((tag, idx) => (
                            <Chip key={idx} label={tag} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={transaction.type === 'credit' ? 'success.main' : 'error.main'}
                        >
                          {transaction.type === 'credit' ? '+' : '-'}
                          {formatCurrency(transaction.amount, transaction.accountId)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.reviewStatus}
                          size="small"
                          color={
                            transaction.reviewStatus === 'approved'
                              ? 'success'
                              : transaction.reviewStatus === 'pending'
                              ? 'warning'
                              : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(transaction)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(transaction.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
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
                                currency: accounts.find(a => a.id === formData.accountId)?.currency || user?.currency || 'USD',
                              })
                                .format(0)
                                .replace(/[\d.,]/g, '')
                            : user?.currency === 'USD' ? '$' : 
                              user?.currency === 'EUR' ? '€' : 
                              user?.currency === 'GBP' ? '£' : 
                              user?.currency === 'INR' ? '₹' : '$'}
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
                    {accounts.map(account => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Category"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    fullWidth
                    required
                  >
                    {categories.map(category => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
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

                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    freeSolo
                    options={tags.map(t => t.name)}
                    value={formData.tags}
                    onChange={(_, value) => setFormData({ ...formData, tags: value })}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tags"
                        placeholder="Add tags..."
                        helperText="Press Enter to add custom tags"
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          icon={<TagIcon />}
                          label={option}
                          {...getTagProps({ index })}
                        />
                      ))
                    }
                  />
                </Grid>

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
                            ? [...formData.tags, 'recurring'].filter((tag, index, self) => self.indexOf(tag) === index) // Add and dedupe
                            : formData.tags.filter(tag => tag !== 'recurring'); // Remove tag
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
                        onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value as any })}
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
                        onChange={(e) => setFormData({ ...formData, recurrenceDay: parseInt(e.target.value) || 1 })}
                        fullWidth
                        InputProps={{ inputProps: { min: 1, max: 31 } }}
                        helperText="Day when transaction should repeat"
                        disabled={formData.recurrencePattern === 'daily' || formData.recurrencePattern === 'weekly'}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        label="End Date (Optional)"
                        type="date"
                        value={formData.recurrenceEndDate}
                        onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
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
              disabled={!formData.amount || !formData.accountId || !formData.categoryId || !formData.description}
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
