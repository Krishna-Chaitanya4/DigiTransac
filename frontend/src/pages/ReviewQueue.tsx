import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  IconButton,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  InputAdornment,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FileDownload as FileDownloadIcon,
  CheckBox as CheckBoxIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface PendingExpense {
  id: string;
  amount: number;
  description: string;
  merchantName?: string;
  categoryId: string;
  date: string;
  parsedData?: {
    rawText: string;
    bankName: string;
    cardLast4?: string;
    confidence: number;
  };
  reviewStatus: 'pending';
}

interface Category {
  id: string;
  name: string;
  color?: string;
}

const ReviewQueue: React.FC = () => {
  const { token, user } = useAuth();
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ categoryId: string; amount: string; description: string }>({
    categoryId: '',
    amount: '',
    description: '',
  });
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [amountMin, setAmountMin] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Bulk selection states
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    fetchPendingExpenses();
    fetchCategories();
  }, []);

  const fetchPendingExpenses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { reviewStatus: 'pending' },
      });
      setPendingExpenses(response.data.expenses || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch pending expenses');
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
      setCategories(allCategories.filter((cat: any) => !cat.isFolder));
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
    }
  };

  // Filter pending expenses
  const getFilteredExpenses = () => {
    return pendingExpenses.filter(expense => {
      // Search filter
      if (searchQuery && !expense.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !expense.merchantName?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (selectedCategory && expense.categoryId !== selectedCategory) {
        return false;
      }
      
      // Date range filter
      if (startDate && dayjs(expense.date).isBefore(startDate, 'day')) {
        return false;
      }
      if (endDate && dayjs(expense.date).isAfter(endDate, 'day')) {
        return false;
      }
      
      // Amount filter
      if (amountMin && expense.amount < parseFloat(amountMin)) {
        return false;
      }
      
      return true;
    });
  };

  const filteredExpenses = getFilteredExpenses();

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setStartDate(null);
    setEndDate(null);
    setAmountMin('');
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedCategory) count++;
    if (startDate || endDate) count++;
    if (amountMin) count++;
    return count;
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedExpenses(new Set());
      setSelectAll(false);
    } else {
      setSelectedExpenses(new Set(filteredExpenses.map(e => e.id)));
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
    setSelectAll(newSelected.size === filteredExpenses.length);
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    if (selectedExpenses.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedExpenses).map(id =>
          axios.put(
            `${API_URL}/api/expenses/${id}`,
            { reviewStatus: 'approved' },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      );
      setPendingExpenses(pendingExpenses.filter(e => !selectedExpenses.has(e.id)));
      setSelectedExpenses(new Set());
      setSelectAll(false);
    } catch (err: any) {
      setError('Failed to approve expenses');
    }
  };

  const handleBulkReject = async () => {
    if (selectedExpenses.size === 0) return;
    
    if (!window.confirm(`Are you sure you want to reject ${selectedExpenses.size} expense(s)?`)) {
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
      setPendingExpenses(pendingExpenses.filter(e => !selectedExpenses.has(e.id)));
      setSelectedExpenses(new Set());
      setSelectAll(false);
    } catch (err: any) {
      setError('Failed to reject expenses');
    }
  };

  // Check if a quick filter is active
  const isQuickFilterActive = (filter: string) => {
    const today = dayjs();
    
    switch (filter) {
      case 'thisWeek':
        return startDate?.isSame(today.startOf('week'), 'day') && 
               endDate?.isSame(today, 'day');
      case 'last7Days':
        return startDate?.isSame(today.subtract(7, 'day'), 'day') && 
               endDate?.isSame(today, 'day');
      default:
        return false;
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const dataToExport = selectedExpenses.size > 0
      ? filteredExpenses.filter(e => selectedExpenses.has(e.id))
      : filteredExpenses;

    if (dataToExport.length === 0) {
      setError('No expenses to export');
      return;
    }

    const headers = ['Date', 'Merchant', 'Description', 'Category', 'Amount', 'Bank', 'Confidence'];
    const rows = dataToExport.map(expense => [
      dayjs(expense.date).format('YYYY-MM-DD'),
      expense.merchantName || '',
      expense.description || '',
      getCategoryName(expense.categoryId),
      expense.amount.toFixed(2),
      expense.parsedData?.bankName || 'N/A',
      expense.parsedData ? `${Math.round(expense.parsedData.confidence * 100)}%` : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `review_queue_${dayjs().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEdit = (expense: PendingExpense) => {
    setEditingId(expense.id);
    setEditData({
      categoryId: expense.categoryId,
      amount: expense.amount.toString(),
      description: expense.description,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleApprove = async (expenseId: string) => {
    try {
      let updateData: any = { reviewStatus: 'approved' };

      // If editing, include the edited data
      if (editingId === expenseId) {
        updateData = {
          ...updateData,
          categoryId: editData.categoryId,
          amount: parseFloat(editData.amount),
          description: editData.description,
        };
      }

      await axios.put(
        `${API_URL}/api/expenses/${expenseId}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPendingExpenses(pendingExpenses.filter(e => e.id !== expenseId));
      setEditingId(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve expense');
    }
  };

  const handleReject = async (expenseId: string) => {
    try {
      await axios.delete(`${API_URL}/api/expenses/${expenseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingExpenses(pendingExpenses.filter(e => e.id !== expenseId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject expense');
    }
  };

  const handleApproveAll = async () => {
    try {
      await Promise.all(
        pendingExpenses.map(expense =>
          axios.put(
            `${API_URL}/api/expenses/${expense.id}`,
            { reviewStatus: 'approved' },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      );
      setPendingExpenses([]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve all expenses');
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#667eea';
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
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Review Queue
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'} 
              {getActiveFilterCount() > 0 && ` (filtered from ${pendingExpenses.length})`}
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
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
            {filteredExpenses.length > 0 && selectedExpenses.size === 0 && (
              <Button
                variant="contained"
                startIcon={<ApproveIcon />}
                onClick={handleApproveAll}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #63408a 100%)',
                  },
                }}
              >
                Approve All
              </Button>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Filter Section */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {/* Search and Filter Controls */}
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search merchant or description..."
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
                <Button
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExportCSV}
                  variant="outlined"
                >
                  Export
                </Button>
              </Grid>
            </Grid>

            {/* Quick Filter Chips */}
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip
                label="High Value (>₹1000)"
                onClick={() => setAmountMin(amountMin === '1000' ? '' : '1000')}
                variant={amountMin === '1000' ? 'filled' : 'outlined'}
                color={amountMin === '1000' ? 'primary' : 'default'}
                size="small"
              />
              <Chip
                label="This Week"
                onClick={() => {
                  setStartDate(dayjs().startOf('week'));
                  setEndDate(dayjs());
                }}
                variant={isQuickFilterActive('thisWeek') ? 'filled' : 'outlined'}
                color={isQuickFilterActive('thisWeek') ? 'primary' : 'default'}
                size="small"
              />
              <Chip
                label="Last 7 Days"
                onClick={() => {
                  setStartDate(dayjs().subtract(7, 'day'));
                  setEndDate(dayjs());
                }}
                variant={isQuickFilterActive('last7Days') ? 'filled' : 'outlined'}
                color={isQuickFilterActive('last7Days') ? 'primary' : 'default'}
                size="small"
              />
            </Box>

            {/* Advanced Filters */}
            <Collapse in={showFilters}>
              <Divider sx={{ my: 2 }} />
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
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </MenuItem>
                      ))}
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

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Min Amount"
                    type="number"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{user?.currency || '₹'}</InputAdornment>,
                    }}
                  />
                </Grid>
              </Grid>
            </Collapse>

            {/* Bulk Actions */}
            {selectedExpenses.size > 0 && (
              <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={handleBulkApprove}
                  startIcon={<CheckBoxIcon />}
                >
                  Approve ({selectedExpenses.size})
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={handleBulkReject}
                  startIcon={<DeleteIcon />}
                >
                  Reject ({selectedExpenses.size})
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>

        {filteredExpenses.length === 0 ? (
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
            <Box textAlign="center" py={6}>
              <ApproveIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {pendingExpenses.length === 0 ? 'All caught up!' : 'No expenses match your filters'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {pendingExpenses.length === 0 
                  ? 'No expenses pending review'
                  : 'Try adjusting your filters to see more results'
                }
              </Typography>
              {pendingExpenses.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  sx={{ mt: 2 }}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {/* Select All Checkbox */}
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" gap={1}>
              <Checkbox
                checked={selectAll}
                onChange={handleSelectAll}
                indeterminate={selectedExpenses.size > 0 && !selectAll}
              />
              <Typography variant="body2" color="text.secondary">
                Select all {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Grid>
          
          {filteredExpenses.map((expense) => (
            <Grid item xs={12} key={expense.id}>
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
                  borderColor: selectedExpenses.has(expense.id) ? 'primary.main' : 'warning.light',
                }}
              >
                <CardContent>
                  <Grid container spacing={2}>
                    {/* Checkbox Column */}
                    <Grid item xs={12} md="auto" display="flex" alignItems="center">
                      <Checkbox
                        checked={selectedExpenses.has(expense.id)}
                        onChange={() => handleSelectExpense(expense.id)}
                      />
                    </Grid>
                    
                    {/* Left side - Transaction details */}
                    <Grid item xs={12} md={6}>
                      {editingId === expense.id ? (
                        // Edit mode
                        <Stack spacing={2}>
                          <TextField
                            label="Description"
                            fullWidth
                            value={editData.description}
                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                            size="small"
                          />
                          <TextField
                            label="Amount"
                            type="number"
                            fullWidth
                            value={editData.amount}
                            onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                            size="small"
                          />
                          <TextField
                            select
                            label="Category"
                            fullWidth
                            value={editData.categoryId}
                            onChange={(e) => setEditData({ ...editData, categoryId: e.target.value })}
                            size="small"
                          >
                            {categories.map((category) => (
                              <MenuItem key={category.id} value={category.id}>
                                {category.name}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Stack>
                      ) : (
                        // View mode
                        <>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="h5" fontWeight={700}>
                              {formatCurrency(expense.amount)}
                            </Typography>
                            <Chip
                              label={expense.parsedData?.bankName || 'Unknown Bank'}
                              size="small"
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>
                          <Typography variant="h6" fontWeight={600} mb={1}>
                            {expense.merchantName || expense.description}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <Chip
                              label={getCategoryName(expense.categoryId) || 'No Category'}
                              size="small"
                              sx={{
                                bgcolor: expense.categoryId ? getCategoryColor(expense.categoryId) + '20' : 'error.light',
                                color: expense.categoryId ? getCategoryColor(expense.categoryId) : 'error.dark',
                                borderColor: expense.categoryId ? getCategoryColor(expense.categoryId) : 'error.main',
                              }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(expense.date)}
                            </Typography>
                            {expense.parsedData?.cardLast4 && (
                              <Typography variant="body2" color="text.secondary">
                                •••• {expense.parsedData.cardLast4}
                              </Typography>
                            )}
                          </Box>
                          {expense.parsedData && (
                            <Box
                              sx={{
                                bgcolor: 'action.hover',
                                p: 1.5,
                                borderRadius: 1,
                                borderLeft: 4,
                                borderColor: 'info.main',
                              }}
                            >
                              <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                                <InfoIcon fontSize="small" color="info" />
                                <Typography variant="caption" fontWeight={600}>
                                  Parsed SMS/Email ({Math.round(expense.parsedData.confidence * 100)}% confidence)
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                "{expense.parsedData.rawText.substring(0, 150)}..."
                              </Typography>
                            </Box>
                          )}
                        </>
                      )}
                    </Grid>

                    {/* Right side - Actions */}
                    <Grid item xs={12} md={5}>
                      <Box display="flex" flexDirection="column" gap={1} height="100%" justifyContent="center">
                        {editingId === expense.id ? (
                          <>
                            <Button
                              variant="contained"
                              color="success"
                              fullWidth
                              startIcon={<ApproveIcon />}
                              onClick={() => handleApprove(expense.id)}
                            >
                              Save & Approve
                            </Button>
                            <Button
                              variant="outlined"
                              fullWidth
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="contained"
                              color="success"
                              fullWidth
                              startIcon={<ApproveIcon />}
                              onClick={() => handleApprove(expense.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              fullWidth
                              startIcon={<EditIcon />}
                              onClick={() => handleEdit(expense)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              fullWidth
                              startIcon={<RejectIcon />}
                              onClick={() => handleReject(expense.id)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
    </LocalizationProvider>
  );
};

export default ReviewQueue;
