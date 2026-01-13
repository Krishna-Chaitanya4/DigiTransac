import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../context/AuthContext';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        paddingY: 4,
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
            DigiTransac
          </Typography>
          <Button
            variant="contained"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Box>

        {/* Welcome Card */}
        <Paper
          elevation={3}
          sx={{
            padding: 3,
            marginBottom: 4,
            borderRadius: 2,
          }}
        >
          <Typography variant="h5" gutterBottom>
            👋 Welcome, {user?.fullName || 'User'}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You're all set! Dashboard coming soon with analytics, budgets, and
            transaction management.
          </Typography>
        </Paper>

        {/* User Info */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Email
              </Typography>
              <Typography variant="h6">{user?.email}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Username
              </Typography>
              <Typography variant="h6">{user?.username}</Typography>
            </CardContent>
          </Card>
        </Stack>

        {/* Placeholder Cards */}
        <Stack direction="row" spacing={2} sx={{ marginTop: 2, flexWrap: 'wrap' }}>
          {['Transactions', 'Categories', 'Budgets', 'Analytics'].map(
            (title) => (
              <Card
                key={title}
                sx={{
                  flex: '1 1 calc(25% - 16px)',
                  minWidth: 200,
                  cursor: 'pointer',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 3,
                  },
                }}
              >
                  <CardContent>
                    <Typography
                      color="text.secondary"
                      align="center"
                      sx={{ fontSize: 14 }}
                    >
                      {title}
                    </Typography>
                    <Typography
                      variant="h6"
                      align="center"
                      sx={{ marginTop: 1, fontSize: 18 }}
                    >
                      Coming Soon
                    </Typography>
                  </CardContent>
                </Card>
            )
          )}
        </Stack>
      </Container>
    </Box>
  );
};
