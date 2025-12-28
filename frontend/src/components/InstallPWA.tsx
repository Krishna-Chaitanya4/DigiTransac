import React, { useState, useEffect } from 'react';
import { Box, Button, Snackbar, IconButton } from '@mui/material';
import { Close as CloseIcon, GetApp as InstallIcon } from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    // User accepted: outcome === 'accepted'
    // User dismissed: outcome === 'dismissed'
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleClose = () => {
    setShowInstallPrompt(false);
  };

  return (
    <Snackbar
      open={showInstallPrompt}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 80, md: 24 } }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          p: 2,
          borderRadius: 2,
          boxShadow: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 300,
        }}
      >
        <InstallIcon color="primary" />
        <Box flex={1}>
          <Box fontWeight={600} mb={0.5}>
            Install DigiTransac
          </Box>
          <Box fontSize="0.875rem" color="text.secondary">
            Add to home screen for quick access
          </Box>
        </Box>
        <Button variant="contained" size="small" onClick={handleInstallClick}>
          Install
        </Button>
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Snackbar>
  );
};

export default InstallPWA;
