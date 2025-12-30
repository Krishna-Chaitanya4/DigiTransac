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
  Collapse,
  Fade,
  Zoom,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalance as BankIcon,
  Savings as SavingsIcon,
  CreditCard as CreditCardIcon,
  TrendingUp as InvestmentIcon,
  TrendingUp,
  TrendingDown,
  Money as CashIcon,
  AccountBalanceWallet as WalletIcon,
  Star as StarIcon,
  Balance as BalanceIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Receipt as ReceiptIcon,
  SwapHoriz as TransferIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  useAccounts, 
  useCreateAccount, 
  useUpdateAccount, 
  useDeleteBankAccount,
  useTransferFunds,
  useCreateTransaction,
  useCreateCategory,
  useCategories,
  type Account
} from '../hooks/useApi';
import { api } from '../services/api';
import { formatCurrency as formatCurrencyUtil, CURRENCIES } from '../utils/currency';
import { ModernDatePicker } from '../components/ModernDatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // React Query hooks
  const { data: accountsData, isLoading, refetch } = useAccounts();
  const { data: categoriesData } = useCategories();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteBankAccount();
  const transferFunds = useTransferFunds();
  const createTransaction = useCreateTransaction();
  const createCategory = useCreateCategory();
  
  const accounts = accountsData?.data?.accounts || [];
  const categories = categoriesData?.data?.categories || [];
  const [accountBalances, setAccountBalances] = useState<Map<string, AccountBalance>>(new Map());
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

  // Fetch account balances when accounts are loaded
  useEffect(() => {
    const fetchAccountBalances = async () => {
      if (!accounts || accounts.length === 0) return;

      try {
        setError('');

        // Fetch balances and transaction data for all accounts
        const balancePromises = accounts.map(async (account: Account) => {
          const balanceRes = await api.get(`/api/accounts/${account.id}/balance`);

          // Fetch last transaction and this month stats
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
          );

          // Fetch last transaction (any status for true last activity)
          const txnRes = await api.get(`/api/transactions`, {
            params: {
              accountId: account.id,
              sortBy: 'date',
              sortOrder: 'desc',
              limit: '1',
            },
          });

          // Fetch total approved transaction count
          const countRes = await api.get(`/api/transactions`, {
            params: {
              accountId: account.id,
              reviewStatus: 'approved',
              limit: '1',
            },
          });

          // Fetch this month stats
          const monthTxnRes = await api.get(`/api/transactions`, {
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
            accountId: account.id,
            transactionCount: totalApprovedCount,
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
        setError(err.response?.data?.message || 'Failed to fetch account balances');
      }
    };

    fetchAccountBalances();
  }, [accounts]);

  const fetchAccounts = () => {
    // React Query handles this now - just call refetch
    refetch();
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
        initialBalance: account.initialBalance || 0,
        color: account.color || accountTypeConfig[account.type as keyof typeof accountTypeConfig].color,
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
        await updateAccount.mutateAsync({ id: editingAccount.id, data: payload });
        setSuccess('Account updated successfully');
      } else {
        await createAccount.mutateAsync(payload);
        setSuccess('Account created successfully');
      }

      handleCloseDialog();
      refetch();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save account');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;

    try {
      setError('');
      setSuccess('');

      await deleteAccount.mutateAsync(accountToDelete.id);

      setSuccess('Account deleted successfully');
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
      refetch();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setDeleteConfirmOpen(false);
    }
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      const account = accounts.find((a: Account) => a.id === accountId);
      if (!account) return;

      await updateAccount.mutateAsync({
        id: accountId,
        data: { ...account, isDefault: true }
      });

      setSuccess('Default account updated');
      refetch();
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
        (acc: Account) =>
          acc.name.toLowerCase().includes(query) ||
          acc.bankName?.toLowerCase().includes(query) ||
          acc.accountNumber?.includes(query) ||
          accountTypeConfig[acc.type as keyof typeof accountTypeConfig].label.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((acc: Account) => acc.type === filterType);
    }

    // Currency filter
    if (filterCurrency !== 'all') {
      filtered = filtered.filter((acc: Account) => acc.currency === filterCurrency);
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
        case 'balance': {
          const balanceA = accountBalances.get(a.id)?.calculatedBalance || a.balance;
          const balanceB = accountBalances.get(b.id)?.calculatedBalance || b.balance;
          compareValue = balanceA - balanceB;
          break;
        }
        case 'type':
          compareValue = a.type.localeCompare(b.type);
          break;
        case 'lastActivity': {
          const dateA = accountBalances.get(a.id)?.lastTransactionDate || a.createdAt;
          const dateB = accountBalances.get(b.id)?.lastTransactionDate || b.createdAt;
          compareValue = new Date(dateA).getTime() - new Date(dateB).getTime();
          break;
        }
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
  const getUniqueCurrencies = (): string[] => {
    return Array.from(new Set(accounts.map((acc: Account) => acc.currency)));
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

    const rows = accounts.map((acc: Account) => {
      const balance = accountBalances.get(acc.id);
      return [
        acc.name,
        accountTypeConfig[acc.type as keyof typeof accountTypeConfig].label,
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

    const csv = [headers, ...rows]
      .map((row) => row.map((cell: any) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Quick actions

  const handleViewTransactions = () => {
    navigate('/transactions');
  };

  const handleAddTransaction = (account: Account) => {
    navigate('/transactions', { state: { addTransaction: true, accountId: account.id } });
  };

  const handleTransferMoney = (account: Account | null) => {
    setTransferFromAccount(account);
    setTransferFromPreFilled(account !== null); // Mark as pre-filled if account provided
    setTransferToAccountId('');
    setTransferAmount('');
    setTransferNotes('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferDialogOpen(true);
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
      await transferFunds.mutateAsync({
        fromAccountId,
        toAccountId: transferToAccountId,
        amount,
        date: transferDate,
        description: transferNotes,
      });

      setSuccess('Transfer completed successfully');
      setTransferDialogOpen(false);
      setTransferFromAccount(null);
      setTransferFromPreFilled(false);
      setTransferToAccountId('');
      setTransferAmount('');
      setTransferNotes('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create transfer');
    }
  };

  // Render account card
  const renderAccountCard = (account: Account) => {
    const balance = accountBalances.get(account.id);
    const config = accountTypeConfig[account.type as keyof typeof accountTypeConfig];
    const IconComponent = config.icon;
    const isNegative = (balance?.calculatedBalance || account.balance) < 0;
    const lastActivity = balance?.lastTransactionDate
      ? new Date(balance.lastTransactionDate).toLocaleDateString()
      : 'No activity';

    return (
      <Grid size={{ lg: 4, xs: 12, md: 6 }} key={account.id}>
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
                  <Typography variant="h6">{account.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {config.label}
                    {account.bankName && ` • ${account.bankName}`}
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" gap={0.5}>
                <Tooltip title={account.isDefault ? 'Default Account' : 'Set as Default'}>
                  <IconButton
                    size="small"
                    onClick={() => handleSetDefault(account.id)}
                    color={account.isDefault ? 'warning' : 'default'}
                  >
                    {account.isDefault ? <StarIcon /> : <StarIcon sx={{ opacity: 0.3 }} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Adjust Balance">
                  <IconButton
                    size="small"
                    onClick={() => handleAdjustBalance(account)}
                    color="primary"
                  >
                    <BalanceIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit Account">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(account)}
                    color="primary"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Account">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setAccountToDelete(account);
                      setDeleteConfirmOpen(true);
                    }}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
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
                {formatCurrency(balance?.calculatedBalance || account.balance, account.currency)}
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
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">
                        In
                      </Typography>
                      <Typography variant="body2" color="success.main" fontWeight="medium">
                        +{formatCurrency(balance.thisMonthCredits, account.currency)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" color="text.secondary">
                        Out
                      </Typography>
                      <Typography variant="body2" color="error.main" fontWeight="medium">
                        -{formatCurrency(balance.thisMonthDebits, account.currency)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
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

      // Find or create a balance adjustment category
      let adjustmentCategory = categories?.find(
        (cat: any) => cat.name === 'Balance Adjustment'
      );

      // If category doesn't exist, create it
      if (!adjustmentCategory) {
        const newCategoryRes = await createCategory.mutateAsync({
          name: 'Balance Adjustment',
          color: '#9e9e9e',
          icon: 'adjustment',
        });
        adjustmentCategory = newCategoryRes.data.category;
      }

      // Create a balance adjustment transaction
      await createTransaction.mutateAsync({
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
      });

      setSuccess(
        `Balance adjusted successfully by ${formatCurrency(Math.abs(difference), adjustingAccount.currency)}`
      );
      setAdjustBalanceOpen(false);
      setAdjustingAccount(null);
      setActualBalance('');
      setAdjustmentNotes('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to adjust balance');
    }
  };

  if (isLoading) {
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
    .filter((a: Account) => a.isActive && a.type !== 'loan')
    .reduce((sum: number, account: Account) => {
      const balance = accountBalances.get(account.id)?.calculatedBalance || account.balance;
      return sum + (balance > 0 ? convertToBaseCurrency(balance, account.currency) : 0);
    }, 0);

  const totalLiabilities = accounts
    .filter((a: Account) => a.isActive && a.type === 'loan')
    .reduce((sum: number, account: Account) => {
      const balance = accountBalances.get(account.id)?.calculatedBalance || account.balance;
      return sum + convertToBaseCurrency(Math.abs(balance), account.currency);
    }, 0);

  const creditCardDebt = accounts
    .filter((a: Account) => a.isActive && a.type === 'credit_card')
    .reduce((sum: number, account: Account) => {
      const balance = accountBalances.get(account.id)?.calculatedBalance || account.balance;
      return sum + (balance < 0 ? convertToBaseCurrency(Math.abs(balance), account.currency) : 0);
    }, 0);

  const totalLiabilitiesWithCreditCards = totalLiabilities + creditCardDebt;
  const netWorth = totalAssets - totalLiabilitiesWithCreditCards;
  const activeAccountCount = accounts.filter((a: Account) => a.isActive).length;

  return (
    <Box>
      {/* Enhanced Animated Header */}
      <Fade in timeout={600}>
        <Box
          sx={{
            mb: 4,
            p: 4,
            borderRadius: 4,
            position: 'relative',
            overflow: 'hidden',
            background: (theme) =>
              theme.palette.mode === 'light'
                ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 50%, ${theme.palette.primary.dark} 100%)`
                : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.dark} 50%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: (theme) => `0 8px 32px ${theme.palette.primary.main}40`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)',
              animation: 'pulse 4s ease-in-out infinite',
            },
            '@keyframes pulse': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="flex-start"
              flexWrap="wrap"
              gap={2}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Avatar
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(10px)',
                      width: 56,
                      height: 56,
                    }}
                  >
                    <BankIcon sx={{ fontSize: 32 }} />
                  </Avatar>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{
                      color: 'white',
                      letterSpacing: '-0.02em',
                      textShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    }}
                  >
                    My Accounts
                  </Typography>
                </Box>
                <Typography
                  variant="h6"
                  sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, ml: 9 }}
                >
                  {activeAccountCount} account{activeAccountCount !== 1 ? 's' : ''} • Total:{' '}
                  {formatCurrency(netWorth, user?.currency || 'USD')}
                </Typography>
              </Box>
              <Box display="flex" gap={2}>
                <Zoom in timeout={700}>
                  <Tooltip title="Export Accounts">
                    <IconButton
                      onClick={handleExportAccounts}
                      sx={{
                        bgcolor: 'white',
                        color: 'primary.main',
                        width: 48,
                        height: 48,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                          bgcolor: 'rgba(255,255,255,0.95)',
                        },
                      }}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Zoom>
                <Zoom in timeout={800}>
                  <Tooltip title="Refresh Balances">
                    <IconButton
                      onClick={fetchAccounts}
                      sx={{
                        bgcolor: 'white',
                        color: 'primary.main',
                        width: 48,
                        height: 48,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                        '&:hover': {
                          transform: 'rotate(180deg)',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                          bgcolor: 'rgba(255,255,255,0.95)',
                        },
                        transition: 'all 0.4s ease',
                      }}
                    >
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Zoom>
                <Zoom in timeout={900}>
                  <Button
                    variant="outlined"
                    startIcon={<TransferIcon />}
                    onClick={() => handleTransferMoney(null)}
                    sx={{
                      bgcolor: 'white',
                      borderColor: 'white',
                      color: 'primary.main',
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: 'white',
                        bgcolor: 'rgba(255,255,255,0.95)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      },
                    }}
                  >
                    Transfer
                  </Button>
                </Zoom>
                <Zoom in timeout={1000}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.95)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                      },
                    }}
                  >
                    Add Account
                  </Button>
                </Zoom>
              </Box>
            </Box>
          </Box>
        </Box>
      </Fade>

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
      <Fade in timeout={800}>
        <Card
          sx={{
            mb: 3,
            borderRadius: 3,
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                : 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            border: (theme) =>
              theme.palette.mode === 'light'
                ? `1px solid ${theme.palette.primary.main}1A`
                : `1px solid ${theme.palette.primary.main}33`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          }}
        >
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
                control={
                  <Switch
                    checked={groupByType}
                    onChange={(e) => setGroupByType(e.target.checked)}
                  />
                }
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
                  {getUniqueCurrencies().map((currency: string) => (
                    <MenuItem key={currency} value={currency}>
                      {(CURRENCIES as any)[currency]?.symbol || ''} {currency}
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
      </Fade>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ md: 4, xs: 12 }}>
          <Zoom in timeout={900}>
            <Card
              sx={{
                borderRadius: 3,
                background: (theme) => theme.palette.gradient.primary,
                color: 'white',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: (theme) => `0 4px 20px ${theme.palette.primary.main}40`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: (theme) => `0 12px 32px ${theme.palette.primary.main}50`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '80px',
                  height: '80px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                },
              }}
            >
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem',
                    }}
                  >
                    Net Worth
                  </Typography>
                  <BalanceIcon sx={{ opacity: 0.7 }} />
                </Box>
                <Typography
                  variant="h4"
                  fontWeight={800}
                  sx={{ letterSpacing: '-0.02em', mb: 0.5 }}
                >
                  {formatCurrency(netWorth)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 1 }}>
                  Assets - Liabilities
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
        <Grid size={{ md: 4, xs: 12 }}>
          <Zoom in timeout={1000}>
            <Card
              sx={{
                borderRadius: 3,
                background: (theme) => theme.palette.gradient.success,
                color: 'white',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 12px 32px rgba(16, 185, 129, 0.35)',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '80px',
                  height: '80px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                },
              }}
            >
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem',
                    }}
                  >
                    Total Assets
                  </Typography>
                  <TrendingUp sx={{ opacity: 0.7 }} />
                </Box>
                <Typography
                  variant="h4"
                  fontWeight={800}
                  sx={{ letterSpacing: '-0.02em', mb: 0.5 }}
                >
                  {formatCurrency(totalAssets)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 1 }}>
                  {activeAccountCount} active accounts
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
        <Grid size={{ md: 4, xs: 12 }}>
          <Zoom in timeout={1100}>
            <Card
              sx={{
                borderRadius: 3,
                background: (theme) => theme.palette.gradient.error,
                color: 'white',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 12px 32px rgba(239, 68, 68, 0.35)',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '80px',
                  height: '80px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                },
              }}
            >
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontSize: '0.7rem',
                    }}
                  >
                    Total Liabilities
                  </Typography>
                  <TrendingDown sx={{ opacity: 0.7 }} />
                </Box>
                <Typography
                  variant="h4"
                  fontWeight={800}
                  sx={{ letterSpacing: '-0.02em', mb: 0.5 }}
                >
                  {formatCurrency(totalLiabilitiesWithCreditCards)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 1 }}>
                  Loans + Credit Cards
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
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
          const config = accountTypeConfig[type as keyof typeof accountTypeConfig];
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

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            background: (theme) => theme.palette.gradient.primary,
            color: 'white',
            py: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              borderRadius: '50%',
            },
          }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}
          >
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
              <BankIcon />
            </Avatar>
            <Typography variant="h5" fontWeight={700}>
              {editingAccount ? 'Edit Account' : 'Add Account'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Account Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
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
                  color: accountTypeConfig[type as keyof typeof accountTypeConfig].color,
                });
              }}
              fullWidth
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />

            <TextField
              label="Account Number (Last 4 digits)"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              fullWidth
              inputProps={{ maxLength: 4 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />

            <TextField
              select
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            >
              <MenuItem value="USD">USD - US Dollar</MenuItem>
              <MenuItem value="EUR">EUR - Euro</MenuItem>
              <MenuItem value="GBP">GBP - British Pound</MenuItem>
              <MenuItem value="INR">INR - Indian Rupee</MenuItem>
              <MenuItem value="JPY">JPY - Japanese Yen</MenuItem>
            </TextField>

            <Box>
              <Typography variant="body2" fontWeight={600} color="primary" gutterBottom>
                Account Color (Optional)
              </Typography>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: (theme) =>
                    theme.palette.mode === 'light'
                      ? 'rgba(248, 250, 252, 0.8)'
                      : 'rgba(30, 30, 30, 0.5)',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {/* Preset Colors */}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                  display="block"
                  mb={1}
                >
                  Quick Select
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {[
                    '#1976d2',
                    '#388e3c',
                    '#f57c00',
                    '#7b1fa2',
                    '#689f38',
                    '#d32f2f',
                    '#ef4444',
                    '#f97316',
                    '#eab308',
                    '#22c55e',
                    '#14b8a6',
                    '#06b6d4',
                    '#3b82f6',
                    '#6366f1',
                    '#8b5cf6',
                    '#ec4899',
                    '#64748b',
                    '#475569',
                  ].map((presetColor) => (
                    <Box
                      key={presetColor}
                      onClick={() => setFormData({ ...formData, color: presetColor })}
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        bgcolor: presetColor,
                        cursor: 'pointer',
                        border: '3px solid',
                        borderColor:
                          formData.color === presetColor ? 'primary.main' : 'transparent',
                        transition: 'all 0.2s ease',
                        boxShadow:
                          formData.color === presetColor
                            ? '0 0 0 2px rgba(20, 184, 166, 0.2)'
                            : 'none',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                        },
                      }}
                    />
                  ))}
                </Box>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                  display="block"
                  mb={1}
                >
                  Custom Color
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box
                    sx={{
                      position: 'relative',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '3px solid',
                      borderColor: 'background.paper',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                      },
                    }}
                  >
                    <input
                      type="color"
                      value={formData.color || accountTypeConfig[formData.type as keyof typeof accountTypeConfig].color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    />
                  </Box>
                  <TextField
                    size="small"
                    value={formData.color || accountTypeConfig[formData.type as keyof typeof accountTypeConfig].color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#1976d2"
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: formData.color || accountTypeConfig[formData.type as keyof typeof accountTypeConfig].color,
                            mr: 1,
                            border: '2px solid',
                            borderColor: 'divider',
                          }}
                        />
                      ),
                    }}
                  />
                </Box>
              </Box>
            </Box>

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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            )}

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />

            <Box
              sx={{
                display: 'flex',
                gap: 3,
                p: 2,
                borderRadius: 2,
                background: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)'
                    : 'linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: (theme) => theme.palette.primary.main,
                        '&:hover': {
                          backgroundColor: (theme) => `${theme.palette.primary.main}15`,
                        },
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        background: (theme) => theme.palette.gradient.primary,
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Set as Default
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Primary account for transactions
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: (theme) => theme.palette.primary.main,
                        '&:hover': {
                          backgroundColor: (theme) => `${theme.palette.primary.main}15`,
                        },
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        background: (theme) => theme.palette.gradient.primary,
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Active
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Include in transactions
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            gap: 1.5,
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            background: (theme) =>
              theme.palette.mode === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(15, 15, 15, 0.8)',
          }}
        >
          <Button
            onClick={handleCloseDialog}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.name}
            sx={{
              borderRadius: 2,
              px: 4,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) => theme.palette.gradient.primary,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 4,
              },
              transition: 'all 0.2s ease',
            }}
          >
            {editingAccount ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            color: 'white',
            py: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
            },
          }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}
          >
            <Avatar
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 40,
                height: 40,
              }}
            >
              <DeleteIcon />
            </Avatar>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
              Delete Account
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography>
            Are you sure you want to delete &quot;{accountToDelete?.name}&quot;?
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
        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            gap: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: (theme) =>
              theme.palette.mode === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(15, 15, 15, 0.8)',
          }}
        >
          <Button
            onClick={() => setDeleteConfirmOpen(false)}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            disabled={
              !!(accountToDelete && accountBalances.get(accountToDelete.id)?.transactionCount)
            }
            sx={{
              borderRadius: 2,
              px: 4,
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 4,
                transition: 'all 0.2s ease',
              },
            }}
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
        <DialogTitle
          sx={{
            background: (theme) => theme.palette.gradient.primary,
            color: 'white',
            py: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            },
          }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}
          >
            <Avatar
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 48,
                height: 48,
              }}
            >
              <BalanceIcon />
            </Avatar>
            <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
              Adjust Account Balance
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
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
        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            gap: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: (theme) =>
              theme.palette.mode === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(15, 15, 15, 0.8)',
          }}
        >
          <Button
            onClick={() => setAdjustBalanceOpen(false)}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
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
            sx={{
              borderRadius: 2,
              px: 4,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) => theme.palette.gradient.primary,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 4,
                transition: 'all 0.2s ease',
              },
            }}
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
        <DialogTitle
          sx={{
            background: (theme) => theme.palette.gradient.primary,
            color: 'white',
            py: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            },
          }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}
          >
            <Avatar
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 48,
                height: 48,
              }}
            >
              <TransferIcon />
            </Avatar>
            <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
              Transfer Money
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
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
                      {transferFromAccount &&
                        React.createElement(accountTypeConfig[transferFromAccount.type as keyof typeof accountTypeConfig].icon, {
                          fontSize: 'small',
                        })}
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
                  const account = accounts.find((acc: Account) => acc.id === e.target.value);
                  setTransferFromAccount(account || null);
                }}
                fullWidth
                required
              >
                {accounts
                  .filter((acc: Account) => acc.isActive)
                  .map((account: Account) => {
                    const IconComponent = accountTypeConfig[account.type as keyof typeof accountTypeConfig].icon;
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
                .filter((acc: Account) => acc.id !== transferFromAccount?.id && acc.isActive)
                .map((account: Account) => {
                  const IconComponent = accountTypeConfig[account.type as keyof typeof accountTypeConfig].icon;
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
                startAdornment: (
                  <InputAdornment position="start">
                    {CURRENCIES[transferFromAccount?.currency || 'USD']?.symbol || '$'}
                  </InputAdornment>
                ),
              }}
              inputProps={{ min: 0, step: 0.01 }}
            />

            {/* Date */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <ModernDatePicker
                label="Date"
                value={transferDate ? dayjs(transferDate) : null}
                onChange={(newValue) => {
                  if (newValue) {
                    setTransferDate(newValue.format('YYYY-MM-DD'));
                  }
                }}
                fullWidth
              />
            </LocalizationProvider>

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
        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            gap: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: (theme) =>
              theme.palette.mode === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(15, 15, 15, 0.8)',
          }}
        >
          <Button
            onClick={() => {
              setTransferDialogOpen(false);
              setTransferFromAccount(null);
              setTransferFromPreFilled(false);
              setTransferToAccountId('');
              setTransferAmount('');
              setTransferNotes('');
              setError('');
            }}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransferSubmit}
            variant="contained"
            disabled={!transferFromAccount || !transferToAccountId || !transferAmount}
            sx={{
              borderRadius: 2,
              px: 4,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) => theme.palette.gradient.primary,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 4,
                transition: 'all 0.2s ease',
              },
            }}
          >
            Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Accounts;
