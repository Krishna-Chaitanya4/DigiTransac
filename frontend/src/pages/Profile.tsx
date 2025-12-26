import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Grid,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Google as GoogleIcon,
  LinkOff as LinkOffIcon,
  DeleteForever as DeleteForeverIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [emailIntegration, setEmailIntegration] = useState({
    enabled: false,
    provider: null as 'gmail' | 'outlook' | null,
    email: '',
    totalEmailsProcessed: 0,
    lastProcessedAt: null as Date | null,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    fetchUserProfile();

    // Check for OAuth callback status in URL
    const params = new URLSearchParams(window.location.search);
    const gmailStatus = params.get('gmail');

    if (gmailStatus === 'connected') {
      setSuccess('Gmail connected successfully!');
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      fetchUserProfile();
    } else if (gmailStatus === 'error') {
      setError('Failed to connect Gmail. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.emailIntegration) {
        setEmailIntegration(response.data.emailIntegration);
      }
    } catch (err: any) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get(`/api/gmail/connect`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Open OAuth URL in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        response.data.authUrl,
        'Gmail Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(pollTimer);
          setLoading(false);
          fetchUserProfile();
        }
      }, 500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to connect Gmail');
      setLoading(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      setLoading(true);
      setError('');

      await axios.post(
        `/api/gmail/disconnect`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Gmail disconnected successfully');
      fetchUserProfile();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disconnect Gmail');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmailIntegration = async (enabled: boolean) => {
    try {
      setLoading(true);
      setError('');

      await axios.put(
        `/api/users/profile`,
        {
          emailIntegration: {
            ...emailIntegration,
            enabled,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEmailIntegration({
        ...emailIntegration,
        enabled,
      });

      setSuccess(enabled ? 'Email integration enabled!' : 'Email integration disabled');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update email integration');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await axios.delete(`/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Logout and redirect
      logout();
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Account Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Manage your preferences and security
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Account Information */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 24px rgba(20, 184, 166, 0.15)',
              },
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Account Information
              </Typography>
              <Divider sx={{ my: 2 }} />

              <TextField
                label="Username"
                fullWidth
                value={user?.username || ''}
                disabled
                margin="normal"
              />
              <TextField
                label="Full Name"
                fullWidth
                value={user?.fullName || ''}
                disabled
                margin="normal"
              />
              <TextField
                label="Email"
                fullWidth
                value={user?.email || 'Not provided'}
                disabled
                margin="normal"
              />
              <TextField
                label="Phone"
                fullWidth
                value={user?.phone || 'Not provided'}
                disabled
                margin="normal"
              />
              <TextField
                label="Date of Birth"
                fullWidth
                value={user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not provided'}
                disabled
                margin="normal"
              />
              <TextField
                label="Currency"
                fullWidth
                value={user?.currency || 'USD'}
                disabled
                margin="normal"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Email Integration */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              borderLeft: emailIntegration.enabled ? 4 : 0,
              borderColor: '#14b8a6',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: emailIntegration.enabled 
                  ? '0 8px 24px rgba(20, 184, 166, 0.25)'
                  : '0 8px 24px rgba(20, 184, 166, 0.15)',
              },
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <EmailIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Email Integration
                </Typography>
                {emailIntegration.enabled && <Chip label="Active" color="success" size="small" />}
              </Box>
              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary" mb={2}>
                Connect your Gmail account to automatically import bank transaction SMS
              </Typography>

              {!emailIntegration.provider ? (
                <>
                  <Button
                    variant="contained"
                    startIcon={<GoogleIcon />}
                    onClick={handleConnectGmail}
                    disabled={loading}
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    Connect Gmail Account
                  </Button>
                  <Alert severity="info">
                    <Typography variant="caption">
                      We'll read bank SMS from your inbox to automatically create expenses. You can
                      review and approve them before they're added to your expenses.
                    </Typography>
                  </Alert>
                </>
              ) : (
                <>
                  <Box
                    sx={{
                      p: 2,
                      background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
                      borderRadius: 2,
                      border: 1,
                      borderColor: '#14b8a6',
                      mb: 2,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <CheckCircleIcon sx={{ color: '#14b8a6' }} />
                      <Typography variant="body2" fontWeight={600}>
                        Connected to Gmail
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {emailIntegration.email}
                    </Typography>
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={emailIntegration.enabled}
                        onChange={(e) => handleToggleEmailIntegration(e.target.checked)}
                        disabled={loading}
                      />
                    }
                    label="Enable Automatic Email Polling"
                    sx={{ mb: 2 }}
                  />

                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<LinkOffIcon />}
                    onClick={handleDisconnectGmail}
                    disabled={loading}
                    fullWidth
                  >
                    Disconnect Gmail
                  </Button>

                  {emailIntegration.totalEmailsProcessed > 0 && (
                    <Box mt={3}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box textAlign="center">
                            <Typography 
                              variant="h4" 
                              fontWeight={700}
                              sx={{
                                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                              }}
                            >
                              {emailIntegration.totalEmailsProcessed}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Emails Processed
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box textAlign="center">
                            <Typography variant="body2" color="text.secondary">
                              Last Sync:
                            </Typography>
                            <Typography variant="caption" fontWeight={600}>
                              {emailIntegration.lastProcessedAt
                                ? new Date(emailIntegration.lastProcessedAt).toLocaleString()
                                : 'Never'}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  <Alert severity="success" sx={{ mt: 3 }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      How it works:
                    </Typography>
                    <Typography variant="caption" component="div">
                      • We check your Gmail every 5 minutes for bank SMS
                      <br />
                      • Supported banks: HDFC, ICICI, SBI, Axis, Kotak, and more
                      <br />
                      • Parsed expenses appear in Review Queue for approval
                      <br />• You can approve, edit, or reject each transaction
                    </Typography>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Supported Banks */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Supported Banks
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary" mb={2}>
                We currently support SMS parsing from the following banks:
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={1}>
                {[
                  'HDFC Bank',
                  'ICICI Bank',
                  'SBI',
                  'Axis Bank',
                  'Kotak Bank',
                  'Punjab National Bank',
                  'Bank of Baroda',
                  'Canara Bank',
                  'Union Bank',
                  'IDBI Bank',
                ].map((bank) => (
                  <Chip key={bank} label={bank} variant="outlined" />
                ))}
              </Box>

              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  Don't see your bank? You can add custom parsing patterns in Settings (coming soon)
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Danger Zone - Delete Account */}
        <Grid item xs={12}>
          <Card
            sx={{
              borderLeft: 4,
              borderColor: 'error.main',
              backgroundColor: 'rgba(211, 47, 47, 0.05)',
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <WarningIcon color="error" />
                <Typography variant="h6" fontWeight={600} color="error">
                  Danger Zone
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary" mb={2}>
                Once you delete your account, there is no going back. This action will permanently delete:
              </Typography>

              <Box component="ul" sx={{ pl: 2, mb: 3 }}>
                <Typography component="li" variant="body2" color="text.secondary">
                  All your transactions and financial data
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Your budgets, categories, and tags
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Email integration settings and processed emails
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Your account information and preferences
                </Typography>
              </Box>

              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteForeverIcon />}
                onClick={() => setDeleteDialogOpen(true)}
                sx={{
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    backgroundColor: 'rgba(211, 47, 47, 0.1)',
                  },
                }}
              >
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteConfirmation('');
          setError('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="error" />
            <Typography variant="h6" fontWeight={600}>
              Delete Account
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            This action <strong>cannot be undone</strong>. This will permanently delete your account
            and remove all your data from our servers.
          </DialogContentText>

          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              You are about to delete:
            </Typography>
            <Typography variant="caption" component="div">
              • Username: <strong>{user?.username}</strong>
              <br />
              • Full Name: <strong>{user?.fullName}</strong>
              <br />
              • Email: <strong>{user?.email || 'Not provided'}</strong>
              <br />
              • Phone: <strong>{user?.phone || 'Not provided'}</strong>
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary" mb={1}>
            Please type <strong>DELETE</strong> to confirm:
          </Typography>
          <TextField
            fullWidth
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Type DELETE to confirm"
            error={error !== '' && deleteConfirmation !== 'DELETE'}
            helperText={error}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteConfirmation('');
              setError('');
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAccount}
            color="error"
            variant="contained"
            disabled={loading || deleteConfirmation !== 'DELETE'}
            startIcon={<DeleteForeverIcon />}
          >
            {loading ? 'Deleting...' : 'Delete My Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile;
