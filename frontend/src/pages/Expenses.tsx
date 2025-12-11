import React from 'react';
import { Typography, Box } from '@mui/material';

const Expenses: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Expenses
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Manage your expenses here (Coming Soon)
      </Typography>
    </Box>
  );
};

export default Expenses;
