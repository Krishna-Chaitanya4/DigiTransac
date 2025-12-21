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
  Category as CategoryIcon,
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
  
  // Scope configuration
  scopeType: 'category' | 'tag' | 'account';
  categoryId?: string;
  includeTagIds?: string[];
  excludeTagIds?: string[];
  accountId?: string;
  
  // Calculation type
  calculationType: 'debit' | 'credit' | 'net';
  
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
    scopeType: 'category' as 'category' | 'tag' | 'account',
    categoryId: '',
    includeTagIds: [] as string[],
    excludeTagIds: [] as string[],
    accountId: '',
    calculationType: 'debit' as 'debit' | 'credit' | 'net',
    amount: '',
    period: 'custom' as 'monthly' | 'yearly' | 'custom',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    alertThreshold: '80',
    enableRollover: false,
    rolloverLimit: '',
  });

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
    fetchTags();
    fetchAccounts();
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
      const allCategories = response.data.categories || [];
      // Include both folders and categories for budget selection
      setCategories(allCategories);
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

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.color || '#667eea';
  };

  const getTagName = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    return tag?.name || 'Unknown';
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const handleOpenDialog = () => {
    setFormData({
      scopeType: 'category',
      categoryId: '',
      includeTagIds: [],
      excludeTagIds: [],
      accountId: '',
      calculationType: 'debit',
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
  };

  const handleEditBudget = (budget: Budget) => {
    setFormData({
      scopeType: budget.scopeType,
      categoryId: budget.categoryId || '',
      includeTagIds: budget.includeTagIds || [],
      excludeTagIds: budget.excludeTagIds || [],
      accountId: budget.accountId || '',
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
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBudget(null);
  };

  const handleSubmit = async () => {
    try {
      const payload: any = {
        scopeType: formData.scopeType,
        calculationType: formData.calculationType,
        amount: formData.amount,
        period: formData.period,
        startDate: formData.startDate,
        endDate: formData.endDate,
        alertThreshold: parseInt(formData.alertThreshold),
        enableRollover: formData.enableRollover,
      };

      // Add scope-specific fields
      if (formData.scopeType === 'category') {
        payload.categoryId = formData.categoryId;
      } else if (formData.scopeType === 'tag') {
        if (formData.includeTagIds.length > 0) {
          payload.includeTagIds = formData.includeTagIds;
        }
        if (formData.excludeTagIds.length > 0) {
          payload.excludeTagIds = formData.excludeTagIds;
        }
      } else if (formData.scopeType === 'account') {
        payload.accountId = formData.accountId;
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
  };

  const handleDeleteClick = (budgetId: string) => {
    setConfirmDelete({ open: true, budgetId });
  };

  const handleDeleteBudget = async () => {
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
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, user?.currency || 'USD');
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
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Budgets</Typography>
        </Box>
        <GridSkeleton count={4} component={BudgetCardSkeleton} />
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
                      <Box display="flex" alignItems="center" gap={0.5} mb={1} flexWrap="wrap">
                        {/* Scope chip */}
                        {budget.scopeType === 'category' && budget.categoryId && (
                          <>
                            <Chip
                              icon={
                                categories.find((c) => c.id === budget.categoryId)?.isFolder ? (
                                  <span>📁</span>
                                ) : (
                                  <span>📄</span>
                                )
                              }
                              label={getCategoryName(budget.categoryId)}
                              size="small"
                              sx={{
                                bgcolor: getCategoryColor(budget.categoryId) + '20',
                                color: getCategoryColor(budget.categoryId),
                              }}
                            />
                            {categories.find((c) => c.id === budget.categoryId)?.isFolder && (
                              <Chip
                                label="Folder"
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            )}
                          </>
                        )}
                        {budget.scopeType === 'tag' && (
                          <>
                            {/* Include Tags */}
                            {budget.includeTagIds && budget.includeTagIds.length > 0 && (
                              <>
                                {budget.includeTagIds.map((tagId) => (
                                  <Chip
                                    key={tagId}
                                    icon={<LabelIcon sx={{ fontSize: 14 }} />}
                                    label={getTagName(tagId)}
                                    size="small"
                                    sx={{
                                      bgcolor: '#4caf5020',
                                      color: '#4caf50',
                                      fontWeight: 500,
                                    }}
                                  />
                                ))}
                                {budget.includeTagIds.length > 1 && (
                                  <Chip
                                    label="OR"
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', color: '#4caf50', borderColor: '#4caf50' }}
                                  />
                                )}
                              </>
                            )}
                            
                            {/* Exclude Tags */}
                            {budget.excludeTagIds && budget.excludeTagIds.length > 0 && (
                              <>
                                {budget.includeTagIds && budget.includeTagIds.length > 0 && (
                                  <Chip
                                    label="EXCEPT"
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', mx: 0.5 }}
                                  />
                                )}
                                {budget.excludeTagIds.map((tagId) => (
                                  <Chip
                                    key={tagId}
                                    icon={<LabelIcon sx={{ fontSize: 14 }} />}
                                    label={getTagName(tagId)}
                                    size="small"
                                    sx={{
                                      bgcolor: '#f4433620',
                                      color: '#f44336',
                                      fontWeight: 500,
                                    }}
                                  />
                                ))}
                              </>
                            )}
                          </>
                        )}
                        {budget.scopeType === 'account' && budget.accountId && (
                          <Chip
                            icon={<AccountIcon sx={{ fontSize: 14 }} />}
                            label={getAccountName(budget.accountId)}
                            size="small"
                            sx={{
                              bgcolor: '#4ecdc420',
                              color: '#4ecdc4',
                            }}
                          />
                        )}
                        
                        {/* Calculation type chip */}
                        <Chip
                          label={
                            budget.calculationType === 'debit'
                              ? 'Expenses'
                              : budget.calculationType === 'credit'
                              ? 'Income'
                              : 'Net'
                          }
                          size="small"
                          color={
                            budget.calculationType === 'debit'
                              ? 'error'
                              : budget.calculationType === 'credit'
                              ? 'success'
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
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingBudget ? 'Edit Budget' : 'Create New Budget'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Budget Scope Type Selection */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                What do you want to budget?
              </Typography>
              <ToggleButtonGroup
                value={formData.scopeType}
                exclusive
                onChange={(_, newScope) => {
                  if (newScope !== null) {
                    setFormData({ ...formData, scopeType: newScope });
                  }
                }}
                fullWidth
                size="small"
              >
                <ToggleButton value="category">
                  <CategoryIcon sx={{ mr: 1 }} fontSize="small" />
                  Category
                </ToggleButton>
                <ToggleButton value="tag">
                  <LabelIcon sx={{ mr: 1 }} fontSize="small" />
                  Tags
                </ToggleButton>
                <ToggleButton value="account">
                  <AccountIcon sx={{ mr: 1 }} fontSize="small" />
                  Account
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Scope-specific selectors */}
            {formData.scopeType === 'category' && (
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
            )}

            {formData.scopeType === 'tag' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                  Tag Filters
                </Typography>
                
                {/* Include Tags */}
                <TextField
                  select
                  label="Include Tags (optional)"
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
                  helperText="Transactions must have at least one of these tags"
                  sx={{ mb: 2 }}
                >
                  {tags.length === 0 ? (
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
                  label="Exclude Tags (optional)"
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
                  helperText="Transactions with these tags will be ignored"
                >
                  {tags.length === 0 ? (
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

                {formData.includeTagIds.length === 0 && formData.excludeTagIds.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Please select at least one include or exclude tag
                  </Alert>
                )}
              </Box>
            )}

            {formData.scopeType === 'account' && (
              <TextField
                select
                label="Account"
                fullWidth
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                required
                helperText="Budget for all transactions in this account"
              >
                {accounts.length === 0 ? (
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
            )}

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
                <ToggleButton value="credit">
                  Income Only
                </ToggleButton>
                <ToggleButton value="net">
                  Net (Income - Expenses)
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {formData.calculationType === 'debit' && 'Track outgoing expenses only'}
                {formData.calculationType === 'credit' && 'Track incoming income only'}
                {formData.calculationType === 'net' && 'Track net flow (positive = saving, negative = spending)'}
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
              (formData.scopeType === 'category' && !formData.categoryId) ||
              (formData.scopeType === 'tag' && formData.includeTagIds.length === 0 && formData.excludeTagIds.length === 0) ||
              (formData.scopeType === 'account' && !formData.accountId)
            }
          >
            {editingBudget ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

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
