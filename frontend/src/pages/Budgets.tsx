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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Label as LabelIcon,
  AccountBalance as AccountIcon,
  Savings as SavingsIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import { useToast } from '../components/Toast';
import QuickAddFab from '../components/QuickAddFab';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { BudgetCardSkeleton, GridSkeleton } from '../components/Skeletons';
import ResponsiveDialog from '../components/ResponsiveDialog';
import { useResponsive } from '../hooks/useResponsive';

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
  
  // Legacy fields (for backward compatibility)
  scopeType?: 'category' | 'tag' | 'account';
  categoryId?: string;
  accountId?: string;
  
  // Calculation type
  calculationType: 'debit' | 'net';
  
  amount: number;
  period: 'monthly' | 'yearly' | 'custom';
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
  const { isMobile } = useResponsive();
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

  const [formData, setFormData] = useState({
    name: '',
    categoryIds: [] as string[],
    includeTagIds: [] as string[],
    excludeTagIds: [] as string[],
    accountIds: [] as string[],
    calculationType: 'debit' as 'debit' | 'net',
    amount: '',
    period: 'custom' as 'monthly' | 'yearly' | 'custom',
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
    setFormData({
      name: '',
      categoryIds: [],
      includeTagIds: [],
      excludeTagIds: [],
      accountIds: [],
      calculationType: 'debit' as 'debit' | 'net',
      amount: '',
      period: 'custom' as 'monthly' | 'yearly' | 'custom',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      alertThreshold: '80',
      enableRollover: false,
      rolloverLimit: '',
    });
    setEditingBudget(null);
    setOpenDialog(true);
  }, []);

  const handleEditBudget = useCallback((budget: Budget) => {
    // Handle both new and legacy format
    const categoryIds = budget.categoryIds || (budget.categoryId ? [budget.categoryId] : []);
    const accountIds = budget.accountIds || (budget.accountId ? [budget.accountId] : []);
    
    setFormData({
      name: budget.name || '',
      categoryIds,
      includeTagIds: budget.includeTagIds || [],
      excludeTagIds: budget.excludeTagIds || [],
      accountIds,
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

      // Add multi-select filters (only if non-empty)
      if (formData.categoryIds.length > 0) {
        payload.categoryIds = formData.categoryIds;
      }
      if (formData.includeTagIds.length > 0) {
        payload.includeTagIds = formData.includeTagIds;
      }
      if (formData.excludeTagIds.length > 0) {
        payload.excludeTagIds = formData.excludeTagIds;
      }
      if (formData.accountIds.length > 0) {
        payload.accountIds = formData.accountIds;
      }

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

  const getProgressColor = (percentUsed: number) => {
    if (percentUsed >= 100) return 'error';
    if (percentUsed >= 80) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Budgets</Typography>
        </Box>
        <GridSkeleton count={isMobile ? 2 : 4} component={BudgetCardSkeleton} />
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
          <EmptyState
            icon={<SavingsIcon />}
            title="No budgets yet"
            description="Create budgets to track your spending limits and stay on top of your finances"
            actionLabel="Create Budget"
            onAction={handleOpenDialog}
          />
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
                      {/* Budget Name (if provided) */}
                      {budget.name && (
                        <Typography variant="h6" fontWeight="600" gutterBottom>
                          {budget.name}
                        </Typography>
                      )}
                      
                      <Box display="flex" alignItems="center" gap={0.5} mb={1} flexWrap="wrap">
                        {/* Categories */}
                        {(budget.categoryIds || (budget.categoryId ? [budget.categoryId] : [])).map((catId) => (
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
                        {(budget.accountIds || (budget.accountId ? [budget.accountId] : [])).map((accId) => (
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
                      <Typography variant="h5" fontWeight={700}>
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
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(budget.startDate)} -{' '}
                        {budget.endDate ? formatDate(budget.endDate) : 'Ongoing'}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEditBudget(budget)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(budget.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
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
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <ResponsiveDialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingBudget ? 'Edit Budget' : 'Create New Budget'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Budget Name */}
            <TextField
              label="Budget Name (Optional)"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onBlur={(e) => setFormData({ ...formData, name: e.target.value.trim() })}
              placeholder="e.g., Monthly Groceries, Q1 Marketing"
              helperText="Give your budget a descriptive name for easy identification"
              inputProps={{ maxLength: 100 }}
            />

            <Divider />

            {/* Multi-Select Filters Section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Budget Filters (AND logic between sections, OR within each)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Select filters to define what transactions this budget tracks. At least one filter is required.
              </Typography>

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
                            bgcolor: `${getCategoryColor(catId)}20`,
                            color: getCategoryColor(catId),
                          }} 
                        />
                      ))}
                    </Box>
                  ),
                }}
                helperText="Track these categories (category1 OR category2 OR ...)"
                sx={{ mb: 2 }}
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
                        <Chip key={tagId} label={getTagName(tagId)} size="small" color="success" />
                      ))}
                    </Box>
                  ),
                }}
                helperText="Transactions must have at least one of these tags (tag1 OR tag2 OR ...)"
                sx={{ mb: 2 }}
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
                        <Chip key={tagId} label={getTagName(tagId)} size="small" color="error" />
                      ))}
                    </Box>
                  ),
                }}
                helperText="Transactions must NOT have any of these tags (NOT tag3 AND NOT tag4)"
                sx={{ mb: 2 }}
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
                          color="info"
                        />
                      ))}
                    </Box>
                  ),
                }}
                helperText="Track these accounts (account1 OR account2 OR ...)"
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
                <Alert severity="info" sx={{ mt: 2 }}>
                  Please select at least one filter (categories, tags, or accounts)
                </Alert>
              )}
            </Box>

            <Divider />

            {/* Calculation Type */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Budget Type
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
                size="small"
              >
                <ToggleButton value="debit">
                  Expenses Only
                </ToggleButton>
                <ToggleButton value="net">
                  Net (Expenses - Refunds)
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
                  label="Budget Amount"
                  type="number"
                  fullWidth
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">{user?.currency || 'USD'}</InputAdornment>
                    ),
                  }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Period"
                  fullWidth
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            {/* Date Range */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
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
              </Grid>
              <Grid item xs={12} md={6}>
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
              </Grid>
            </Grid>

            <Divider />

            {/* Alert Configuration */}
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

            {/* Rollover Configuration */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enableRollover}
                    onChange={(e) =>
                      setFormData({ ...formData, enableRollover: e.target.checked })
                    }
                  />
                }
                label="Enable Rollover"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Allow unused budget to carry over to the next period
              </Typography>
              
              {formData.enableRollover && (
                <TextField
                  label="Rollover Limit (optional)"
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
                  sx={{ mt: 2 }}
                />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              !formData.amount ||
              !formData.startDate ||
              !formData.endDate ||
              (formData.categoryIds.length === 0 && 
               formData.includeTagIds.length === 0 && 
               formData.excludeTagIds.length === 0 && 
               formData.accountIds.length === 0)
            }
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
    </Box>
  );
};

export default Budgets;
