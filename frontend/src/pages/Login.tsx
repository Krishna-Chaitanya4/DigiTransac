import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  Alert,
  Fade,
  Zoom,
  Divider,
  Grid,
  Stack,
  Chip,
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  AccountBalance,
  Email,
  Lock,
  ArrowForward,
  TrendingUp,
  Security,
  CloudDone,
  AccountBalanceWallet,
  Insights,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIdentifier(value);
    // No specific validation needed - can be email, phone, or username
    if (value && value.length < 3) {
      setIdentifierError('Please enter your email, phone, or username');
    } else {
      setIdentifierError('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (value && value.length < 8) {
      setPasswordError('Password must be at least 8 characters');
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate before submitting
    if (!identifier || identifier.length < 3) {
      setIdentifierError('Please enter your email, phone, or username');
      return;
    }
    
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    setIsLoading(true);

    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        py: { xs: 3, sm: 4 },
        background: (theme) =>
          theme.palette.mode === 'light'
            ? '#0ea5e9' // Base sky blue
            : 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
        // Multiple overlapping gradients for mesh effect
        backgroundImage: (theme) =>
          theme.palette.mode === 'light'
            ? `
              radial-gradient(at 0% 0%, #06b6d4 0%, transparent 50%),
              radial-gradient(at 100% 0%, #14b8a6 0%, transparent 50%),
              radial-gradient(at 100% 100%, #0891b2 0%, transparent 50%),
              radial-gradient(at 0% 100%, #0d9488 0%, transparent 50%),
              radial-gradient(at 50% 50%, #22d3ee 0%, transparent 50%)
            `
            : 'none',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, rgba(20, 184, 166, 0.4) 0%, rgba(6, 182, 212, 0.4) 50%, rgba(8, 145, 178, 0.4) 100%)',
          animation: 'waveMove 15s ease-in-out infinite',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(-45deg, rgba(13, 148, 136, 0.3) 0%, transparent 50%, rgba(34, 211, 238, 0.3) 100%)',
          animation: 'waveMove2 20s ease-in-out infinite reverse',
        },
        '@keyframes waveMove': {
          '0%, 100%': { 
            transform: 'translateX(-25%) translateY(-25%) rotate(0deg)',
            opacity: 0.6,
          },
          '50%': { 
            transform: 'translateX(25%) translateY(25%) rotate(180deg)',
            opacity: 0.9,
          },
        },
        '@keyframes waveMove2': {
          '0%, 100%': { 
            transform: 'translateX(25%) translateY(25%) rotate(0deg)',
            opacity: 0.5,
          },
          '50%': { 
            transform: 'translateX(-25%) translateY(-25%) rotate(-180deg)',
            opacity: 0.8,
          },
        },
      }}
    >
      {/* Animated gradient orbs */}
      <Box
        sx={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, transparent 70%)',
          borderRadius: '50%',
          top: '-200px',
          left: '-200px',
          filter: 'blur(100px)',
          animation: 'pulse1 12s ease-in-out infinite',
          '@keyframes pulse1': {
            '0%, 100%': { 
              transform: 'scale(1)',
              opacity: 0.6,
            },
            '50%': { 
              transform: 'scale(1.3)',
              opacity: 0.9,
            },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%)',
          borderRadius: '50%',
          bottom: '-150px',
          right: '-150px',
          filter: 'blur(90px)',
          animation: 'pulse2 16s ease-in-out infinite',
          '@keyframes pulse2': {
            '0%, 100%': { 
              transform: 'scale(1.2)',
              opacity: 0.5,
            },
            '50%': { 
              transform: 'scale(1)',
              opacity: 0.8,
            },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(8, 145, 178, 0.18) 0%, transparent 70%)',
          borderRadius: '50%',
          top: '40%',
          right: '10%',
          filter: 'blur(80px)',
          animation: 'drift1 20s ease-in-out infinite',
          '@keyframes drift1': {
            '0%, 100%': { 
              transform: 'translate(0, 0)',
            },
            '33%': { 
              transform: 'translate(-80px, 60px)',
            },
            '66%': { 
              transform: 'translate(40px, -40px)',
            },
          },
        }}
      />
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, px: { xs: 2, sm: 3 } }}>
        <Grid container spacing={{ xs: 0, md: 4 }} alignItems="center">
          {/* Left Side - Features */}
          <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Fade in timeout={800}>
                <Box>
                  {/* App Branding */}
                  <Box sx={{ mb: 6 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        p: 2.5,
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        mb: 3,
                        boxShadow: '0 8px 32px rgba(20, 184, 166, 0.3)',
                        animation: 'float 3s ease-in-out infinite',
                        '@keyframes float': {
                          '0%, 100%': { transform: 'translateY(0px)' },
                          '50%': { transform: 'translateY(-10px)' },
                        },
                      }}
                    >
                      <AccountBalance sx={{ fontSize: 48, color: 'white' }} />
                    </Box>
                    <Typography
                      variant="h2"
                      fontWeight={900}
                      gutterBottom
                      sx={{
                        color: 'white',
                        letterSpacing: '-0.02em',
                        textShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        mb: 2,
                      }}
                    >
                      DigiTransac
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{
                        color: 'rgba(255,255,255,0.9)',
                        fontWeight: 500,
                        lineHeight: 1.6,
                        mb: 1,
                      }}
                    >
                      Your Complete Digital Transaction Manager
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '1.1rem',
                        lineHeight: 1.7,
                      }}
                    >
                      Track income, expenses, and transfers all in one place. 
                      Get insights that help you make better financial decisions.
                    </Typography>
                  </Box>

                  {/* Features List */}
                  <Stack spacing={3}>
                    {[
                      {
                        icon: <TrendingUp />,
                        title: 'Complete Transaction Tracking',
                        desc: 'Manage income, expenses, and transfers seamlessly',
                      },
                      {
                        icon: <AccountBalanceWallet />,
                        title: 'Multi-Account Management',
                        desc: 'Track all your bank accounts and credit cards in one place',
                      },
                      {
                        icon: <Insights />,
                        title: 'Smart Analytics & Insights',
                        desc: 'Beautiful charts and intelligent spending patterns',
                      },
                      {
                        icon: <CloudDone />,
                        title: 'Offline-First, Cloud-Synced',
                        desc: 'Works without internet, syncs when you\'re back online',
                      },
                      {
                        icon: <Security />,
                        title: 'Bank-Level Security',
                        desc: '256-bit encryption keeps your financial data safe',
                      },
                    ].map((feature, index) => (
                      <Zoom in timeout={1000 + index * 200} key={index}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 2,
                            p: 2.5,
                          borderRadius: 3,
                          background: 'rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            background: 'rgba(255, 255, 255, 0.15)',
                            transform: 'translateX(8px)',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              background: 'rgba(255, 255, 255, 0.2)',
                              display: 'flex',
                              color: 'white',
                              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.2)',
                            }}
                          >
                            {feature.icon}
                          </Box>
                          <Box>
                            <Typography
                              variant="subtitle1"
                              fontWeight={700}
                              sx={{ color: 'white', mb: 0.5 }}
                            >
                              {feature.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}
                            >
                              {feature.desc}
                            </Typography>
                          </Box>
                        </Box>
                      </Zoom>
                    ))}
                  </Stack>

                  {/* Trust Badges */}
                  <Box sx={{ mt: 4, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    <Chip
                      label="🔒 Encrypted"
                      sx={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        fontWeight: 600,
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        '&:hover': {
                          background: 'rgba(255, 255, 255, 0.25)',
                        },
                      }}
                    />
                    <Chip
                      label="📱 PWA Ready"
                      sx={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        fontWeight: 600,
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        '&:hover': {
                          background: 'rgba(255, 255, 255, 0.25)',
                        },
                      }}
                    />
                    <Chip
                      label="🌙 Dark Mode"
                      sx={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        fontWeight: 600,
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        '&:hover': {
                          background: 'rgba(255, 255, 255, 0.25)',
                        },
                      }}
                    />
                  </Box>
                </Box>
              </Fade>
          </Grid>

          {/* Right Side - Login Form */}
          <Grid item xs={12} md={6}>
            <Fade in timeout={600}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 3, sm: 5 },
                  borderRadius: { xs: 3, sm: 4 },
                  background: (theme) =>
                    theme.palette.mode === 'light'
                      ? 'rgba(255, 255, 255, 0.95)'
                      : 'rgba(30, 30, 30, 0.95)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                  border: (theme) =>
                    theme.palette.mode === 'light'
                      ? '1px solid rgba(255, 255, 255, 0.18)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 48px 0 rgba(31, 38, 135, 0.5)',
                  },
                }}
                >
            <Zoom in timeout={800}>
              <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
                <Box
                  sx={{
                    display: { xs: 'inline-flex', md: 'none' },
                    p: { xs: 1.5, sm: 2 },
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                    mb: 2,
                    boxShadow: '0 4px 20px rgba(20, 184, 166, 0.4)',
                    animation: 'float 3s ease-in-out infinite',
                    '@keyframes float': {
                      '0%, 100%': { transform: 'translateY(0px)' },
                      '50%': { transform: 'translateY(-10px)' },
                    },
                  }}
                >
                  <AccountBalance sx={{ fontSize: { xs: 40, sm: 48 }, color: 'white' }} />
                </Box>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  gutterBottom
                  sx={{
                    fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
                    background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.02em',
                    mb: 1,
                  }}
                >
                  Welcome Back
                </Typography>
                <Typography 
                  variant="body1" 
                  color="text.secondary" 
                  sx={{ 
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    fontWeight: 500,
                  }}
                >
                  Sign in to continue managing your finances
                </Typography>
              </Box>
            </Zoom>

          {error && (
            <Fade in timeout={300}>
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 2,
                  '& .MuiAlert-icon': {
                    fontSize: 24,
                  },
                }}
              >
                {error}
              </Alert>
            </Fade>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Email, Phone, or Username"
                value={identifier}
                onChange={handleIdentifierChange}
                onFocus={() => setIdentifierFocused(true)}
                onBlur={() => setIdentifierFocused(false)}
                required
                autoComplete="username"
                autoFocus
                error={!!identifierError}
                helperText={identifierError || 'Enter your email, phone number, or username'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email 
                        sx={{ 
                          color: identifierFocused ? 'primary.main' : 'action.disabled',
                          transition: 'color 0.3s ease',
                        }} 
                      />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backgroundColor: identifierFocused ? 'action.hover' : 'transparent',
                    '& fieldset': {
                      borderWidth: 2,
                      transition: 'border-color 0.3s ease',
                    },
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      '& fieldset': {
                        borderColor: 'primary.main',
                      },
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontWeight: 500,
                  },
                }}
              />
            </Box>

            <Box sx={{ mb: 1 }}>
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                autoComplete="current-password"
                error={!!passwordError}
                helperText={passwordError}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock 
                        sx={{ 
                          color: passwordFocused ? 'primary.main' : 'action.disabled',
                          transition: 'color 0.3s ease',
                        }} 
                      />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backgroundColor: passwordFocused ? 'action.hover' : 'transparent',
                    '& fieldset': {
                      borderWidth: 2,
                      transition: 'border-color 0.3s ease',
                    },
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      '& fieldset': {
                        borderColor: 'primary.main',
                      },
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontWeight: 500,
                  },
                }}
              />
            </Box>

            <Box sx={{ textAlign: 'right', mb: 3 }}>
              <Link
                component={RouterLink}
                to="/forgot-password"
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: 'primary.main',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    textDecoration: 'underline',
                    transform: 'translateX(2px)',
                  },
                }}
              >
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading || !identifier || !password || !!identifierError || !!passwordError}
              endIcon={!isLoading && <ArrowForward />}
              sx={{
                mt: 1,
                mb: 3,
                py: { xs: 1.5, sm: 1.8 },
                fontSize: { xs: '1rem', sm: '1.1rem' },
                fontWeight: 700,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                boxShadow: '0 4px 20px rgba(20, 184, 166, 0.4)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  transition: 'left 0.5s ease',
                },
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 8px 30px rgba(20, 184, 166, 0.6)',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%)',
                  '&::before': {
                    left: '100%',
                  },
                },
                '&:active': {
                  transform: 'translateY(-1px)',
                },
                '&:disabled': {
                  background: 'rgba(20, 184, 166, 0.5)',
                  transform: 'none',
                },
              }}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, fontWeight: 500 }}>
                or
              </Typography>
            </Divider>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Don't have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/register"
                  sx={{
                    fontWeight: 700,
                    textDecoration: 'none',
                    background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Sign Up
                </Link>
              </Typography>
            </Box>
          </form>
        </Paper>
      </Fade>
    </Grid>
  </Grid>
</Container>
</Box>
);
};

export default Login;
