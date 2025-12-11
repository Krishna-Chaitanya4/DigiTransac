import React from 'react';
import { Typography, Box } from '@mui/material';

const Budgets: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Budgets
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Manage your budgets here (Coming Soon)
      </Typography>
    </Box>
  );
};

export default Budgets;
