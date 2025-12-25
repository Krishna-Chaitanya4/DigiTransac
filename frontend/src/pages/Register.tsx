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
  Grid,
  MenuItem,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Stack,
  Fade,
  Zoom,
  useMediaQuery,
  useTheme,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  AccountBalance,
  CheckCircle,
  Cancel,
  Security,
  Speed,
  Insights,
  CloudSync,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
];

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    currency: 'USD',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: '',
    color: '',
    checks: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    },
  });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const calculatePasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;
    let label = '';
    let color = '';

    if (score === 0) {
      label = '';
      color = '';
    } else if (score <= 2) {
      label = 'Weak';
      color = '#f44336';
    } else if (score <= 4) {
      label = 'Medium';
      color = '#ff9800';
    } else {
      label = 'Strong';
      color = '#4caf50';
    }

    setPasswordStrength({ score, label, color, checks });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Real-time email validation
    if (name === 'email') {
      if (value && !validateEmail(value)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError('');
      }
    }

    // Real-time password validation
    if (name === 'password') {
      calculatePasswordStrength(value);
      if (value.length > 0 && value.length < 8) {
        setPasswordError('Password must be at least 8 characters');
      } else {
        setPasswordError('');
      }
      // Check confirm password match
      if (formData.confirmPassword && value !== formData.confirmPassword) {
        setConfirmPasswordError('Passwords do not match');
      } else {
        setConfirmPasswordError('');
      }
    }

    // Real-time confirm password validation
    if (name === 'confirmPassword') {
      if (value && value !== formData.password) {
        setConfirmPasswordError('Passwords do not match');
      } else {
        setConfirmPasswordError('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email
    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Check password strength
    if (passwordStrength.score < 3) {
      setError('Please choose a stronger password. Include uppercase, lowercase, numbers, and special characters.');
      return;
    }

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate terms agreement
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        currency: formData.currency,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
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
        position: 'relative',
        overflow: 'hidden',
        background: '#0ea5e9',
        py: { xs: 3, sm: 4 },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 0% 0%, rgba(20, 184, 166, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 100% 0%, rgba(6, 182, 212, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(8, 145, 178, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, rgba(13, 148, 136, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.2) 0%, transparent 50%)
          `,
          animation: 'meshMove 20s ease-in-out infinite',
        },
        '@keyframes meshMove': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '33%': { transform: 'scale(1.1) rotate(120deg)' },
          '66%': { transform: 'scale(0.9) rotate(240deg)' },
        },
        // Floating shapes
        '&::after': {
          content: '""',
          position: 'absolute',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          top: '-200px',
          right: '-200px',
          filter: 'blur(60px)',
          animation: 'float1 20s ease-in-out infinite',
        },
        '@keyframes float1': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-100px, 100px) scale(1.1)' },
        },
      }}
    >
      {/* Additional floating shapes */}
      <Box
        sx={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          bottom: '-150px',
          left: '-150px',
          filter: 'blur(70px)',
          animation: 'float2 25s ease-in-out infinite',
          '@keyframes float2': {
            '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
            '50%': { transform: 'translate(100px, -100px) scale(1.2)' },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: '350px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(8, 145, 178, 0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          top: '50%',
          right: '10%',
          filter: 'blur(80px)',
          animation: 'float3 18s ease-in-out infinite',
          '@keyframes float3': {
            '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
            '50%': { transform: 'translate(-50px, 50px) rotate(180deg)' },
          },
        }}
      />
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={0} sx={{ minHeight: { md: '90vh' } }}>
          {/* Left Side - Features */}
          {!isMobile && (
            <Grid item xs={12} md={5}>
              <Fade in timeout={800}>
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    pr: 4,
                  }}
                >
                  <Typography
                    variant="h2"
                    fontWeight={800}
                    sx={{
                      color: 'white',
                      mb: 2,
                      textShadow: '0 2px 20px rgba(0,0,0,0.2)',
                    }}
                  >
                    Join DigiTransac
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.9)',
                      mb: 5,
                      fontWeight: 300,
                    }}
                  >
                    Your journey to smarter finance starts here
                  </Typography>

                  <Stack spacing={3}>
                    {[
                      { icon: <Security />, title: 'Bank-Grade Security', desc: 'Your data is encrypted with industry-leading security' },
                      { icon: <Insights />, title: 'Smart Insights', desc: 'AI-powered analytics for better financial decisions' },
                      { icon: <Speed />, title: 'Lightning Fast', desc: 'Real-time transaction tracking and updates' },
                      { icon: <CloudSync />, title: 'Cloud Sync', desc: 'Access your finances from anywhere, anytime' },
                    ].map((feature, index) => (
                      <Zoom in timeout={1000 + index * 200} key={feature.title}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 3,
                            background: 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: 3,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              background: 'rgba(255, 255, 255, 0.25)',
                              transform: 'translateX(10px)',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                background: 'rgba(255, 255, 255, 0.2)',
                                color: 'white',
                              }}
                            >
                              {feature.icon}
                            </Box>
                            <Box>
                              <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                                {feature.title}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                {feature.desc}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      </Zoom>
                    ))}
                  </Stack>
                </Box>
              </Fade>
            </Grid>
          )}

          {/* Right Side - Registration Form */}
          <Grid item xs={12} md={7}>
            <Fade in timeout={600}>
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pl: { md: 4 },
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 3, sm: 5 },
                    borderRadius: 4,
                    maxWidth: 600,
                    width: '100%',
                    background: (theme) =>
                      theme.palette.mode === 'light'
                        ? 'rgba(255, 255, 255, 0.98)'
                        : 'rgba(30, 30, 30, 0.98)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                    border: (theme) =>
                      theme.palette.mode === 'light'
                        ? '1px solid rgba(255, 255, 255, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                p: 2,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                mb: 2,
              }}
            >
              <AccountBalance sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography
              variant="h4"
              fontWeight={800}
              gutterBottom
              sx={{
                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Create Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Join thousands managing their finances smarter
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  autoFocus
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      },
                      '&.Mui-focused': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      },
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      },
                      '&.Mui-focused': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      },
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  error={!!emailError}
                  helperText={emailError}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  required
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency.code} value={currency.code}>
                      {currency.symbol} - {currency.name} ({currency.code})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  error={!!passwordError}
                  helperText={passwordError}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
                {/* Password Strength Indicator */}
                {formData.password && (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Password Strength
                      </Typography>
                      {passwordStrength.label && (
                        <Chip
                          label={passwordStrength.label}
                          size="small"
                          sx={{
                            backgroundColor: passwordStrength.color,
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(passwordStrength.score / 5) * 100}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: passwordStrength.color,
                          borderRadius: 3,
                        },
                      }}
                    />
                    <List dense sx={{ mt: 1 }}>
                      {Object.entries(passwordStrength.checks).map(([key, passed]) => (
                        <ListItem key={key} sx={{ py: 0, px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            {passed ? (
                              <CheckCircle sx={{ fontSize: 16, color: '#4caf50' }} />
                            ) : (
                              <Cancel sx={{ fontSize: 16, color: '#f44336' }} />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              key === 'length'
                                ? 'At least 8 characters'
                                : key === 'uppercase'
                                ? 'Uppercase letter'
                                : key === 'lowercase'
                                ? 'Lowercase letter'
                                : key === 'number'
                                ? 'Number'
                                : 'Special character'
                            }
                            primaryTypographyProps={{
                              variant: 'caption',
                              color: passed ? 'success.main' : 'text.secondary',
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  error={!!confirmPasswordError}
                  helperText={confirmPasswordError}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      sx={{
                        color: '#14b8a6',
                        '&.Mui-checked': {
                          color: '#14b8a6',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary">
                      I agree to the{' '}
                      <Link href="#" sx={{ color: '#14b8a6', textDecoration: 'none' }}>
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="#" sx={{ color: '#14b8a6', textDecoration: 'none' }}>
                        Privacy Policy
                      </Link>
                    </Typography>
                  }
                />
              </Grid>
            </Grid>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading || !!emailError || !!passwordError || !!confirmPasswordError || !agreedToTerms}
              sx={{
                mt: 4,
                mb: 2,
                py: 1.8,
                fontSize: '1.1rem',
                fontWeight: 700,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                boxShadow: '0 4px 20px rgba(20, 184, 166, 0.4)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 30px rgba(20, 184, 166, 0.6)',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%)',
                },
                '&:disabled': {
                  background: 'rgba(20, 184, 166, 0.5)',
                },
              }}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/login"
                  sx={{ 
                    fontWeight: 600, 
                    textDecoration: 'none',
                    color: '#14b8a6',
                    '&:hover': {
                      color: '#06b6d4',
                    },
                  }}
                >
                  Sign In
                </Link>
              </Typography>
            </Box>
          </form>
                </Paper>
              </Box>
            </Fade>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Register;
