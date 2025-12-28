import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Chip,
  Stack,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
} from '@mui/material';
import { Close as CloseIcon, Sms as SmsIcon } from '@mui/icons-material';
import axios from 'axios';
import { getApiUrl } from '../services/config.service';

interface ParsedTransaction {
  amount: number;
  type: string;
  merchant: string;
  date: string;
  accountNumber?: string;
  bankName?: string;
  confidence: 'high' | 'medium' | 'low';
  originalText: string;
}

interface SMSImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const SMSImportModal: React.FC<SMSImportModalProps> = ({ open, onClose, onImportComplete }) => {
  const [smsText, setSmsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');
  const [importResult, setImportResult] = useState<{
    summary: { created: number; duplicates: number; failed: number };
  } | null>(null);

  const handlePreview = async () => {
    if (!smsText.trim()) {
      setError('Please paste at least one SMS message');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth-token');
      const apiUrl = await getApiUrl();

      // Split by newlines and filter empty lines
      const smsTexts = smsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const response = await axios.post(
        `${apiUrl}/api/sms/preview`,
        { smsTexts },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.transactions.length === 0) {
        setError('No valid transactions found. Please check the SMS format.');
      } else {
        setPreview(response.data.transactions);
        setStep('preview');
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to parse SMS messages');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth-token');
      const apiUrl = await getApiUrl();

      const smsTexts = smsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const response = await axios.post(
        `${apiUrl}/api/sms/parse`,
        { smsTexts },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setImportResult(response.data);
      setStep('result');
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to import transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSmsText('');
    setPreview([]);
    setError(null);
    setStep('input');
    setImportResult(null);
    onClose();
  };

  const handleComplete = () => {
    handleClose();
    onImportComplete();
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      default:
        return 'error';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <SmsIcon color="primary" />
            <Typography variant="h6">Import from SMS</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {step === 'input' && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Copy and paste bank SMS messages below. Each SMS should be on a new line. Supports
              HDFC, ICICI, SBI, Axis, Kotak, and more.
            </Alert>

            <TextField
              fullWidth
              multiline
              rows={12}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              placeholder={`Example:\nRs.500.00 debited from A/c XX1234 on 23-Dec-25 at Swiggy. Avl bal Rs.5000\n\nYour A/c XX5678 is debited with Rs 250 on 23-12-25. Info: UPI-Zomato\n\nPaste multiple SMS messages here...`}
              disabled={loading}
              sx={{ mt: 2 }}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Box mt={2}>
              <Typography variant="caption" color="text.secondary">
                Tip: You can paste up to 50 SMS messages at once. Duplicates will be automatically
                filtered.
              </Typography>
            </Box>
          </>
        )}

        {step === 'preview' && (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              Found {preview.length} transaction{preview.length !== 1 ? 's' : ''}. Review before
              importing.
            </Alert>

            <List>
              {preview.map((transaction, index) => (
                <React.Fragment key={index}>
                  <ListItem
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1" fontWeight={600}>
                            {transaction.merchant}
                          </Typography>
                          <Chip
                            label={transaction.confidence}
                            size="small"
                            color={getConfidenceColor(transaction.confidence)}
                          />
                        </Box>
                      }
                      secondary={
                        <Stack spacing={0.5} mt={1}>
                          <Box display="flex" gap={2}>
                            <Typography variant="body2" color="text.secondary">
                              Amount:{' '}
                              <span
                                style={{
                                  color: transaction.type === 'debit' ? '#d32f2f' : '#2e7d32',
                                  fontWeight: 600,
                                }}
                              >
                                {transaction.type === 'debit' ? '-' : '+'}₹
                                {transaction.amount.toFixed(2)}
                              </span>
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Date: {new Date(transaction.date).toLocaleDateString()}
                            </Typography>
                          </Box>
                          {transaction.bankName && (
                            <Typography variant="body2" color="text.secondary">
                              Bank: {transaction.bankName} • A/c: {transaction.accountNumber}
                            </Typography>
                          )}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontStyle: 'italic',
                              display: 'block',
                              mt: 0.5,
                              p: 1,
                              bgcolor: 'action.hover',
                              borderRadius: 1,
                            }}
                          >
                            {transaction.originalText.substring(0, 100)}
                            {transaction.originalText.length > 100 ? '...' : ''}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}

        {step === 'result' && importResult && (
          <>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body1" fontWeight={600}>
                Import Complete!
              </Typography>
            </Alert>

            <Stack spacing={2}>
              <Box
                display="flex"
                justifyContent="space-around"
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                }}
              >
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {importResult.summary.created}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">
                    {importResult.summary.duplicates}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Duplicates
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box textAlign="center">
                  <Typography variant="h4" color="error.main">
                    {importResult.summary.failed}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Failed
                  </Typography>
                </Box>
              </Box>

              {importResult.summary.duplicates > 0 && (
                <Alert severity="warning">
                  {importResult.summary.duplicates} duplicate transaction
                  {importResult.summary.duplicates !== 1 ? 's' : ''} were skipped (already exist in
                  last 7 days).
                </Alert>
              )}

              {importResult.summary.failed > 0 && (
                <Alert severity="info">
                  {importResult.summary.failed} SMS message
                  {importResult.summary.failed !== 1 ? 's' : ''} could not be parsed. They may not
                  match any supported bank format.
                </Alert>
              )}

              <Alert severity="info">
                All transactions have been added to <strong>Pending Transactions</strong> for
                review. You can edit and approve them before they appear in your main transaction
                list.
              </Alert>
            </Stack>
          </>
        )}
      </DialogContent>

      <DialogActions>
        {step === 'input' && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handlePreview}
              disabled={loading || !smsText.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : undefined}
            >
              {loading ? 'Parsing...' : 'Preview'}
            </Button>
          </>
        )}

        {step === 'preview' && (
          <>
            <Button onClick={() => setStep('input')}>Back</Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={loading || preview.length === 0}
              startIcon={loading ? <CircularProgress size={20} /> : undefined}
            >
              {loading
                ? 'Importing...'
                : `Import ${preview.length} Transaction${preview.length !== 1 ? 's' : ''}`}
            </Button>
          </>
        )}

        {step === 'result' && (
          <Button variant="contained" onClick={handleComplete}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SMSImportModal;
