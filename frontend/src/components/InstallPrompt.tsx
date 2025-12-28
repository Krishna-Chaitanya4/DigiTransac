import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';
import { isPWA } from '../utils/pwa';
import { useResponsive } from '../hooks/useResponsive';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA install prompt component
 * Shows a native-like prompt to install the app
 */
export const InstallPrompt: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const theme = useTheme();
  const { isMobile } = useResponsive();

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isPWA() || dismissed) return;

    // Check if previously dismissed (within 7 days)
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const daysSinceDismissed =
        (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setDismissed(true);
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 10 seconds of usage
      setTimeout(() => {
        if (!dismissed && !isPWA()) {
          setShowPrompt(true);
        }
      }, 10000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [dismissed]);

  const handleInstall = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      // PWA installed if outcome === 'accepted'
      
      setShowPrompt(false);
      setInstallPrompt(null);
    } catch (error) {
      console.error('Install error:', error);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setDismissed(true);
    setShowPrompt(false);
  };

  if (!showPrompt || !installPrompt) return null;

  return (
    <Dialog
      open={showPrompt}
      onClose={handleDismiss}
      PaperProps={{
        sx: {
          position: 'fixed',
          bottom: isMobile ? 0 : 24,
          left: isMobile ? 0 : 'auto',
          right: isMobile ? 0 : 24,
          m: 0,
          maxWidth: isMobile ? '100%' : 420,
          width: '100%',
          borderRadius: isMobile ? '16px 16px 0 0' : 3,
          background: theme.palette.mode === 'light' ? 'white' : 'rgba(30, 30, 30, 0.98)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        },
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                background: theme.palette.gradient.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${theme.palette.primary.main}66`,
              }}
            >
              <GetAppIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Install DigiTransac
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Get quick access from your home screen
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleDismiss} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box mb={3}>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Install our app for:
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            {[
              '⚡ Faster loading and offline access',
              '📱 Native app experience',
              '🔔 Push notifications (coming soon)',
              '💾 Save to home screen',
            ].map((feature, idx) => (
              <Typography key={idx} variant="body2" color="text.secondary">
                {feature}
              </Typography>
            ))}
          </Box>
        </Box>

        <Box display="flex" gap={2}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleInstall}
            sx={{
              py: 1.5,
              borderRadius: 2,
              background: theme.palette.gradient.primary,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
            }}
          >
            Install Now
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleDismiss}
            sx={{
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                borderColor: 'primary.dark',
                bgcolor: 'primary.lighter',
              },
            }}
          >
            Maybe Later
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
