import React, { Component, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Container } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Route-level Error Boundary
 * ✅ Catches errors at route level without breaking entire app
 * ✅ User-friendly error UI with recovery options
 * ✅ Logs errors for debugging
 * ✅ Industry standard: Per-route error isolation
 */
class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console for development
    console.error('Route Error Boundary caught an error:', error, errorInfo);

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 */
const ErrorFallback: React.FC<{ error: Error | null; onReset: () => void }> = ({
  error,
  onReset,
}) => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          textAlign: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 2,
            maxWidth: 600,
            width: '100%',
          }}
        >
          <ErrorIcon
            sx={{
              fontSize: 80,
              color: 'error.main',
              mb: 2,
            }}
          />

          <Typography variant="h4" gutterBottom fontWeight="bold">
            Oops! Something went wrong
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            We encountered an unexpected error. Don&apos;t worry, your data is safe.
          </Typography>

          {error && import.meta.env.DEV && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 3,
                textAlign: 'left',
                bgcolor: 'grey.50',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              <Typography
                variant="caption"
                component="pre"
                sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
              >
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </Typography>
            </Paper>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={onReset} size="large">
              Try Again
            </Button>

            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => navigate('/dashboard')}
              size="large"
            >
              Go to Dashboard
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            If this problem persists, please contact support
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default RouteErrorBoundary;
