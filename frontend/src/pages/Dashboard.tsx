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
        width: '100vw',
        py: { xs: 3, md: 4 },
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={{ xs: 1.5, sm: 0 }}
          sx={{ mb: 4 }}
        >
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
            DigiTransac
          </Typography>
          <Button
            variant="contained"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ 
              alignSelf: { xs: 'stretch', sm: 'auto' },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Logout
          </Button>
        </Stack>

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
          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Email
              </Typography>
              <Typography variant="h6">{user?.email}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Username
              </Typography>
              <Typography variant="h6">{user?.username}</Typography>
            </CardContent>
          </Card>
        </Stack>

        {/* Placeholder Cards */}
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 2,
          }}
        >
          {['Transactions', 'Categories', 'Budgets', 'Analytics'].map((title) => (
            <Card
              key={title}
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
                '&:hover': {
                  transform: 'translateY(-6px)',
                  boxShadow: 3,
                },
              }}
            >
              <CardContent>
                <Typography color="text.secondary" align="center" sx={{ fontSize: 14 }}>
                  {title}
                </Typography>
                <Typography variant="h6" align="center" sx={{ mt: 1, fontSize: 18 }}>
                  Coming Soon
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>
    </Box>
  );
};
