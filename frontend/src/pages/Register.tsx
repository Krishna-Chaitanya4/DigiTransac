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
  FormControlLabel,
  Checkbox,
  Tab,
  Tabs,
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
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { detectCurrency, availableCurrencies } from '../utils/currencyDetection';
import { detectCountry } from '../utils/countryDetection';

// Helper function to get country calling code
const getCountryCallingCode = (countryCode: string): string => {
  const codes: Record<string, string> = {
    'IN': '91', 'US': '1', 'GB': '44', 'CA': '1', 'AU': '61',
    'JP': '81', 'CN': '86', 'SG': '65', 'MY': '60', 'PH': '63',
    'TH': '66', 'ID': '62', 'VN': '84', 'KR': '82', 'HK': '852',
    'TW': '886', 'BR': '55', 'MX': '52', 'ZA': '27', 'SA': '966',
    'AE': '971', 'TR': '90', 'RU': '7', 'PL': '48', 'NG': '234',
    'KE': '254', 'AR': '54', 'CL': '56', 'CO': '57', 'NZ': '64',
    'IL': '972', 'CH': '41', 'DE': '49', 'FR': '33', 'ES': '34',
    'IT': '39', 'NL': '31', 'PT': '351', 'BE': '32', 'AT': '43',
    'IE': '353', 'FI': '358', 'GR': '30',
  };
  return codes[countryCode] || '1';
};

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email');
  const [formData, setFormData] = useState({
    email: '',
    phone: `+${getCountryCallingCode(detectCountry())} `, // Auto-fill country code
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    currency: detectCurrency(), // Auto-detect currency
  });
  const [dateOfBirth, setDateOfBirth] = useState<Dayjs | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [usernameError, setUsernameError] = useState('');
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

  const validatePhone = (phone: string): boolean => {
    // E.164 format: +[country code][number]
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  };

  const validateUsername = (username: string): boolean => {
    // 3-30 characters, lowercase letters, numbers, dots, underscores
    const usernameRegex = /^[a-z0-9._]{3,30}$/;
    return usernameRegex.test(username);
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

    // Real-time phone validation
    if (name === 'phone') {
      if (value && !validatePhone(value)) {
        setPhoneError('Please enter a valid phone number with country code (e.g., +1234567890)');
      } else {
        setPhoneError('');
      }
    }

    // Real-time username validation
    if (name === 'username') {
      const lowerValue = value.toLowerCase();
      setFormData({ ...formData, [name]: lowerValue }); // Force lowercase
      if (value && !validateUsername(lowerValue)) {
        setUsernameError('Username must be 3-30 characters, lowercase letters, numbers, . or _');
      } else {
        setUsernameError('');
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

    // Validate contact method (email or phone)
    if (contactMethod === 'email') {
      if (!formData.email || !validateEmail(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }
    } else {
      if (!formData.phone || !validatePhone(formData.phone)) {
        setError('Please enter a valid phone number with country code');
        return;
      }
    }

    // Validate username
    if (!formData.username || !validateUsername(formData.username)) {
      setError('Please enter a valid username (3-30 characters, lowercase, numbers, . or _)');
      return;
    }

    // Validate full name
    if (!formData.fullName || formData.fullName.trim().length < 1) {
      setError('Please enter your full name');
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
      const registerData: any = {
        username: formData.username,
        fullName: formData.fullName,
        password: formData.password,
        currency: formData.currency,
      };

      // Add email or phone based on contact method
      if (contactMethod === 'email') {
        registerData.email = formData.email;
      } else {
        // Remove spaces and hyphens from phone number before sending
        registerData.phone = formData.phone.replace(/[\s-]/g, '');
      }

      // Add optional date of birth
      if (dateOfBirth) {
        registerData.dateOfBirth = dateOfBirth.format('YYYY-MM-DD');
      }

      await register(registerData);
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
        background: (theme) => theme.palette.primary.main,
        py: { xs: 3, sm: 4 },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: (theme) => `
            radial-gradient(circle at 0% 0%, ${theme.palette.primary.main}4D 0%, transparent 50%),
            radial-gradient(circle at 100% 0%, ${theme.palette.primary.light}4D 0%, transparent 50%),
            radial-gradient(circle at 100% 100%, ${theme.palette.primary.dark}4D 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, ${theme.palette.primary.dark}4D 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, ${theme.palette.primary.main}33 0%, transparent 50%)
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
          background: (theme) => `radial-gradient(circle, ${theme.palette.primary.main}26 0%, transparent 70%)`,
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
          background: (theme) => `radial-gradient(circle, ${theme.palette.primary.light}26 0%, transparent 70%)`,
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
          background: (theme) => `radial-gradient(circle, ${theme.palette.primary.dark}1F 0%, transparent 70%)`,
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
          <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
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
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
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
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
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
              {/* Contact Method Tabs */}
              <Grid item xs={12}>
                <Tabs
                  value={contactMethod}
                  onChange={(_, newValue) => setContactMethod(newValue)}
                  variant="fullWidth"
                  sx={{
                    mb: 1,
                    '& .MuiTab-root': {
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                    },
                  }}
                >
                  <Tab
                    value="email"
                    label="Email"
                    icon={<EmailIcon />}
                    iconPosition="start"
                  />
                  <Tab
                    value="phone"
                    label="Phone"
                    icon={<PhoneIcon />}
                    iconPosition="start"
                  />
                </Tabs>
              </Grid>

              {/* Email or Phone Field */}
              {contactMethod === 'email' ? (
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
                    autoFocus
                    error={!!emailError}
                    helperText={emailError}
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
              ) : (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, phone: value });
                      if (value && !validatePhone(value)) {
                        setPhoneError('Please enter a valid phone number with country code');
                      } else {
                        setPhoneError('');
                      }
                    }}
                    required
                    autoFocus
                    placeholder="9876543210"
                    error={!!phoneError}
                    helperText={phoneError}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon />
                        </InputAdornment>
                      ),
                    }}
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
              )}

              {/* Username */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  error={!!usernameError}
                  helperText={usernameError || 'Lowercase, 3-30 characters, letters, numbers, . or _'}
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

              {/* Full Name */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Full Name"
                  name="fullName"
                  value={formData.fullName}
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

              {/* Date of Birth (Optional) */}
              <Grid item xs={12}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Date of Birth"
                    value={dateOfBirth}
                    onChange={(newValue) => setDateOfBirth(newValue)}
                    format="DD/MM/YYYY"
                    maxDate={dayjs()}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: {
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            },
                            '&.Mui-focused': {
                              transform: 'translateY(-2px)',
                              boxShadow: (theme) => `0 4px 12px ${theme.palette.primary.main}40`,
                            },
                          },
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              {/* Currency */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                >
                  {availableCurrencies.map((currency) => (
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
                        color: 'primary.main',
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary">
                      I agree to the{' '}
                      <Link href="#" sx={{ color: 'primary.main', textDecoration: 'none' }}>
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="#" sx={{ color: 'primary.main', textDecoration: 'none' }}>
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
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                boxShadow: (theme) => `0 4px 20px ${theme.palette.primary.main}66`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: (theme) => `0 8px 30px ${theme.palette.primary.main}99`,
                  background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                },
                '&:disabled': {
                  background: (theme) => theme.palette.primary.main,
                  opacity: 0.5,
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
                    color: 'primary.main',
                    '&:hover': {
                      color: 'primary.light',
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
