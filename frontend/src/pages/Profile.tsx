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
} from '@mui/material';
import {
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Google as GoogleIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Profile: React.FC = () => {
  const { user, token } = useAuth();
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

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Profile Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Manage your account and integration settings
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
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Account Information
              </Typography>
              <Divider sx={{ my: 2 }} />

              <TextField
                label="First Name"
                fullWidth
                value={user?.firstName || ''}
                disabled
                margin="normal"
              />
              <TextField
                label="Last Name"
                fullWidth
                value={user?.lastName || ''}
                disabled
                margin="normal"
              />
              <TextField
                label="Email"
                fullWidth
                value={user?.email || ''}
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
              borderColor: 'success.main',
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <EmailIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Email Integration
                </Typography>
                {emailIntegration.enabled && (
                  <Chip label="Active" color="success" size="small" />
                )}
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
                      We'll read bank SMS from your inbox to automatically create expenses.
                      You can review and approve them before they're added to your expenses.
                    </Typography>
                  </Alert>
                </>
              ) : (
                <>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'success.light',
                      borderRadius: 2,
                      border: 1,
                      borderColor: 'success.main',
                      mb: 2,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <CheckCircleIcon color="success" />
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
                            <Typography variant="h4" fontWeight={700} color="primary">
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
                      <br />
                      • You can approve, edit, or reject each transaction
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
      </Grid>
    </Box>
  );
};

export default Profile;

