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
  Alert,
  CircularProgress,
  Chip,
  Divider,
  FormControlLabel,
  Switch,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalance as BankIcon,
  Savings as SavingsIcon,
  CreditCard as CreditCardIcon,
  TrendingUp as InvestmentIcon,
  Money as CashIcon,
  AccountBalanceWallet as WalletIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'loan' | 'other';
  bankName?: string;
  accountNumber?: string;
  currency: string;
  balance: number;
  initialBalance: number;
  icon?: string;
  color?: string;
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface AccountBalance {
  accountId: string;
  currentBalance: number;
  calculatedBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
}

const accountTypeConfig = {
  checking: { label: 'Checking', icon: BankIcon, color: '#1976d2' },
  savings: { label: 'Savings', icon: SavingsIcon, color: '#388e3c' },
  credit_card: { label: 'Credit Card', icon: CreditCardIcon, color: '#f57c00' },
  investment: { label: 'Investment', icon: InvestmentIcon, color: '#7b1fa2' },
  cash: { label: 'Cash', icon: CashIcon, color: '#689f38' },
  loan: { label: 'Loan', icon: WalletIcon, color: '#d32f2f' },
  other: { label: 'Other', icon: WalletIcon, color: '#757575' },
};

const Accounts: React.FC = () => {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountBalances, setAccountBalances] = useState<Map<string, AccountBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking' as Account['type'],
    bankName: '',
    accountNumber: '',
    currency: 'USD',
    initialBalance: 0,
    color: '#1976d2',
    isDefault: false,
    isActive: true,
    notes: '',
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get(`${API_URL}/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const accountsData = response.data;
      setAccounts(accountsData);

      // Fetch balances for all accounts
      const balancePromises = accountsData.map((account: Account) =>
        axios.get(`${API_URL}/api/accounts/${account.id}/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      const balanceResponses = await Promise.all(balancePromises);
      const balanceMap = new Map<string, AccountBalance>();
      balanceResponses.forEach((res) => {
        balanceMap.set(res.data.accountId, res.data);
      });
      setAccountBalances(balanceMap);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        type: account.type,
        bankName: account.bankName || '',
        accountNumber: account.accountNumber || '',
        currency: account.currency,
        initialBalance: account.initialBalance,
        color: account.color || accountTypeConfig[account.type].color,
        isDefault: account.isDefault,
        isActive: account.isActive,
        notes: account.notes || '',
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        type: 'checking',
        bankName: '',
        accountNumber: '',
        currency: 'USD',
        initialBalance: 0,
        color: '#1976d2',
        isDefault: false,
        isActive: true,
        notes: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAccount(null);
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setSuccess('');

      const payload = {
        ...formData,
        balance: editingAccount ? editingAccount.balance : formData.initialBalance,
      };

      if (editingAccount) {
        await axios.put(
          `${API_URL}/api/accounts/${editingAccount.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Account updated successfully');
      } else {
        await axios.post(
          `${API_URL}/api/accounts`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Account created successfully');
      }

      handleCloseDialog();
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save account');
    }
  };

  const handleDeleteClick = (account: Account) => {
    setAccountToDelete(account);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;

    try {
      setError('');
      setSuccess('');
      
      await axios.delete(`${API_URL}/api/accounts/${accountToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess('Account deleted successfully');
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setDeleteConfirmOpen(false);
    }
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return;

      await axios.put(
        `${API_URL}/api/accounts/${accountId}`,
        { ...account, isDefault: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Default account updated');
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update default account');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const totalBalance = accounts
    .filter((a) => a.isActive && a.type !== 'loan')
    .reduce((sum, account) => {
      const balance = accountBalances.get(account.id);
      return sum + (balance?.calculatedBalance || account.balance);
    }, 0);

  const totalLoans = accounts
    .filter((a) => a.isActive && a.type === 'loan')
    .reduce((sum, account) => {
      const balance = accountBalances.get(account.id);
      return sum + Math.abs(balance?.calculatedBalance || account.balance);
    }, 0);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your financial accounts and track balances
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Tooltip title="Refresh Balances">
            <IconButton onClick={fetchAccounts} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Account
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
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Typography variant="h6" color="white" gutterBottom>
                Total Balance
              </Typography>
              <Typography variant="h3" color="white" fontWeight="bold">
                {formatCurrency(totalBalance)}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)" mt={1}>
                Across {accounts.filter((a) => a.isActive && a.type !== 'loan').length} active accounts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Typography variant="h6" color="white" gutterBottom>
                Total Loans
              </Typography>
              <Typography variant="h3" color="white" fontWeight="bold">
                {formatCurrency(totalLoans)}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)" mt={1}>
                {accounts.filter((a) => a.isActive && a.type === 'loan').length} loan accounts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <WalletIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No accounts yet
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Create your first account to start tracking your finances
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add Account
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {accounts.map((account) => {
            const balance = accountBalances.get(account.id);
            const config = accountTypeConfig[account.type];
            const IconComponent = config.icon;
            const isNegative = (balance?.calculatedBalance || account.balance) < 0;

            return (
              <Grid item xs={12} md={6} lg={4} key={account.id}>
                <Card
                  sx={{
                    height: '100%',
                    opacity: account.isActive ? 1 : 0.6,
                    borderLeft: `4px solid ${account.color || config.color}`,
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 2,
                            bgcolor: `${account.color || config.color}15`,
                            color: account.color || config.color,
                            display: 'flex',
                          }}
                        >
                          <IconComponent />
                        </Box>
                        <Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6">{account.name}</Typography>
                            {account.isDefault && (
                              <Tooltip title="Default Account">
                                <StarIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                              </Tooltip>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {config.label}
                            {account.bankName && ` • ${account.bankName}`}
                          </Typography>
                        </Box>
                      </Box>
                      <Box display="flex" gap={0.5}>
                        <IconButton
                          size="small"
                          onClick={() => handleSetDefault(account.id)}
                          disabled={account.isDefault}
                        >
                          {account.isDefault ? (
                            <StarIcon fontSize="small" />
                          ) : (
                            <StarBorderIcon fontSize="small" />
                          )}
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenDialog(account)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(account)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Current Balance
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        color={isNegative ? 'error.main' : 'success.main'}
                        gutterBottom
                      >
                        {formatCurrency(
                          balance?.calculatedBalance || account.balance,
                          account.currency
                        )}
                      </Typography>

                      {balance && (
                        <Box mt={2}>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Credits
                              </Typography>
                              <Typography variant="body2" color="success.main" fontWeight="medium">
                                +{formatCurrency(balance.totalCredits, account.currency)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Debits
                              </Typography>
                              <Typography variant="body2" color="error.main" fontWeight="medium">
                                -{formatCurrency(balance.totalDebits, account.currency)}
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" color="text.secondary">
                                {balance.transactionCount} transactions
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {account.accountNumber && (
                        <Box mt={2}>
                          <Chip
                            label={`****${account.accountNumber.slice(-4)}`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      )}

                      {!account.isActive && (
                        <Chip
                          label="Inactive"
                          size="small"
                          color="default"
                          sx={{ mt: 2 }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Account Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />

            <TextField
              select
              label="Account Type"
              value={formData.type}
              onChange={(e) => {
                const type = e.target.value as Account['type'];
                setFormData({
                  ...formData,
                  type,
                  color: accountTypeConfig[type].color,
                });
              }}
              fullWidth
              required
            >
              {Object.entries(accountTypeConfig).map(([value, config]) => (
                <MenuItem key={value} value={value}>
                  {config.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Bank Name"
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              fullWidth
            />

            <TextField
              label="Account Number (Last 4 digits)"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              fullWidth
              inputProps={{ maxLength: 4 }}
            />

            <TextField
              select
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              fullWidth
            >
              <MenuItem value="USD">USD - US Dollar</MenuItem>
              <MenuItem value="EUR">EUR - Euro</MenuItem>
              <MenuItem value="GBP">GBP - British Pound</MenuItem>
              <MenuItem value="INR">INR - Indian Rupee</MenuItem>
              <MenuItem value="JPY">JPY - Japanese Yen</MenuItem>
            </TextField>

            {!editingAccount && (
              <TextField
                label="Initial Balance"
                type="number"
                value={formData.initialBalance}
                onChange={(e) =>
                  setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })
                }
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">{formData.currency}</InputAdornment>
                  ),
                }}
              />
            )}

            <TextField
              label="Color"
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              fullWidth
            />

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <Box display="flex" gap={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                }
                label="Set as Default"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.name}>
            {editingAccount ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{accountToDelete?.name}"?
            {accountToDelete && accountBalances.get(accountToDelete.id)?.transactionCount ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This account has{' '}
                {accountBalances.get(accountToDelete.id)?.transactionCount} transactions and
                cannot be deleted.
              </Alert>
            ) : (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                This action cannot be undone.
              </Typography>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={
              !!(
                accountToDelete &&
                accountBalances.get(accountToDelete.id)?.transactionCount
              )
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Accounts;
