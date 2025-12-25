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
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      }}
    >
      <CircularProgress size={60} sx={{ color: 'white' }} />
    </Box>
  );
};

export default React.memo(Loading);
