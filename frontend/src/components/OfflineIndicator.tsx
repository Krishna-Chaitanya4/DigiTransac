import React, { useState, useEffect } from 'react';
import { Box, Snackbar, Alert, IconButton, Typography, Collapse } from '@mui/material';
import {
  CloudOff as OfflineIcon,
  Cloud as OnlineIcon,
  Sync as SyncIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { syncManager } from '../utils/offline/sync';

/**
 * Offline indicator component
 * Shows connection status and sync progress
 */
const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setDismissed(false);
      
      // Start syncing
      setSyncing(true);
      syncManager.sync().finally(() => {
        setSyncing(false);
        updateQueueSize();
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      setDismissed(false);
    };

    const updateQueueSize = async () => {
      const size = await syncManager.getQueueSize();
      setQueueSize(size);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial queue size
    updateQueueSize();

    // Update queue size every 10 seconds
    const interval = setInterval(updateQueueSize, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Auto-hide online banner after 5 seconds
  useEffect(() => {
    if (isOnline && showBanner && !dismissed) {
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline, showBanner, dismissed]);

  const handleClose = () => {
    setDismissed(true);
    setShowBanner(false);
  };

  if (!showBanner && (isOnline || dismissed)) return null;

  return (
    <>
      {/* Persistent offline banner */}
      <Collapse in={!isOnline}>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1400,
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
            py: 1,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            boxShadow: 2,
          }}
        >
          <OfflineIcon fontSize="small" />
          <Typography variant="body2" fontWeight={500}>
            You're offline
          </Typography>
          {queueSize > 0 && (
            <Typography variant="body2" sx={{ ml: 1 }}>
              ({queueSize} {queueSize === 1 ? 'change' : 'changes'} pending)
            </Typography>
          )}
        </Box>
      </Collapse>

      {/* Back online snackbar */}
      <Snackbar
        open={isOnline && showBanner && !dismissed}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: { xs: 70, md: 80 } }}
      >
        <Alert
          severity="success"
          variant="filled"
          icon={syncing ? <SyncIcon className="spinning" /> : <OnlineIcon />}
          action={
            <IconButton size="small" color="inherit" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{
            '& .spinning': {
              animation: 'spin 1s linear infinite',
            },
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        >
          {syncing ? (
            <Typography variant="body2">Syncing changes...</Typography>
          ) : queueSize > 0 ? (
            <Typography variant="body2">Back online - {queueSize} changes synced</Typography>
          ) : (
            <Typography variant="body2">Back online</Typography>
          )}
        </Alert>
      </Snackbar>
    </>
  );
};

export default React.memo(OfflineIndicator);
