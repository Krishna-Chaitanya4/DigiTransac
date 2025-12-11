import React from 'react';
import { Typography, Box } from '@mui/material';

const Categories: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Categories
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Manage your category folders here (Coming Soon)
      </Typography>
    </Box>
  );
};

export default Categories;
