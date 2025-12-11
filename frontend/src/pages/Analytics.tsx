import React from 'react';
import { Typography, Box } from '@mui/material';

const Analytics: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Analytics
      </Typography>
      <Typography variant="body1" color="text.secondary">
        View your expense analytics here (Coming Soon)
      </Typography>
    </Box>
  );
};

export default Analytics;
