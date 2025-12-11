import React from 'react';
import { Typography, Box } from '@mui/material';

const Profile: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Profile
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Manage your profile settings here (Coming Soon)
      </Typography>
    </Box>
  );
};

export default Profile;
