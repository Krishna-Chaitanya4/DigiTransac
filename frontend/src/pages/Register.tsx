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
  InputAdornment,
  Card,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Email, Lock, Person, Check, Close } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength validation
  const passwordStrength = {
    hasMinLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const passwordStrengthScore =
    Object.values(passwordStrength).filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Validation
      if (!email.trim() || !username.trim() || !fullName.trim() || !password.trim()) {
        setError('All fields are required');
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        setError('Please enter a valid email address');
        return;
      }

      await register(email, username, fullName, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 3,
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.5s ease-out',
            '@keyframes slideUp': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
                fontSize: { xs: '2rem', sm: '2.5rem' },
              }}
            >
              DigiTransac
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              Create Your Account
            </Typography>
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
              Get Started Today
            </Typography>

            {/* Error Alert */}
            {error && (
              <Alert
                severity="error"
                sx={{
                  animation: 'slideDown 0.3s ease-out',
                  '@keyframes slideDown': {
                    from: { opacity: 0, transform: 'translateY(-10px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                {error}
              </Alert>
            )}

            {/* Email Field */}
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              disabled={loading}
              placeholder="your@email.com"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: 'primary.main', mr: 1 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '1rem',
                  py: 1,
                },
              }}
            />

            {/* Full Name Field */}
            <TextField
              label="Full Name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              fullWidth
              disabled={loading}
              placeholder="John Doe"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person sx={{ color: 'primary.main', mr: 1 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '1rem',
                  py: 1,
                },
              }}
            />

            {/* Username Field */}
            <TextField
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              disabled={loading}
              placeholder="johndoe"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person sx={{ color: 'primary.main', mr: 1 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '1rem',
                  py: 1,
                },
              }}
            />

            {/* Password Field */}
            <Box>
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                disabled={loading}
                placeholder="Min 8 characters"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: 'primary.main', mr: 1 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={() => setShowPassword(!showPassword)}
                        sx={{ color: 'primary.main', textTransform: 'none' }}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </Button>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '1rem',
                    py: 1,
                  },
                }}
              />

              {/* Password Strength */}
              {password && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      Password Strength
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color:
                          passwordStrengthScore <= 1
                            ? 'error.main'
                            : passwordStrengthScore <= 2
                              ? 'warning.main'
                              : passwordStrengthScore <= 3
                                ? 'info.main'
                                : 'success.main',
                      }}
                    >
                      {passwordStrengthScore <= 1
                        ? 'Weak'
                        : passwordStrengthScore <= 2
                          ? 'Fair'
                          : passwordStrengthScore <= 3
                            ? 'Good'
                            : 'Strong'}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(passwordStrengthScore / 4) * 100}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#e0e0e0',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        backgroundColor:
                          passwordStrengthScore <= 1
                            ? '#f44336'
                            : passwordStrengthScore <= 2
                              ? '#ff9800'
                              : passwordStrengthScore <= 3
                                ? '#2196f3'
                                : '#4caf50',
                      },
                    }}
                  />
                  <List
                    sx={{
                      mt: 1.5,
                      p: 0,
                      '& .MuiListItem-root': { py: 0.5, px: 0 },
                    }}
                  >
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {passwordStrength.hasMinLength ? (
                          <Check sx={{ color: 'success.main', fontSize: '1.2rem' }} />
                        ) : (
                          <Close sx={{ color: 'text.disabled', fontSize: '1.2rem' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary="At least 8 characters"
                        primaryTypographyProps={{ variant: 'caption', fontSize: '0.85rem' }}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {passwordStrength.hasUpperCase ? (
                          <Check sx={{ color: 'success.main', fontSize: '1.2rem' }} />
                        ) : (
                          <Close sx={{ color: 'text.disabled', fontSize: '1.2rem' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary="One uppercase letter"
                        primaryTypographyProps={{ variant: 'caption', fontSize: '0.85rem' }}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {passwordStrength.hasLowerCase ? (
                          <Check sx={{ color: 'success.main', fontSize: '1.2rem' }} />
                        ) : (
                          <Close sx={{ color: 'text.disabled', fontSize: '1.2rem' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary="One lowercase letter"
                        primaryTypographyProps={{ variant: 'caption', fontSize: '0.85rem' }}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {passwordStrength.hasNumber ? (
                          <Check sx={{ color: 'success.main', fontSize: '1.2rem' }} />
                        ) : (
                          <Close sx={{ color: 'text.disabled', fontSize: '1.2rem' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary="One number"
                        primaryTypographyProps={{ variant: 'caption', fontSize: '0.85rem' }}
                      />
                    </ListItem>
                  </List>
                </Box>
              )}
            </Box>

            {/* Confirm Password Field */}
            <TextField
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              disabled={loading}
              placeholder="Re-enter your password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: 'primary.main', mr: 1 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      sx={{ color: 'primary.main', textTransform: 'none' }}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '1rem',
                  py: 1,
                },
              }}
            />

            {/* Password Match Indicator */}
            {password && confirmPassword && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {password === confirmPassword ? (
                  <>
                    <Check sx={{ color: 'success.main', fontSize: '1.2rem' }} />
                    <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                      Passwords match
                    </Typography>
                  </>
                ) : (
                  <>
                    <Close sx={{ color: 'error.main', fontSize: '1.2rem' }} />
                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                      Passwords do not match
                    </Typography>
                  </>
                )}
              </Box>
            )}

            {/* Create Account Button */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                py: 1.75,
                fontWeight: 700,
                fontSize: '1rem',
                mt: 2,
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a4290 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                },
                '&:disabled': {
                  background: 'linear-gradient(135deg, #bdbdbd 0%, #9e9e9e 100%)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>

            {/* Divider */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 1 }}>
              <Box sx={{ flex: 1, height: '1px', background: 'divider' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Already have an account?
              </Typography>
              <Box sx={{ flex: 1, height: '1px', background: 'divider' }} />
            </Box>

            {/* Login Link */}
            <Button
              component={Link}
              to="/login"
              variant="outlined"
              fullWidth
              sx={{
                py: 1.5,
                fontWeight: 600,
                fontSize: '1rem',
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(102, 126, 234, 0.05)',
                  borderColor: 'primary.main',
                },
              }}
            >
              Sign In Instead
            </Button>
          </Box>
        </Card>
      </Container>
    </Box>
  );
};
