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
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as EditIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

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
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Review Queue
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {pendingExpenses.length} {pendingExpenses.length === 1 ? 'expense' : 'expenses'} pending review
          </Typography>
        </Box>
        {pendingExpenses.length > 0 && (
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {pendingExpenses.length === 0 ? (
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
                All caught up!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No expenses pending review
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {pendingExpenses.map((expense) => (
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
                  borderColor: 'warning.light',
                }}
              >
                <CardContent>
                  <Grid container spacing={2}>
                    {/* Left side - Transaction details */}
                    <Grid item xs={12} md={7}>
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
  );
};

export default ReviewQueue;
