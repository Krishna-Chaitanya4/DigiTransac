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
  Menu,
  ListItemIcon,
  ListItemText,
  Collapse,
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
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  MoreVert as MoreVertIcon,
  Receipt as ReceiptIcon,
  SwapHoriz as TransferIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency as formatCurrencyUtil, CURRENCIES } from '../utils/currency';

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
  lastTransactionDate?: string;
  thisMonthCredits: number;
  thisMonthDebits: number;
  thisMonthNet: number;
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
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountBalances, setAccountBalances] = useState<Map<string, AccountBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [adjustBalanceOpen, setAdjustBalanceOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [actualBalance, setActualBalance] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  
  // Transfer dialog states
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferFromAccount, setTransferFromAccount] = useState<Account | null>(null);
  const [transferFromPreFilled, setTransferFromPreFilled] = useState(false); // Track if FROM was pre-filled
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Search, Filter, Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active'); // active, inactive, all
  const [sortBy, setSortBy] = useState<string>('name'); // name, balance, type, lastActivity
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showInactive, setShowInactive] = useState(false);
  const [groupByType, setGroupByType] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [quickActionAnchor, setQuickActionAnchor] = useState<null | HTMLElement>(null);
  const [quickActionAccount, setQuickActionAccount] = useState<Account | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking' as Account['type'],
    bankName: '',
    accountNumber: '',
    currency: user?.currency || 'USD',
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

      const response = await axios.get(`/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const accountsData = response.data.accounts || [];
      setAccounts(accountsData);

      // Fetch balances and transaction data for all accounts
      const balancePromises = accountsData.map(async (account: Account) => {
        const balanceRes = await axios.get(`/api/accounts/${account.id}/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Fetch last transaction and this month stats
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month 00:00:00
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999); // End of today 23:59:59.999
        
        // Fetch last transaction (any status for true last activity)
        const txnRes = await axios.get(`/api/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            accountId: account.id,
            sortBy: 'date',
            sortOrder: 'desc',
            limit: '1',
          },
        });

        // Fetch total approved transaction count (industry standard: show approved only)
        const countRes = await axios.get(`/api/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            accountId: account.id,
            reviewStatus: 'approved',
            limit: '1', // Just to get pagination.total
          },
        });

        // Fetch this month stats
        const monthTxnRes = await axios.get(`/api/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            accountId: account.id,
            startDate: startOfMonth.toISOString(),
            endDate: endOfToday.toISOString(),
            reviewStatus: 'approved',
          },
        });

        const lastTransaction = txnRes.data.transactions?.[0];
        const monthTransactions = monthTxnRes.data.transactions || [];
        const totalApprovedCount = countRes.data.pagination?.total || 0;

        const thisMonthCredits = monthTransactions
          .filter((t: any) => t.type === 'credit')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const thisMonthDebits = monthTransactions
          .filter((t: any) => t.type === 'debit')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        return {
          ...balanceRes.data,
          accountId: account.id, // Ensure accountId is set
          transactionCount: totalApprovedCount, // Override with accurate count
          lastTransactionDate: lastTransaction?.date,
          thisMonthCredits,
          thisMonthDebits,
          thisMonthNet: thisMonthCredits - thisMonthDebits,
        };
      });

      const balanceResults = await Promise.all(balancePromises);
      const balanceMap = new Map<string, AccountBalance>();
      balanceResults.forEach((balance) => {
        balanceMap.set(balance.accountId, balance);
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
        currency: user?.currency || 'USD',
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
        await axios.put(`/api/accounts/${editingAccount.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccess('Account updated successfully');
      } else {
        await axios.post(`/api/accounts`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
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

      await axios.delete(`/api/accounts/${accountToDelete.id}`, {
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
        `/api/accounts/${accountId}`,
        { ...account, isDefault: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Default account updated');
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update default account');
    }
  };

  const formatCurrency = (amount: number, currency: string = user?.currency || 'USD') => {
    return formatCurrencyUtil(amount, currency);
  };

  // Convert amount to user's base currency for totals
  const convertToBaseCurrency = (amount: number, fromCurrency: string): number => {
    const baseCurrency = user?.currency || 'USD';
    if (fromCurrency === baseCurrency) return amount;

    // Simple exchange rates (in production, fetch from API)
    const exchangeRates: Record<string, number> = {
      USD: 1,
      EUR: 1.1,
      GBP: 1.27,
      INR: 0.012,
      JPY: 0.0067,
      CNY: 0.14,
      AUD: 0.66,
      CAD: 0.74,
    };

    const toUSD = amount * (exchangeRates[fromCurrency] || 1);
    return toUSD / (exchangeRates[baseCurrency] || 1);
  };

  // Filter accounts based on search and filters
  const getFilteredAccounts = () => {
    let filtered = [...accounts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.name.toLowerCase().includes(query) ||
          acc.bankName?.toLowerCase().includes(query) ||
          acc.accountNumber?.includes(query) ||
          accountTypeConfig[acc.type].label.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((acc) => acc.type === filterType);
    }

    // Currency filter
    if (filterCurrency !== 'all') {
      filtered = filtered.filter((acc) => acc.currency === filterCurrency);
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((acc) => acc.isActive);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter((acc) => !acc.isActive);
    }

    // Show inactive toggle
    if (!showInactive) {
      filtered = filtered.filter((acc) => acc.isActive);
    }

    return filtered;
  };

  // Sort accounts
  const getSortedAccounts = (accountsToSort: Account[]) => {
    const sorted = [...accountsToSort];

    sorted.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'balance':
          const balanceA = accountBalances.get(a.id)?.calculatedBalance || a.balance;
          const balanceB = accountBalances.get(b.id)?.calculatedBalance || b.balance;
          compareValue = balanceA - balanceB;
          break;
        case 'type':
          compareValue = a.type.localeCompare(b.type);
          break;
        case 'lastActivity':
          const dateA = accountBalances.get(a.id)?.lastTransactionDate || a.createdAt;
          const dateB = accountBalances.get(b.id)?.lastTransactionDate || b.createdAt;
          compareValue = new Date(dateA).getTime() - new Date(dateB).getTime();
          break;
        default:
          compareValue = 0;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  };

  // Group accounts by type
  const getGroupedAccounts = (accountsToGroup: Account[]) => {
    if (!groupByType) return { all: accountsToGroup };

    const groups: Record<string, Account[]> = {};
    accountsToGroup.forEach((acc) => {
      if (!groups[acc.type]) {
        groups[acc.type] = [];
      }
      groups[acc.type].push(acc);
    });

    return groups;
  };

  // Get unique currencies from accounts
  const getUniqueCurrencies = () => {
    return Array.from(new Set(accounts.map((acc) => acc.currency)));
  };

  // Export accounts to CSV
  const handleExportAccounts = () => {
    const headers = [
      'Account Name',
      'Type',
      'Bank Name',
      'Account Number',
      'Currency',
      'Balance',
      'This Month Credits',
      'This Month Debits',
      'This Month Net',
      'Total Transactions',
      'Last Transaction',
      'Status',
    ];

    const rows = accounts.map((acc) => {
      const balance = accountBalances.get(acc.id);
      return [
        acc.name,
        accountTypeConfig[acc.type].label,
        acc.bankName || '',
        acc.accountNumber || '',
        acc.currency,
        (balance?.calculatedBalance || acc.balance).toString(),
        (balance?.thisMonthCredits || 0).toString(),
        (balance?.thisMonthDebits || 0).toString(),
        (balance?.thisMonthNet || 0).toString(),
        (balance?.transactionCount || 0).toString(),
        balance?.lastTransactionDate
          ? new Date(balance.lastTransactionDate).toLocaleDateString()
          : 'Never',
        acc.isActive ? 'Active' : 'Inactive',
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Quick actions
  const handleQuickActionOpen = (event: React.MouseEvent<HTMLElement>, account: Account) => {
    setQuickActionAnchor(event.currentTarget);
    setQuickActionAccount(account);
  };

  const handleQuickActionClose = () => {
    setQuickActionAnchor(null);
    setQuickActionAccount(null);
  };

  const handleViewTransactions = () => {
    navigate('/transactions');
    handleQuickActionClose();
  };

  const handleAddTransaction = (account: Account) => {
    navigate('/transactions', { state: { addTransaction: true, accountId: account.id } });
    handleQuickActionClose();
  };

  const handleTransferMoney = (account: Account | null) => {
    setTransferFromAccount(account);
    setTransferFromPreFilled(account !== null); // Mark as pre-filled if account provided
    setTransferToAccountId('');
    setTransferAmount('');
    setTransferNotes('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferDialogOpen(true);
    handleQuickActionClose();
  };

  const handleTransferSubmit = async () => {
    const fromAccountId = transferFromAccount?.id;
    
    if (!fromAccountId || !transferToAccountId || !transferAmount) {
      setError('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (amount <= 0) {
      setError('Amount must be positive');
      return;
    }

    try {
      await axios.post(
        '/api/transactions/transfer',
        {
          fromAccountId,
          toAccountId: transferToAccountId,
          amount,
          date: transferDate,
          notes: transferNotes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Transfer completed successfully');
      setTransferDialogOpen(false);
      setTransferFromAccount(null);
      setTransferFromPreFilled(false);
      setTransferToAccountId('');
      setTransferAmount('');
      setTransferNotes('');
      fetchAccounts(); // Refresh account balances
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create transfer');
    }
  };

  // Render account card
  const renderAccountCard = (account: Account) => {
    const balance = accountBalances.get(account.id);
    const config = accountTypeConfig[account.type];
    const IconComponent = config.icon;
    const isNegative = (balance?.calculatedBalance || account.balance) < 0;
    const lastActivity = balance?.lastTransactionDate
      ? new Date(balance.lastTransactionDate).toLocaleDateString()
      : 'No activity';

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
                <Tooltip title="Quick Actions">
                  <IconButton
                    size="small"
                    onClick={(e) => handleQuickActionOpen(e, account)}
                    color="primary"
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
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

              {/* This Month Activity */}
              {balance && balance.transactionCount > 0 && (
                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    THIS MONTH
                  </Typography>
                  <Grid container spacing={1} mt={0.5}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">
                        In
                      </Typography>
                      <Typography variant="body2" color="success.main" fontWeight="medium">
                        +{formatCurrency(balance.thisMonthCredits, account.currency)}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">
                        Out
                      </Typography>
                      <Typography variant="body2" color="error.main" fontWeight="medium">
                        -{formatCurrency(balance.thisMonthDebits, account.currency)}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">
                        Net
                      </Typography>
                      <Typography
                        variant="body2"
                        color={balance.thisMonthNet >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="medium"
                      >
                        {balance.thisMonthNet >= 0 ? '+' : ''}
                        {formatCurrency(balance.thisMonthNet, account.currency)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Account Details */}
              <Box mt={2} display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    Total Transactions
                  </Typography>
                  <Typography variant="caption" fontWeight="medium">
                    {balance?.transactionCount || 0}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    Last Activity
                  </Typography>
                  <Typography variant="caption" fontWeight="medium">
                    {lastActivity}
                  </Typography>
                </Box>
              </Box>

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
                <Chip label="Inactive" size="small" color="default" sx={{ mt: 2 }} />
              )}

              {/* Action Buttons */}
              <Box display="flex" gap={1} mt={2}>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ flex: 1 }}
                  startIcon={<ReceiptIcon fontSize="small" />}
                  onClick={() => handleViewTransactions()}
                >
                  View
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ flex: 1 }}
                  startIcon={<AddIcon fontSize="small" />}
                  onClick={() => handleAddTransaction(account)}
                >
                  Add
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ flex: 1 }}
                  startIcon={<TransferIcon fontSize="small" />}
                  onClick={() => handleTransferMoney(account)}
                >
                  Transfer
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const handleAdjustBalance = (account: Account) => {
    setAdjustingAccount(account);
    const balance = accountBalances.get(account.id);
    setActualBalance((balance?.calculatedBalance || account.balance).toString());
    setAdjustmentNotes('');
    setAdjustBalanceOpen(true);
  };

  const handleSaveAdjustment = async () => {
    if (!adjustingAccount) return;

    try {
      const balance = accountBalances.get(adjustingAccount.id);
      const currentBalance = balance?.calculatedBalance || adjustingAccount.balance;
      const newBalance = parseFloat(actualBalance);
      const difference = newBalance - currentBalance;

      if (difference === 0) {
        setError('No adjustment needed - balances match');
        return;
      }

      // Get categories to find or create a balance adjustment category
      const categoriesRes = await axios.get(`/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let adjustmentCategory = categoriesRes.data.categories?.find(
        (cat: any) => cat.name === 'Balance Adjustment'
      );

      // If category doesn't exist, create it
      if (!adjustmentCategory) {
        const newCategoryRes = await axios.post(
          `/api/categories`,
          {
            name: 'Balance Adjustment',
            type: 'both',
            color: '#9e9e9e',
            icon: 'adjustment',
            description: 'Automatic adjustments to reconcile account balances',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        adjustmentCategory = newCategoryRes.data.category;
      }

      // Create a balance adjustment transaction
      await axios.post(
        `/api/transactions`,
        {
          type: difference > 0 ? 'credit' : 'debit',
          amount: Math.abs(difference),
          accountId: adjustingAccount.id,
          description: 'Balance Adjustment',
          date: new Date().toISOString(),
          isRecurring: false,
          reviewStatus: 'approved',
          splits: [
            {
              categoryId: adjustmentCategory.id,
              amount: Math.abs(difference),
              tags: ['balance-adjustment'],
              notes:
                adjustmentNotes ||
                `Adjusted to match actual balance: ${formatCurrency(newBalance, adjustingAccount.currency)}`,
              order: 1,
            },
          ],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(
        `Balance adjusted successfully by ${formatCurrency(Math.abs(difference), adjustingAccount.currency)}`
      );
      setAdjustBalanceOpen(false);
      setAdjustingAccount(null);
      setActualBalance('');
      setAdjustmentNotes('');
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to adjust balance');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const filteredAccounts = getFilteredAccounts();
  const sortedAccounts = getSortedAccounts(filteredAccounts);
  const groupedAccounts = getGroupedAccounts(sortedAccounts);

  // Calculate totals in base currency
  const totalAssets = accounts
    .filter((a) => a.isActive && a.type !== 'loan')
    .reduce((sum, account) => {
      const balance = accountBalances.get(account.id)?.calculatedBalance || account.balance;
      return sum + (balance > 0 ? convertToBaseCurrency(balance, account.currency) : 0);
    }, 0);

  const totalLiabilities = accounts
    .filter((a) => a.isActive && a.type === 'loan')
    .reduce((sum, account) => {
      const balance = accountBalances.get(account.id)?.calculatedBalance || account.balance;
      return sum + convertToBaseCurrency(Math.abs(balance), account.currency);
    }, 0);

  const creditCardDebt = accounts
    .filter((a) => a.isActive && a.type === 'credit_card')
    .reduce((sum, account) => {
      const balance = accountBalances.get(account.id)?.calculatedBalance || account.balance;
      return sum + (balance < 0 ? convertToBaseCurrency(Math.abs(balance), account.currency) : 0);
    }, 0);

  const totalLiabilitiesWithCreditCards = totalLiabilities + creditCardDebt;
  const netWorth = totalAssets - totalLiabilitiesWithCreditCards;
  const activeAccountCount = accounts.filter((a) => a.isActive).length;

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
          <Tooltip title="Export Accounts">
            <IconButton onClick={handleExportAccounts} color="primary">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh Balances">
            <IconButton onClick={fetchAccounts} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<TransferIcon />} onClick={() => handleTransferMoney(null)}>
            Transfer
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
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

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ flexGrow: 1, minWidth: 200 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />

            <TextField
              select
              size="small"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              sx={{ minWidth: 150 }}
              label="Sort By"
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="balance">Balance</MenuItem>
              <MenuItem value="type">Type</MenuItem>
              <MenuItem value="lastActivity">Last Activity</MenuItem>
            </TextField>

            <Tooltip title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
              <IconButton
                size="small"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <SortIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={showInactive ? 'Hide Inactive' : 'Show Inactive'}>
              <IconButton size="small" onClick={() => setShowInactive(!showInactive)}>
                {showInactive ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title={showFilters ? 'Hide Filters' : 'Show Filters'}>
              <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
                <FilterIcon />
              </IconButton>
            </Tooltip>

            <FormControlLabel
              control={<Switch checked={groupByType} onChange={(e) => setGroupByType(e.target.checked)} />}
              label="Group by Type"
            />
          </Box>

          {/* Advanced Filters */}
          <Collapse in={showFilters}>
            <Box display="flex" gap={2} mt={2} flexWrap="wrap">
              <TextField
                select
                size="small"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Account Type"
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">All Types</MenuItem>
                {Object.entries(accountTypeConfig).map(([value, config]) => (
                  <MenuItem key={value} value={value}>
                    {config.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                label="Currency"
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">All Currencies</MenuItem>
                {getUniqueCurrencies().map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {CURRENCIES[currency]?.symbol || ''} {currency}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active Only</MenuItem>
                <MenuItem value="inactive">Inactive Only</MenuItem>
              </TextField>

              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setFilterCurrency('all');
                  setFilterStatus('active');
                  setSortBy('name');
                  setSortOrder('asc');
                }}
              >
                Clear Filters
              </Button>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Typography variant="h6" color="white" gutterBottom>
                Net Worth
              </Typography>
              <Typography variant="h3" color="white" fontWeight="bold">
                {formatCurrency(netWorth)}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)" mt={1}>
                Assets - Liabilities
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
            <CardContent>
              <Typography variant="h6" color="white" gutterBottom>
                Total Assets
              </Typography>
              <Typography variant="h3" color="white" fontWeight="bold">
                {formatCurrency(totalAssets)}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)" mt={1}>
                {activeAccountCount} active accounts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Typography variant="h6" color="white" gutterBottom>
                Total Liabilities
              </Typography>
              <Typography variant="h3" color="white" fontWeight="bold">
                {formatCurrency(totalLiabilitiesWithCreditCards)}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)" mt={1}>
                Loans + Credit Cards
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Accounts List */}
      {sortedAccounts.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <WalletIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {accounts.length === 0 ? 'No accounts yet' : 'No accounts match your filters'}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                {accounts.length === 0
                  ? 'Create your first account to start tracking your finances'
                  : 'Try adjusting your search or filter criteria'}
              </Typography>
              {accounts.length === 0 && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add Account
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      ) : groupByType ? (
        // Grouped view
        Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
          const config = accountTypeConfig[type as Account['type']];
          const IconComponent = config.icon;

          return (
            <Box key={type} mb={4}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <IconComponent sx={{ color: config.color }} />
                <Typography variant="h6">
                  {config.label} ({typeAccounts.length})
                </Typography>
              </Box>
              <Grid container spacing={3}>
                {typeAccounts.map((account) => renderAccountCard(account))}
              </Grid>
            </Box>
          );
        })
      ) : (
        // Regular list view
        <Grid container spacing={3}>
          {sortedAccounts.map((account) => renderAccountCard(account))}
        </Grid>
      )}

      {/* Quick Action Menu */}
      <Menu
        anchorEl={quickActionAnchor}
        open={Boolean(quickActionAnchor)}
        onClose={handleQuickActionClose}
      >
        <MenuItem
          onClick={() => {
            if (quickActionAccount) {
              handleOpenDialog(quickActionAccount);
              handleQuickActionClose();
            }
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Account</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (quickActionAccount && !quickActionAccount.isDefault) {
              handleSetDefault(quickActionAccount.id);
              handleQuickActionClose();
            }
          }}
          disabled={quickActionAccount?.isDefault}
        >
          <ListItemIcon>
            <StarIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Set as Default</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (quickActionAccount) {
              handleAdjustBalance(quickActionAccount);
              handleQuickActionClose();
            }
          }}
        >
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Adjust Balance</ListItemText>
        </MenuItem>
      </Menu>

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
                This account has {accountBalances.get(accountToDelete.id)?.transactionCount}{' '}
                transactions and cannot be deleted.
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
              !!(accountToDelete && accountBalances.get(accountToDelete.id)?.transactionCount)
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Balance Adjustment Dialog */}
      <Dialog
        open={adjustBalanceOpen}
        onClose={() => setAdjustBalanceOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Adjust Account Balance</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {adjustingAccount && (
              <>
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Account:</strong> {adjustingAccount.name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Current Calculated Balance:</strong>{' '}
                    {formatCurrency(
                      accountBalances.get(adjustingAccount.id)?.calculatedBalance ||
                        adjustingAccount.balance,
                      adjustingAccount.currency
                    )}
                  </Typography>
                </Alert>

                <TextField
                  fullWidth
                  label="Actual Balance (from bank/wallet)"
                  type="number"
                  value={actualBalance}
                  onChange={(e) => setActualBalance(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: adjustingAccount.currency,
                        })
                          .format(0)
                          .replace(/[\d.,]/g, '')}
                      </InputAdornment>
                    ),
                  }}
                  helperText="Enter the actual balance from your bank statement or wallet"
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Notes (Optional)"
                  multiline
                  rows={3}
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  placeholder="Reason for adjustment (e.g., bank fees, interest, cash transaction)"
                  sx={{ mb: 2 }}
                />

                {actualBalance && (
                  <Alert
                    severity={
                      parseFloat(actualBalance) -
                        (accountBalances.get(adjustingAccount.id)?.calculatedBalance ||
                          adjustingAccount.balance) >=
                      0
                        ? 'success'
                        : 'warning'
                    }
                  >
                    <Typography variant="body2">
                      <strong>Adjustment Amount:</strong>{' '}
                      {formatCurrency(
                        Math.abs(
                          parseFloat(actualBalance) -
                            (accountBalances.get(adjustingAccount.id)?.calculatedBalance ||
                              adjustingAccount.balance)
                        ),
                        adjustingAccount.currency
                      )}{' '}
                      (
                      {parseFloat(actualBalance) -
                        (accountBalances.get(adjustingAccount.id)?.calculatedBalance ||
                          adjustingAccount.balance) >=
                      0
                        ? 'Credit'
                        : 'Debit'}
                      )
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      A balance adjustment transaction will be created
                    </Typography>
                  </Alert>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustBalanceOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveAdjustment}
            variant="contained"
            disabled={
              !actualBalance ||
              parseFloat(actualBalance) ===
                (accountBalances.get(adjustingAccount?.id || '')?.calculatedBalance ||
                  adjustingAccount?.balance ||
                  0)
            }
          >
            Adjust Balance
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Money Dialog */}
      <Dialog 
        open={transferDialogOpen} 
        onClose={() => {
          setTransferDialogOpen(false);
          setTransferFromAccount(null);
          setTransferFromPreFilled(false);
          setTransferToAccountId('');
          setTransferAmount('');
          setTransferNotes('');
          setError('');
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Transfer Money</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* From Account - Selectable if not pre-filled */}
            {transferFromPreFilled ? (
              <TextField
                label="From Account"
                value={transferFromAccount?.name || ''}
                fullWidth
                disabled
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {transferFromAccount && React.createElement(
                        accountTypeConfig[transferFromAccount.type].icon,
                        { fontSize: 'small' }
                      )}
                    </InputAdornment>
                  ),
                }}
              />
            ) : (
              <TextField
                select
                label="From Account"
                value={transferFromAccount?.id || ''}
                onChange={(e) => {
                  const account = accounts.find((acc) => acc.id === e.target.value);
                  setTransferFromAccount(account || null);
                }}
                fullWidth
                required
              >
                {accounts
                  .filter((acc) => acc.isActive)
                  .map((account) => {
                    const IconComponent = accountTypeConfig[account.type].icon;
                    return (
                      <MenuItem key={account.id} value={account.id}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <IconComponent fontSize="small" />
                          <span>{account.name}</span>
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            {formatCurrency(
                              accountBalances.get(account.id)?.calculatedBalance || account.balance,
                              account.currency
                            )}
                          </Typography>
                        </Box>
                      </MenuItem>
                    );
                  })}
              </TextField>
            )}

            {/* To Account */}
            <TextField
              select
              label="To Account"
              value={transferToAccountId}
              onChange={(e) => setTransferToAccountId(e.target.value)}
              fullWidth
              required
            >
              {accounts
                .filter((acc) => acc.id !== transferFromAccount?.id && acc.isActive)
                .map((account) => {
                  const IconComponent = accountTypeConfig[account.type].icon;
                  return (
                    <MenuItem key={account.id} value={account.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <IconComponent fontSize="small" />
                        <span>{account.name}</span>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          {formatCurrency(
                            accountBalances.get(account.id)?.calculatedBalance || account.balance,
                            account.currency
                          )}
                        </Typography>
                      </Box>
                    </MenuItem>
                  );
                })}
            </TextField>

            {/* Amount */}
            <TextField
              label="Amount"
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              fullWidth
              required
              InputProps={{
                startAdornment: <InputAdornment position="start">{CURRENCIES[transferFromAccount?.currency || 'USD']?.symbol || '$'}</InputAdornment>,
              }}
              inputProps={{ min: 0, step: 0.01 }}
            />

            {/* Date */}
            <TextField
              label="Date"
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            {/* Notes (Optional) */}
            <TextField
              label="Notes (Optional)"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setTransferDialogOpen(false);
            setTransferFromAccount(null);
            setTransferFromPreFilled(false);
            setTransferToAccountId('');
            setTransferAmount('');
            setTransferNotes('');
            setError('');
          }}>Cancel</Button>
          <Button 
            onClick={handleTransferSubmit} 
            variant="contained" 
            disabled={!transferFromAccount || !transferToAccountId || !transferAmount}
          >
            Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Accounts;
