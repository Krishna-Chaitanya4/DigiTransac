import React from 'react';
import { Box, CircularProgress, Typography, useMediaQuery, useTheme } from '@mui/material';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

const Loading: React.FC<LoadingProps> = ({ message, fullScreen = true }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        minHeight: fullScreen ? '100vh' : '200px',
        background: (theme) =>
          fullScreen
            ? theme.palette.mode === 'light'
              ? theme.palette.gradient.primary
              : 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'
            : 'transparent',
      }}
    >
      <CircularProgress 
        size={isMobile ? 48 : 60}
        sx={{ color: fullScreen ? 'white' : 'primary.main' }} 
      />
      {message && (
        <Typography 
          variant="body2" 
          sx={{ 
            color: fullScreen ? 'white' : 'text.secondary',
            fontSize: { xs: '0.875rem', sm: '1rem' },
            textAlign: 'center',
            px: 2,
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default React.memo(Loading);
