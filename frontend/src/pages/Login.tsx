import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!emailOrUsername.trim() || !password.trim()) {
        setError('Please enter email/username and password');
        return;
      }

      await login(emailOrUsername, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 3,
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            DigiTransac
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Smart Personal Finance Management
          </Typography>
        </Box>

        {/* Form */}
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: 3,
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Login
          </Typography>

          {/* Error Alert */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Email/Username Field */}
          <TextField
            label="Email or Username"
            type="text"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            fullWidth
            disabled={loading}
            autoFocus
            size="small"
          />

          {/* Password Field */}
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            disabled={loading}
            size="small"
          />

          {/* Login Button */}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              py: 1.5,
              fontWeight: 600,
              mt: 1,
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
          </Button>

          {/* Register Link */}
          <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#667eea', fontWeight: 600, textDecoration: 'none' }}>
              Register here
            </Link>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};
