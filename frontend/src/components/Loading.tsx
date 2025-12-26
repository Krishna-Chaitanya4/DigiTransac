import React from 'react';
import { Box, CircularProgress } from '@mui/material';

const Loading: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: (theme) =>
          theme.palette.mode === 'light'
            ? theme.palette.gradient.primary
            : 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      }}
    >
      <CircularProgress size={60} sx={{ color: 'white' }} />
    </Box>
  );
};

export default React.memo(Loading);
