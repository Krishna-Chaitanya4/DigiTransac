import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { formatCurrency } from '../utils/currency';
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  CircularProgress,
  Alert,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Collapse,
  Stack,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  accountId: string;
  description: string;
  date: string;
  notes?: string;
  source?: 'manual' | 'email' | 'sms' | 'api';
  merchantName?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  confidence?: number;
  originalContent?: string;
  categoryId?: string;
  tags?: string[];
  splits?: TransactionSplit[];
}

interface TransactionSplit {
  id: string;
  categoryId: string;
  amount: number;
  tags: string[];
  notes?: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface Category {
  id: string;
  name: string;
  path: string[];
}

const PendingTransactions: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'email' | 'sms'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'confidence'>('date');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [filter, sortBy]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [transactionsRes, accountsRes, categoriesRes] = await Promise.all([
        axios.get('/api/transactions', {
          params: {
            reviewStatus: 'pending',
            sortBy: sortBy,
            sortOrder: 'desc',
            limit: 100,
            includeSplits: 'true',
          },
        }),
        axios.get('/api/accounts'),
        axios.get('/api/categories'),
      ]);

      // Backend returns { success: true, transactions: [...], pagination: {...} }
      let filteredTransactions = transactionsRes.data.transactions || [];
      if (filter !== 'all') {
        filteredTransactions = filteredTransactions.filter((t: Transaction) => t.source === filter);
      }

      setTransactions(filteredTransactions);
      setAccounts(accountsRes.data);
      setCategories(categoriesRes.data);
    } catch (error: any) {
      console.error('Error fetching pending transactions:', error);
      setError(
        error.response?.data?.error || error.message || 'Failed to load pending transactions'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await axios.patch(`/api/transactions/${id}/approve`);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    } catch (error) {
      console.error('Error approving transaction:', error);
      alert('Failed to approve transaction');
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      await axios.patch(`/api/transactions/${id}/reject`, { reason });
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      alert('Failed to reject transaction');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;

    try {
      await axios.post('/api/transactions/bulk-approve', {
        transactionIds: Array.from(selectedIds),
      });
      setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk approving:', error);
      alert('Failed to approve transactions');
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;

    const reason = prompt('Reason for rejection (optional):');

    try {
      await axios.post('/api/transactions/bulk-reject', {
        transactionIds: Array.from(selectedIds),
        reason,
      });
      setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk rejecting:', error);
      alert('Failed to reject transactions');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getAccountName = (accountId: string) => {
    return accounts.find((a) => a.id === accountId)?.name || 'Unknown Account';
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.path.join(' > ') : 'Unknown';
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;

    let color: 'success' | 'warning' | 'error' = 'default' as any;
    let label = 'Unknown';

    if (confidence >= 80) {
      color = 'success';
      label = 'High';
    } else if (confidence >= 50) {
      color = 'warning';
      label = 'Medium';
    } else {
      color = 'error';
      label = 'Low';
    }

    return <Chip label={`${label} (${confidence}%)`} color={color} size="small" />;
  };

  const getSourceBadge = (source?: string) => {
    if (!source || source === 'manual') return null;

    const colors: Record<string, 'info' | 'secondary'> = {
      email: 'info',
      sms: 'secondary',
    };

    return (
      <Chip
        label={source.toUpperCase()}
        color={colors[source] || ('default' as any)}
        size="small"
      />
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Box textAlign="center">
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={fetchData}>
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom fontWeight={700}>
          Review Queue
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review and approve transactions imported from external sources
        </Typography>
      </Box>

      {/* Filters and Actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1}>
            <Button
              variant={filter === 'all' ? 'contained' : 'outlined'}
              onClick={() => setFilter('all')}
              size="small"
            >
              All
            </Button>
            <Button
              variant={filter === 'email' ? 'contained' : 'outlined'}
              onClick={() => setFilter('email')}
              size="small"
            >
              Email
            </Button>
            <Button
              variant={filter === 'sms' ? 'contained' : 'outlined'}
              onClick={() => setFilter('sms')}
              size="small"
            >
              SMS
            </Button>
          </Stack>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <MenuItem value="date">Date</MenuItem>
              <MenuItem value="amount">Amount</MenuItem>
              <MenuItem value="confidence">Confidence</MenuItem>
            </Select>
          </FormControl>

          {selectedIds.size > 0 && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                color="success"
                onClick={handleBulkApprove}
                startIcon={<ApproveIcon />}
                size="small"
              >
                Approve ({selectedIds.size})
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleBulkReject}
                startIcon={<RejectIcon />}
                size="small"
              >
                Reject ({selectedIds.size})
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            ✅
          </Typography>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            All Caught Up!
          </Typography>
          <Typography color="text.secondary">
            No pending transactions to review. New transactions from email or SMS will appear here.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {transactions.map((transaction) => (
            <Card key={transaction.id} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Checkbox
                    checked={selectedIds.has(transaction.id)}
                    onChange={() => toggleSelection(transaction.id)}
                  />

                  <Box flex={1}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      mb={1}
                    >
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {transaction.merchantName || transaction.description}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {getAccountName(transaction.accountId)} •{' '}
                          {new Date(transaction.date).toLocaleDateString()}
                        </Typography>
                      </Box>

                      <Typography
                        variant="h5"
                        fontWeight={700}
                        color={transaction.type === 'credit' ? 'success.main' : 'error.main'}
                      >
                        {transaction.type === 'credit' ? '+' : '-'}
                        {formatCurrency(transaction.amount, user?.currency || 'USD')}
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
                      {getSourceBadge(transaction.source)}
                      {getConfidenceBadge(transaction.confidence)}
                      <Chip label={getCategoryName(transaction.categoryId)} size="small" />
                      {transaction.tags &&
                        transaction.tags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                    </Stack>

                    {transaction.notes && (
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        <strong>Notes:</strong> {transaction.notes}
                      </Typography>
                    )}

                    {transaction.originalContent && (
                      <Box mb={2}>
                        <Button
                          size="small"
                          onClick={() =>
                            setExpandedId(expandedId === transaction.id ? null : transaction.id)
                          }
                          endIcon={
                            expandedId === transaction.id ? <ExpandLessIcon /> : <ExpandMoreIcon />
                          }
                        >
                          Original Content
                        </Button>
                        <Collapse in={expandedId === transaction.id}>
                          <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
                            <Typography
                              variant="body2"
                              component="pre"
                              sx={{ whiteSpace: 'pre-wrap' }}
                            >
                              {transaction.originalContent}
                            </Typography>
                          </Paper>
                        </Collapse>
                      </Box>
                    )}

                    {transaction.splits && transaction.splits.length > 0 && (
                      <Box mb={2}>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                          Split Details:
                        </Typography>
                        {transaction.splits.map((split) => (
                          <Typography
                            key={split.id}
                            variant="body2"
                            color="text.secondary"
                            sx={{ pl: 2 }}
                          >
                            • {getCategoryName(split.categoryId)}:{' '}
                            {formatCurrency(split.amount, user?.currency || 'USD')}
                            {split.tags.length > 0 && ` (${split.tags.join(', ')})`}
                          </Typography>
                        ))}
                      </Box>
                    )}

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<ApproveIcon />}
                        onClick={() => handleApprove(transaction.id)}
                        size="small"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<RejectIcon />}
                        onClick={() => handleReject(transaction.id)}
                        size="small"
                      >
                        Reject
                      </Button>
                      <Button variant="outlined" startIcon={<EditIcon />} size="small">
                        Edit & Approve
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default PendingTransactions;
