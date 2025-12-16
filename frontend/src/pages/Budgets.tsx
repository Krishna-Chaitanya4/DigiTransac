import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  LinearProgress,
  Alert,
  CircularProgress,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Category {
  id: string;
  name: string;
  isFolder: boolean;
  color?: string;
  path: string[];
}

interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'yearly' | 'custom';
  startDate: string;
  endDate?: string;
  alertThreshold: number;
  spent?: number;
  remaining?: number;
  percentUsed?: number;
  isOverBudget?: boolean;
  createdAt: string;
  updatedAt: string;
}

const Budgets: React.FC = () => {
  const { token, user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    period: 'custom' as 'monthly' | 'yearly' | 'custom',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    alertThreshold: '80',
  });

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
  }, []);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/budgets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBudgets(response.data.budgets || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch budgets');
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
      // Include both folders and categories for budget selection
      setCategories(allCategories);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#667eea';
  };

  const handleOpenDialog = () => {
    setFormData({
      categoryId: '',
      amount: '',
      period: 'custom' as 'monthly' | 'yearly' | 'custom',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      alertThreshold: '80',
    });
    setEditingBudget(null);
    setOpenDialog(true);
  };

  const handleEditBudget = (budget: Budget) => {
    setFormData({
      categoryId: budget.categoryId,
      amount: budget.amount.toString(),
      period: budget.period,
      startDate: new Date(budget.startDate).toISOString().split('T')[0],
      endDate: budget.endDate ? new Date(budget.endDate).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      alertThreshold: budget.alertThreshold.toString(),
    });
    setEditingBudget(budget);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBudget(null);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        categoryId: formData.categoryId,
        amount: formData.amount,
        period: formData.period,
        startDate: formData.startDate,
        endDate: formData.endDate,
        alertThreshold: parseInt(formData.alertThreshold),
      };

      if (editingBudget) {
        await axios.put(
          `${API_URL}/api/budgets/${editingBudget.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${API_URL}/api/budgets`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      fetchBudgets();
      handleCloseDialog();
    } catch (err: any) {
      console.error('Error saving budget:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save budget';
      setError(errorMessage);
    }
  };

  const handleDeleteBudget = async (budget: Budget) => {
    if (!window.confirm(`Are you sure you want to delete the budget for "${getCategoryName(budget.categoryId)}"?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/budgets/${budget.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBudgets();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete budget');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getProgressColor = (percentUsed: number) => {
    if (percentUsed >= 100) return 'error';
    if (percentUsed >= 80) return 'warning';
    return 'success';
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
        <Typography variant="h4" fontWeight={700}>
          Budgets
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
          Create Budget
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {budgets.length === 0 ? (
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
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No budgets yet
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Create budgets to track your spending limits
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleOpenDialog}
              >
                Create Budget
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {budgets.map((budget) => (
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
                  border: budget.isOverBudget ? '2px solid' : 'none',
                  borderColor: budget.isOverBudget ? 'error.main' : 'transparent',
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                        <Chip
                          icon={categories.find(c => c.id === budget.categoryId)?.isFolder ? <span>📁</span> : <span>📄</span>}
                          label={getCategoryName(budget.categoryId)}
                          size="small"
                          sx={{
                            bgcolor: getCategoryColor(budget.categoryId) + '20',
                            color: getCategoryColor(budget.categoryId),
                          }}
                        />
                        {categories.find(c => c.id === budget.categoryId)?.isFolder && (
                          <Chip 
                            label="Folder Budget" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                      <Typography variant="h5" fontWeight={700}>
                        {formatCurrency(budget.amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(budget.startDate)} - {budget.endDate ? formatDate(budget.endDate) : 'Ongoing'}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEditBudget(budget)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteBudget(budget)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Spent: {formatCurrency(budget.spent || 0)}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color={budget.isOverBudget ? 'error.main' : 'text.primary'}>
                        {budget.percentUsed || 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(budget.percentUsed || 0, 100)}
                      color={getProgressColor(budget.percentUsed || 0)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color={budget.remaining && budget.remaining < 0 ? 'error.main' : 'success.main'}>
                      {budget.remaining && budget.remaining < 0 ? 'Over by ' : 'Remaining: '}
                      {formatCurrency(Math.abs(budget.remaining || 0))}
                    </Typography>
                    {budget.isOverBudget && (
                      <Chip
                        icon={<WarningIcon />}
                        label="Over Budget"
                        size="small"
                        color="error"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingBudget ? 'Edit Budget' : 'Create New Budget'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="Category or Folder"
              fullWidth
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              required
              helperText="Select a folder to budget across all subcategories, or a specific category"
            >
              {categories.length === 0 ? (
                <MenuItem value="" disabled>
                  No categories available. Create one first.
                </MenuItem>
              ) : (
                categories
                  .sort((a, b) => {
                    // Sort by path depth first, then by name
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

            <TextField
              label="Budget Amount"
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
              label="Start Date"
              type="date"
              fullWidth
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
              required
            />

            <TextField
              label="End Date"
              type="date"
              fullWidth
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
              required
            />

            <TextField
              label="Alert Threshold (%)"
              type="number"
              fullWidth
              value={formData.alertThreshold}
              onChange={(e) => setFormData({ ...formData, alertThreshold: e.target.value })}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              helperText="Get notified when spending reaches this percentage"
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.categoryId || !formData.amount || !formData.startDate || !formData.endDate}
          >
            {editingBudget ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Budgets;
