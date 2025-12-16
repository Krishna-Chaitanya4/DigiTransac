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
  FormControl,
  InputLabel,
  Select,
  Slider,
  Grid,
  Collapse,
  Divider,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FileDownload as FileDownloadIcon,
  ViewList as ViewListIcon,
  CalendarToday as CalendarIcon,
  Store as StoreIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Category {
  id: string;
  name: string;
  isFolder: boolean;
  color?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  bankName?: string;
  last4?: string;
}

interface Expense {
  id: string;
  userId: string;
  categoryId: string;
  paymentMethodId?: string;
  amount: number;
  description: string;
  date: string;
  isRecurring: boolean;
  tags?: string[];
  notes?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

const Expenses: React.FC = () => {
  const { token, user } = useAuth();
  const location = useLocation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [reviewStatus, setReviewStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [amountRange, setAmountRange] = useState<number[]>([0, 10000]);
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [showFilters, setShowFilters] = useState(false);
  const [groupBy, setGroupBy] = useState<string>('none');
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const [formData, setFormData] = useState({
    categoryId: '',
    paymentMethodId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    fetchPaymentMethods();

    // Check if navigated from Analytics with a filter
    if (location.state?.filterCategoryId) {
      setSelectedCategory(location.state.filterCategoryId);
      setShowFilters(true);
    }
  }, []);

  // Calculate max amount for slider
  const maxExpenseAmount = expenses.length > 0
    ? Math.max(...expenses.map(e => e.amount))
    : 10000;

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (reviewStatus !== 'all') {
        params.reviewStatus = reviewStatus;
      }
      const response = await axios.get(`${API_URL}/api/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setExpenses(response.data.expenses || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allCategories = response.data.categories || [];
      // Filter out folders - only show actual categories
      setCategories(allCategories.filter((cat: Category) => !cat.isFolder));
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPaymentMethods(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch payment methods:', err);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getPaymentMethodName = (paymentMethodId?: string) => {
    if (!paymentMethodId) return '-';
    const method = paymentMethods.find(m => m.id === paymentMethodId);
    return method?.name || 'Unknown';
  };

  const handleOpenDialog = () => {
    setFormData({
      categoryId: '',
      paymentMethodId: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setEditingExpense(null);
    setOpenDialog(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setFormData({
      categoryId: expense.categoryId,
      paymentMethodId: expense.paymentMethodId || '',
      amount: expense.amount.toString(),
      description: expense.description,
      date: new Date(expense.date).toISOString().split('T')[0],
      notes: expense.notes || '',
    });
    setEditingExpense(expense);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingExpense(null);
    setFormData({
      categoryId: '',
      paymentMethodId: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingExpense) {
        await axios.put(
          `${API_URL}/api/expenses/${editingExpense.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${API_URL}/api/expenses`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      fetchExpenses();
      handleCloseDialog();
    } catch (err: any) {
      console.error('Error saving expense:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save expense';
      setError(errorMessage);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!window.confirm(`Are you sure you want to delete this expense: "${expense.description}"?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/expenses/${expense.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchExpenses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  // Filter and sort expenses
  const getFilteredAndSortedExpenses = () => {
    let filtered = expenses.filter((expense) => {
      // Search filter
      if (searchQuery && !expense.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (selectedCategory && expense.categoryId !== selectedCategory) {
        return false;
      }

      // Payment method filter
      if (selectedPaymentMethod && expense.paymentMethodId !== selectedPaymentMethod) {
        return false;
      }

      // Date range filter
      const expenseDate = dayjs(expense.date);
      if (startDate && expenseDate.isBefore(startDate, 'day')) {
        return false;
      }
      if (endDate && expenseDate.isAfter(endDate, 'day')) {
        return false;
      }

      // Amount range filter
      if (expense.amount < amountRange[0] || expense.amount > amountRange[1]) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        case 'category':
          return getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId));
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredExpenses = getFilteredAndSortedExpenses();

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedPaymentMethod('');
    setReviewStatus('all');
    setStartDate(dayjs().startOf('month'));
    setEndDate(dayjs());
    setAmountRange([0, maxExpenseAmount]);
    setSortBy('date-desc');
  };

  const handleQuickFilter = (filter: string) => {
    handleClearFilters();
    const today = dayjs();
    
    switch (filter) {
      case 'pending':
        setReviewStatus('pending');
        break;
      case 'highValue':
        setAmountRange([1000, maxExpenseAmount]);
        break;
      case 'thisWeek':
        setStartDate(today.startOf('week'));
        setEndDate(today.endOf('week'));
        break;
      case 'lastWeek':
        setStartDate(today.subtract(1, 'week').startOf('week'));
        setEndDate(today.subtract(1, 'week').endOf('week'));
        break;
      case 'thisMonth':
        setStartDate(today.startOf('month'));
        setEndDate(today.endOf('month'));
        break;
      case 'lastMonth':
        setStartDate(today.subtract(1, 'month').startOf('month'));
        setEndDate(today.subtract(1, 'month').endOf('month'));
        break;
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedCategory) count++;
    if (selectedPaymentMethod) count++;
    if (reviewStatus !== 'all') count++;
    if (!startDate?.isSame(dayjs().startOf('month'), 'day') || !endDate?.isSame(dayjs(), 'day')) count++;
    if (amountRange[0] !== 0 || amountRange[1] !== maxExpenseAmount) count++;
    return count;
  };

  // Check if a quick filter is active
  const isQuickFilterActive = (filter: string) => {
    const today = dayjs();
    
    switch (filter) {
      case 'thisWeek':
        return startDate?.isSame(today.startOf('week'), 'day') && 
               endDate?.isSame(today.endOf('week'), 'day');
      case 'lastWeek':
        return startDate?.isSame(today.subtract(1, 'week').startOf('week'), 'day') && 
               endDate?.isSame(today.subtract(1, 'week').endOf('week'), 'day');
      case 'thisMonth':
        return startDate?.isSame(today.startOf('month'), 'day') && 
               endDate?.isSame(today.endOf('month'), 'day');
      case 'lastMonth':
        return startDate?.isSame(today.subtract(1, 'month').startOf('month'), 'day') && 
               endDate?.isSame(today.subtract(1, 'month').endOf('month'), 'day');
      default:
        return false;
    }
  };

  // Group expenses by category, date, or merchant
  const getGroupedExpenses = () => {
    const filtered = getFilteredAndSortedExpenses();
    
    if (groupBy === 'none') {
      return { grouped: false, expenses: filtered };
    }

    const groups: { [key: string]: { expenses: Expense[], total: number } } = {};

    filtered.forEach(expense => {
      let groupKey: string;
      
      if (groupBy === 'category') {
        const category = categories.find(c => c.id === expense.categoryId);
        groupKey = category ? category.name : 'Uncategorized';
      } else if (groupBy === 'date') {
        groupKey = dayjs(expense.date).format('MMMM YYYY');
      } else if (groupBy === 'merchant') {
        groupKey = expense.description || 'No Description';
      } else {
        groupKey = 'Other';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { expenses: [], total: 0 };
      }
      groups[groupKey].expenses.push(expense);
      groups[groupKey].total += expense.amount;
    });

    // Sort groups by total spending (descending)
    const sortedGroups = Object.entries(groups).sort((a, b) => b[1].total - a[1].total);

    return {
      grouped: true,
      groups: sortedGroups.map(([name, data]) => ({
        name,
        expenses: data.expenses,
        total: data.total,
        count: data.expenses.length
      }))
    };
  };

  // Handle bulk selection
  const handleSelectAll = () => {
    const filtered = getFilteredAndSortedExpenses();
    if (selectAll) {
      setSelectedExpenses(new Set());
      setSelectAll(false);
    } else {
      setSelectedExpenses(new Set(filtered.map(e => e.id)));
      setSelectAll(true);
    }
  };

  const handleSelectExpense = (expenseId: string) => {
    const newSelected = new Set(selectedExpenses);
    if (newSelected.has(expenseId)) {
      newSelected.delete(expenseId);
    } else {
      newSelected.add(expenseId);
    }
    setSelectedExpenses(newSelected);
    setSelectAll(newSelected.size === getFilteredAndSortedExpenses().length);
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedExpenses.size === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedExpenses.size} expense(s)?`)) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedExpenses).map(id =>
          axios.delete(`${API_URL}/api/expenses/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );
      setSelectedExpenses(new Set());
      setSelectAll(false);
      fetchExpenses();
    } catch (err: any) {
      console.error('Error deleting expenses:', err);
      setError('Failed to delete expenses');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const filtered = getFilteredAndSortedExpenses();
    const dataToExport = selectedExpenses.size > 0
      ? filtered.filter(e => selectedExpenses.has(e.id))
      : filtered;

    if (dataToExport.length === 0) {
      setError('No expenses to export');
      return;
    }

    const headers = ['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Status', 'Notes'];
    const rows = dataToExport.map(expense => {
      const category = categories.find(c => c.id === expense.categoryId);
      const paymentMethod = paymentMethods.find(p => p.id === expense.paymentMethodId);
      
      return [
        dayjs(expense.date).format('YYYY-MM-DD'),
        category?.name || 'N/A',
        expense.description || '',
        expense.amount.toFixed(2),
        paymentMethod?.name || 'N/A',
        expense.reviewStatus || 'pending',
        expense.notes || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${dayjs().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
            Expenses
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #63408a 100%)',
              },
            }}
          >
            Add Expense
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Filter Section */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {/* Search and Quick Filters Row */}
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
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
              <Grid item xs={12} md={6} display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
                <Button
                  size="small"
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                  endIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  variant={getActiveFilterCount() > 0 ? 'contained' : 'outlined'}
                >
                  Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
                </Button>
                {getActiveFilterCount() > 0 && (
                  <Button
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={handleClearFilters}
                    variant="outlined"
                  >
                    Clear All
                  </Button>
                )}
              </Grid>
            </Grid>

            {/* Quick Filter Chips */}
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip
                label="Over ₹1000"
                onClick={() => handleQuickFilter('highValue')}
                variant={(amountRange[0] === 1000) ? 'filled' : 'outlined'}
                color={(amountRange[0] === 1000) ? 'primary' : 'default'}
                size="small"
              />
              <Chip
                label="This Week"
                onClick={() => handleQuickFilter('thisWeek')}
                variant={isQuickFilterActive('thisWeek') ? 'filled' : 'outlined'}
                color={isQuickFilterActive('thisWeek') ? 'primary' : 'default'}
                size="small"
              />
              <Chip
                label="Last Week"
                onClick={() => handleQuickFilter('lastWeek')}
                variant={isQuickFilterActive('lastWeek') ? 'filled' : 'outlined'}
                color={isQuickFilterActive('lastWeek') ? 'primary' : 'default'}
                size="small"
              />
              <Chip
                label="This Month"
                onClick={() => handleQuickFilter('thisMonth')}
                variant={isQuickFilterActive('thisMonth') ? 'filled' : 'outlined'}
                color={isQuickFilterActive('thisMonth') ? 'primary' : 'default'}
                size="small"
              />
              <Chip
                label="Last Month"
                onClick={() => handleQuickFilter('lastMonth')}
                variant={isQuickFilterActive('lastMonth') ? 'filled' : 'outlined'}
                color={isQuickFilterActive('lastMonth') ? 'primary' : 'default'}
                size="small"
              />
            </Box>

            {/* Advanced Filters */}
            <Collapse in={showFilters}>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.filter(cat => !cat.isFolder).map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                      value={selectedPaymentMethod}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      label="Payment Method"
                    >
                      <MenuItem value="">All Methods</MenuItem>
                      {paymentMethods.map((pm) => (
                        <MenuItem key={pm.id} value={pm.id}>
                          {pm.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="all">All Statuses</MenuItem>
                      <MenuItem value="approved">Approved</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
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

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Amount Range: {formatCurrency(amountRange[0])} - {formatCurrency(amountRange[1])}
                  </Typography>
                  <Slider
                    value={amountRange}
                    onChange={(_, value) => setAmountRange(value as number[])}
                    min={0}
                    max={maxExpenseAmount}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => formatCurrency(value)}
                  />
                </Grid>
              </Grid>
            </Collapse>

            {/* Active Filters Display */}
            {getActiveFilterCount() > 0 && (
              <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                <Typography variant="caption" color="text.secondary" alignSelf="center">
                  Active filters:
                </Typography>
                {selectedCategory && (
                  <Chip
                    label={`Category: ${getCategoryName(selectedCategory)}`}
                    onDelete={() => setSelectedCategory('')}
                    size="small"
                    color="primary"
                  />
                )}
                {selectedPaymentMethod && (
                  <Chip
                    label={`Payment: ${getPaymentMethodName(selectedPaymentMethod)}`}
                    onDelete={() => setSelectedPaymentMethod('')}
                    size="small"
                    color="primary"
                  />
                )}
                {searchQuery && (
                  <Chip
                    label={`Search: "${searchQuery}"`}
                    onDelete={() => setSearchQuery('')}
                    size="small"
                    color="primary"
                  />
                )}
              </Box>
            )}

            {/* Results Info and Sort */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2} flexWrap="wrap" gap={2}>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  Showing {filteredExpenses.length} of {expenses.length} expenses
                </Typography>
                {selectedExpenses.size > 0 && (
                  <Chip
                    label={`${selectedExpenses.size} selected`}
                    size="small"
                    color="primary"
                    onDelete={() => {
                      setSelectedExpenses(new Set());
                      setSelectAll(false);
                    }}
                  />
                )}
              </Box>
              <Box display="flex" gap={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Group by</InputLabel>
                  <Select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    label="Group by"
                  >
                    <MenuItem value="none">
                      <Box display="flex" alignItems="center" gap={1}>
                        <ViewListIcon fontSize="small" />
                        None
                      </Box>
                    </MenuItem>
                    <MenuItem value="category">
                      <Box display="flex" alignItems="center" gap={1}>
                        <ViewListIcon fontSize="small" />
                        Category
                      </Box>
                    </MenuItem>
                    <MenuItem value="date">
                      <Box display="flex" alignItems="center" gap={1}>
                        <CalendarIcon fontSize="small" />
                        Date
                      </Box>
                    </MenuItem>
                    <MenuItem value="merchant">
                      <Box display="flex" alignItems="center" gap={1}>
                        <StoreIcon fontSize="small" />
                        Merchant
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Sort by</InputLabel>
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    label="Sort by"
                  >
                    <MenuItem value="date-desc">Date (Newest)</MenuItem>
                    <MenuItem value="date-asc">Date (Oldest)</MenuItem>
                    <MenuItem value="amount-desc">Amount (High to Low)</MenuItem>
                    <MenuItem value="amount-asc">Amount (Low to High)</MenuItem>
                    <MenuItem value="category">Category</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Bulk Actions Bar */}
            {selectedExpenses.size > 0 && (
              <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={handleBulkDelete}
                  startIcon={<DeleteIcon />}
                >
                  Delete ({selectedExpenses.size})
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleExportCSV}
                  startIcon={<FileDownloadIcon />}
                >
                  Export Selected
                </Button>
              </Box>
            )}
            {selectedExpenses.size === 0 && (
              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleExportCSV}
                  startIcon={<FileDownloadIcon />}
                >
                  Export All
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

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
          {filteredExpenses.length === 0 ? (
            <Box textAlign="center" py={6}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {expenses.length === 0 ? 'No expenses yet' : 'No expenses match your filters'}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {expenses.length === 0 
                  ? 'Start tracking your expenses by adding your first one'
                  : 'Try adjusting your filters to see more results'
                }
              </Typography>
              {expenses.length === 0 ? (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleOpenDialog}
                >
                  Add Expense
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectAll}
                        onChange={handleSelectAll}
                        indeterminate={selectedExpenses.size > 0 && !selectAll}
                      />
                    </TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Payment Method</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const groupedData = getGroupedExpenses();
                    
                    if (!groupedData.grouped) {
                      // Regular ungrouped view
                      return groupedData.expenses?.map((expense) => (
                        <TableRow 
                          key={expense.id} 
                          hover
                          selected={selectedExpenses.has(expense.id)}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedExpenses.has(expense.id)}
                              onChange={() => handleSelectExpense(expense.id)}
                            />
                          </TableCell>
                          <TableCell>{formatDate(expense.date)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {expense.description}
                            </Typography>
                            {expense.notes && (
                              <Typography variant="caption" color="text.secondary">
                                {expense.notes}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={
                                categories.find((c) => c.id === expense.categoryId)?.name ||
                                'N/A'
                              }
                              size="small"
                              sx={{
                                bgcolor: categories.find((c) => c.id === expense.categoryId)
                                  ?.color || '#ccc',
                                color: '#fff',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {paymentMethods.find((pm) => pm.id === expense.paymentMethodId)
                              ?.name || 'N/A'}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={600}>
                              {formatCurrency(expense.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleEditExpense(expense)}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteExpense(expense)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ));
                    } else {
                      // Grouped view
                      return groupedData.groups?.flatMap((group, groupIndex) => [
                        // Group header row
                        <TableRow 
                          key={`group-${groupIndex}`}
                          sx={{ 
                            bgcolor: 'action.hover',
                            '& td': { fontWeight: 600, borderBottom: 2, borderColor: 'divider' }
                          }}
                        >
                          <TableCell colSpan={7}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle2">
                                {group.name} ({group.count} expense{group.count !== 1 ? 's' : ''})
                              </Typography>
                              <Typography variant="subtitle2" color="primary">
                                Total: {formatCurrency(group.total)}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>,
                        // Group expenses
                        ...group.expenses.map((expense) => (
                          <TableRow 
                            key={expense.id} 
                            hover
                            selected={selectedExpenses.has(expense.id)}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedExpenses.has(expense.id)}
                                onChange={() => handleSelectExpense(expense.id)}
                              />
                            </TableCell>
                            <TableCell>{formatDate(expense.date)}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>
                                {expense.description}
                              </Typography>
                              {expense.notes && (
                                <Typography variant="caption" color="text.secondary">
                                  {expense.notes}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={
                                  categories.find((c) => c.id === expense.categoryId)?.name ||
                                  'N/A'
                                }
                                size="small"
                                sx={{
                                  bgcolor: categories.find((c) => c.id === expense.categoryId)
                                    ?.color || '#ccc',
                                  color: '#fff',
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              {paymentMethods.find((pm) => pm.id === expense.paymentMethodId)
                                ?.name || 'N/A'}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600}>
                                {formatCurrency(expense.amount)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => handleEditExpense(expense)}
                                color="primary"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteExpense(expense)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      ]);
                    }
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingExpense ? 'Edit Expense' : 'Add New Expense'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Description"
              fullWidth
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              autoFocus
              required
            />

            <TextField
              select
              label="Category"
              fullWidth
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              required
            >
              {categories.length === 0 ? (
                <MenuItem value="" disabled>
                  No categories available. Create one first.
                </MenuItem>
              ) : (
                categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))
              )}
            </TextField>

            <TextField
              select
              label="Payment Method"
              fullWidth
              value={formData.paymentMethodId}
              onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value })}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {paymentMethods.map((method) => (
                <MenuItem key={method.id} value={method.id}>
                  {method.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Amount"
              type="number"
              fullWidth
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {user?.currency || 'USD'}
                  </InputAdornment>
                ),
              }}
              required
            />

            <TextField
              label="Date"
              type="date"
              fullWidth
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
              required
            />

            <TextField
              label="Notes (Optional)"
              fullWidth
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.description || !formData.categoryId || !formData.amount}
          >
            {editingExpense ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </LocalizationProvider>
  );
};

export default Expenses;
