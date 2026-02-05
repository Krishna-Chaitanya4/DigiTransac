import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import { DarkModeToggle } from '../components/DarkModeToggle';
import * as authService from '../services/authService';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 2FA state
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  
  // Email OTP backup state
  const [useEmailOtp, setUseEmailOtp] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpMessage, setEmailOtpMessage] = useState('');
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  
  const { login, verifyTwoFactorLogin, verifyTwoFactorEmailOtp, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const navigate = useNavigate();

  // Show session expired message if present
  useEffect(() => {
    if (sessionExpiredMessage) {
      setError(sessionExpiredMessage);
      clearSessionExpiredMessage();
    }
  }, [sessionExpiredMessage, clearSessionExpiredMessage]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      
      if (result.requiresTwoFactor && result.twoFactorToken) {
        setRequiresTwoFactor(true);
        setTwoFactorToken(result.twoFactorToken);
        setIsSubmitting(false);
        return;
      }
      
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTwoFactorSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await verifyTwoFactorLogin(twoFactorToken, twoFactorCode);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmailOtp = async () => {
    setError('');
    setEmailOtpMessage('');
    setIsSendingEmailOtp(true);

    try {
      const result = await authService.sendTwoFactorEmailOtp(twoFactorToken);
      setEmailOtpSent(true);
      setEmailOtpMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email code');
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const handleEmailOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await verifyTwoFactorEmailOtp(twoFactorToken, emailOtpCode);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToEmailOtp = () => {
    setUseEmailOtp(true);
    setError('');
    setTwoFactorCode('');
  };

  const handleSwitchToAuthenticator = () => {
    setUseEmailOtp(false);
    setError('');
    setEmailOtpCode('');
    setEmailOtpSent(false);
    setEmailOtpMessage('');
  };

  const handleBackToLogin = () => {
    setRequiresTwoFactor(false);
    setTwoFactorToken('');
    setTwoFactorCode('');
    setUseEmailOtp(false);
    setEmailOtpCode('');
    setEmailOtpSent(false);
    setEmailOtpMessage('');
    setPassword('');
    setError('');
  };

  // 2FA verification screen
  if (requiresTwoFactor) {
    // Email OTP screen
    if (useEmailOtp) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative">
          <div className="absolute top-4 right-4">
            <DarkModeToggle size="sm" />
          </div>
          <div className="max-w-md w-full space-y-8">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                Email Verification
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                {emailOtpSent 
                  ? 'Enter the 6-digit code sent to your email'
                  : "We'll send a verification code to your registered email"
                }
              </p>
            </div>

            {!emailOtpSent ? (
              <div className="mt-8 space-y-6">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-sm relative">
                    {error}
                  </div>
                )}
                
                <button
                  onClick={handleSendEmailOtp}
                  disabled={isSendingEmailOtp}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingEmailOtp ? 'Sending...' : 'Send code to my email'}
                </button>
                
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleSwitchToAuthenticator}
                    className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Use authenticator app instead
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Back to login
                  </button>
                </div>
              </div>
            ) : (
              <form className="mt-8 space-y-6" onSubmit={handleEmailOtpSubmit}>
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-sm relative">
                    {error}
                  </div>
                )}
                
                {emailOtpMessage && (
                  <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded-sm relative">
                    {emailOtpMessage}
                  </div>
                )}

                <div>
                  <label htmlFor="emailOtpCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Code
                  </label>
                  <input
                    id="emailOtpCode"
                    name="emailOtpCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-md focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center text-2xl tracking-widest"
                    placeholder="000000"
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={isSubmitting || emailOtpCode.length !== 6}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={isSendingEmailOtp}
                    className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                  >
                    {isSendingEmailOtp ? 'Sending...' : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Back to login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      );
    }

    // Authenticator app screen
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute top-4 right-4">
          <DarkModeToggle size="sm" />
        </div>
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
              Two-Factor Authentication
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleTwoFactorSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-sm relative">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Verification Code
              </label>
              <input
                id="twoFactorCode"
                name="twoFactorCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                required
                autoFocus
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-md focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center text-2xl tracking-widest"
                placeholder="000000"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting || twoFactorCode.length !== 6}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Verifying...' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={handleSwitchToEmailOtp}
                className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Email me a code instead
              </button>
              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Back to login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <DarkModeToggle size="sm" />
      </div>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Sign in to DigiTransac
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              create a new account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-sm relative">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-md focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <PasswordInput
              id="password"
              name="password"
              value={password}
              onChange={setPassword}
              placeholder="Password"
              autoComplete="current-password"
              required
              label="Password"
            />
          </div>

          <div className="flex items-center justify-end">
            <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Forgot your password?
            </Link>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
