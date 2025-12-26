import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Avatar,
  IconButton,
  TextField,
  Stack,
  Paper,
  Skeleton,
  CircularProgress,
} from '@mui/material';
import {
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Google as GoogleIcon,
  LinkOff as LinkOffIcon,
  DeleteForever as DeleteForeverIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  CameraAlt as CameraAltIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Cake as CakeIcon,
  AttachMoney as AttachMoneyIcon,
  Sync as SyncIcon,
  AccessTime as AccessTimeIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const Profile: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    fullName: user?.fullName || '',
    dateOfBirth: user?.dateOfBirth || '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.emailIntegration) {
        setEmailIntegration({
          enabled: response.data.emailIntegration.enabled || false,
          provider: response.data.emailIntegration.provider || null,
          email: response.data.emailIntegration.email || '',
          totalEmailsProcessed: response.data.emailIntegration.totalEmailsProcessed || 0,
          lastProcessedAt: response.data.emailIntegration.lastProcessedAt || null,
        });
        
        // Set last sync time if available
        if (response.data.emailIntegration.lastProcessedAt) {
          setLastSyncTime(new Date(response.data.emailIntegration.lastProcessedAt));
        }
      }
      
      // TODO: Fetch pending transaction count from review queue API
      // For now, hardcoded as 0
      setPendingCount(0);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      console.log('Connecting to Gmail...');
      
      // Get OAuth URL from backend
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/gmail/connect`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Got auth URL:', response.data);
      const { authUrl } = response.data;
      
      // Open OAuth in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        '_blank',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      if (!popup) {
        setError('Popup blocked! Please allow popups for this site and try again.');
        return;
      }

      console.log('Popup opened, monitoring...');

      // Check for URL changes in popup (for callback detection)
      const checkPopup = setInterval(() => {
        try {
          // Check if popup was redirected back to our domain
          if (popup?.location?.href?.includes(window.location.origin)) {
            console.log('Popup returned to our domain, closing...');
            popup.close();
            clearInterval(checkPopup);
            fetchUserProfile();
            setSuccess('Gmail account connected successfully!');
          }
        } catch (e) {
          // Cross-origin error means still on Google OAuth page
        }
        
        // Check if popup was closed
        if (popup?.closed) {
          console.log('Popup closed, refreshing profile...');
          clearInterval(checkPopup);
          fetchUserProfile();
        }
      }, 500);
    } catch (err: any) {
      console.error('Gmail connect error:', err);
      setError(err.response?.data?.error || 'Failed to initiate Gmail connection');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      setLoading(true);
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/gmail/disconnect`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEmailIntegration({
        enabled: false,
        provider: null,
        email: '',
        totalEmailsProcessed: 0,
        lastProcessedAt: null,
      });
      setSuccess('Gmail account disconnected successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disconnect Gmail account');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmailIntegration = async (enabled: boolean) => {
    try {
      setLoading(true);
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/api/gmail/toggle`,
        { enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEmailIntegration((prev) => ({ ...prev, enabled }));
      setSuccess(`Email polling ${enabled ? 'enabled' : 'disabled'} successfully!`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to toggle email polling');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion');
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      logout();
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedData({
        fullName: user?.fullName || '',
        dateOfBirth: user?.dateOfBirth || '',
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    // TODO: Implement profile update API call
    setSuccess('Profile updated successfully!');
    setIsEditing(false);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // TODO: Upload to server
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      setSyncStatus('syncing');
      
      // Trigger manual sync
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/gmail/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSyncStatus('idle');
      setLastSyncTime(new Date());
      setSuccess('Email sync completed successfully!');
      
      // Refresh profile to get updated stats
      await fetchUserProfile();
    } catch (err: any) {
      setSyncStatus('error');
      setError(err.response?.data?.error || 'Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  };

  const getInitials = () => {
    if (!user?.fullName) return '?';
    return user.fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading && !user) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Skeleton variant="circular" width={120} height={120} sx={{ mx: 'auto', mb: 3 }} />
        <Skeleton variant="text" sx={{ fontSize: '2rem', mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* Success/Error Messages */}
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

      {/* Profile Header */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.primary.light}15 100%)`,
          borderRadius: 3,
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                fontSize: '3rem',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                border: `4px solid ${theme.palette.background.paper}`,
                boxShadow: theme.shadows[3],
              }}
              src={avatarPreview || undefined}
            >
              {getInitials()}
            </Avatar>
            <IconButton
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: theme.palette.background.paper,
                boxShadow: theme.shadows[2],
                '&:hover': {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                },
              }}
              component="label"
            >
              <input type="file" hidden accept="image/*" onChange={handleAvatarChange} />
              <CameraAltIcon />
            </IconButton>
          </Box>

          <Typography variant="h4" fontWeight={700} gutterBottom>
            {user?.fullName || 'User'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            @{user?.username}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {emailIntegration.enabled && (
              <Chip
                label="Email Connected"
                color="success"
                size="small"
                icon={<CheckCircleIcon />}
              />
            )}
            <Chip
              label={user?.currency || 'USD'}
              variant="outlined"
              size="small"
            />
          </Stack>
        </Box>

        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          {!isEditing ? (
            <IconButton
              onClick={handleEditToggle}
              sx={{
                backgroundColor: theme.palette.background.paper,
                '&:hover': {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                },
              }}
            >
              <EditIcon />
            </IconButton>
          ) : (
            <Stack direction="row" spacing={1}>
              <IconButton
                onClick={handleSaveProfile}
                sx={{
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                }}
              >
                <SaveIcon />
              </IconButton>
              <IconButton
                onClick={handleEditToggle}
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  '&:hover': {
                    backgroundColor: theme.palette.error.main,
                    color: theme.palette.error.contrastText,
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
          )}
        </Box>
      </Paper>

      {/* Personal Information */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Personal Information
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Stack spacing={3}>
          {/* Full Name */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PersonIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Full Name
              </Typography>
            </Box>
            {isEditing ? (
              <TextField
                fullWidth
                value={editedData.fullName}
                onChange={(e) => setEditedData({ ...editedData, fullName: e.target.value })}
                size="small"
              />
            ) : (
              <Typography variant="body1" fontWeight={600}>
                {user?.fullName || 'Not provided'}
              </Typography>
            )}
          </Box>

          {/* Email */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <EmailIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Email
              </Typography>
            </Box>
            <Typography variant="body1" fontWeight={600}>
              {user?.email || 'Not provided'}
            </Typography>
          </Box>

          {/* Phone */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PhoneIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Phone
              </Typography>
            </Box>
            <Typography variant="body1" fontWeight={600}>
              {user?.phone || 'Not provided'}
            </Typography>
          </Box>

          {/* Date of Birth */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CakeIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Date of Birth
              </Typography>
            </Box>
            {isEditing ? (
              <TextField
                fullWidth
                type="date"
                value={editedData.dateOfBirth ? new Date(editedData.dateOfBirth).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditedData({ ...editedData, dateOfBirth: e.target.value })}
                size="small"
              />
            ) : (
              <Typography variant="body1" fontWeight={600}>
                {user?.dateOfBirth
                  ? new Date(user.dateOfBirth).toLocaleDateString('en-GB')
                  : 'Not provided'}
              </Typography>
            )}
          </Box>

          {/* Currency */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AttachMoneyIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Currency
              </Typography>
            </Box>
            <Typography variant="body1" fontWeight={600}>
              {user?.currency || 'USD'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Email Integration */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          borderLeft: emailIntegration.enabled ? `4px solid ${theme.palette.primary.main}` : 'none',
          backgroundColor: emailIntegration.enabled 
            ? `${theme.palette.primary.main}08`
            : 'transparent',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <EmailIcon sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6" fontWeight={600}>
            Email Integration
          </Typography>
          {emailIntegration.enabled && (
            <Chip label="Active" color="success" size="small" />
          )}
        </Box>
        <Divider sx={{ mb: 3 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Connect your Gmail to automatically import bank transaction SMS
        </Typography>

        {!emailIntegration.provider ? (
          <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={handleConnectGmail}
            disabled={loading}
            fullWidth
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
              },
            }}
          >
            Connect Gmail Account
          </Button>
        ) : (
          <>
            {/* Connection Status */}
            <Box
              sx={{
                p: 2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}10 0%, ${theme.palette.primary.light}10 100%)`,
                borderRadius: 2,
                border: 1,
                borderColor: theme.palette.primary.main,
                mb: 2,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon sx={{ color: theme.palette.primary.main }} />
                  <Typography variant="body2" fontWeight={600}>
                    Connected to Gmail
                  </Typography>
                </Box>
                <Chip
                  label={syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Error' : 'Idle'}
                  size="small"
                  color={syncStatus === 'syncing' ? 'info' : syncStatus === 'error' ? 'error' : 'default'}
                  sx={{ fontSize: '0.7rem' }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {emailIntegration.email}
              </Typography>
              {lastSyncTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Last checked: {lastSyncTime.toLocaleTimeString()}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Stats Cards */}
            {emailIntegration.totalEmailsProcessed > 0 && (
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Paper
                  elevation={0}
                  sx={{
                    flex: 1,
                    p: 2,
                    textAlign: 'center',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}10 0%, ${theme.palette.primary.light}10 100%)`,
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="h4"
                    fontWeight={700}
                    sx={{
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {emailIntegration.totalEmailsProcessed}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Processed
                  </Typography>
                </Paper>
                <Paper
                  elevation={0}
                  sx={{
                    flex: 1,
                    p: 2,
                    textAlign: 'center',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}10 0%, ${theme.palette.primary.light}10 100%)`,
                    borderRadius: 2,
                    position: 'relative',
                  }}
                >
                  {pendingCount > 0 && (
                    <Chip
                      label={pendingCount}
                      size="small"
                      color="warning"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        height: 20,
                        minWidth: 20,
                        fontSize: '0.7rem',
                      }}
                    />
                  )}
                  <NotificationsIcon sx={{ fontSize: 32, color: theme.palette.primary.main, mb: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    Pending Review
                  </Typography>
                </Paper>
              </Stack>
            )}

            {/* Action Buttons */}
            <Stack spacing={2} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={syncing ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SyncIcon />}
                onClick={handleManualSync}
                disabled={syncing || !emailIntegration.enabled}
                fullWidth
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                  },
                }}
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={emailIntegration.enabled}
                  onChange={(e) => handleToggleEmailIntegration(e.target.checked)}
                  disabled={loading}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Enable Automatic Polling</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Checks every 5 minutes
                  </Typography>
                </Box>
              }
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
          </>
        )}
      </Paper>

      {/* Supported Banks */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Supported Banks
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          We currently support SMS parsing from these banks:
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
            <Chip key={bank} label={bank} variant="outlined" size="small" />
          ))}
        </Box>
      </Paper>

      {/* Delete Account */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          color="error"
          onClick={() => setDeleteDialogOpen(true)}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            px: 4,
            py: 1.5,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          }}
        >
          Delete Account
        </Button>
      </Box>

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6" fontWeight={600}>
              Delete Account
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            This action <strong>cannot be undone</strong>. This will permanently delete your
            account and remove all your data from our servers.
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
              <br />• Phone: <strong>{user?.phone || 'Not provided'}</strong>
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
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
