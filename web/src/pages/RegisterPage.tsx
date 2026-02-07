import { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logger } from '../services/logger';
import { useAuth } from '../context/AuthContext';
import { DarkModeToggle } from '../components/DarkModeToggle';
import * as authService from '../services/authService';
import PasswordInput from '../components/PasswordInput';
import {
  detectCurrencyFromLocation,
  checkLocationPermission,
  isGeolocationSupported,
  DetectionFailureReason,
} from '../services/locationService';
import { 
  getSupportedCurrencies, 
  getCurrencySymbol,
  Currency,
  COMMON_CURRENCIES 
} from '../services/currencyService';

type Step = 'email' | 'verify' | 'complete';

type LocationStatus = 'idle' | 'requesting' | 'detected' | 'failed' | 'manual';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Currency & Location state
  const [primaryCurrency, setPrimaryCurrency] = useState('');
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationFailureReason, setLocationFailureReason] = useState<DetectionFailureReason | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencySearch, setCurrencySearch] = useState('');
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  
  const { completeRegistration } = useAuth();
  const navigate = useNavigate();
  
  // Ref to prevent double detection
  const locationDetectionStarted = useRef(false);

  // Load currencies on mount
  useEffect(() => {
    getSupportedCurrencies()
      .then(setCurrencies)
      .catch((err) => logger.error('Failed to load currencies:', err));
  }, []);

  // Request location function wrapped in useCallback
  const requestLocation = useCallback(async () => {
    // Prevent running twice
    if (locationDetectionStarted.current) {
      return;
    }
    locationDetectionStarted.current = true;
    
    if (!isGeolocationSupported()) {
      setLocationStatus('manual');
      setLocationFailureReason('geolocation_not_supported');
      setPrimaryCurrency('USD');
      return;
    }

    // Check if already denied
    const permission = await checkLocationPermission();
    
    if (permission === 'denied') {
      setLocationStatus('failed');
      setLocationFailureReason('permission_denied');
      setPrimaryCurrency('USD');
      return;
    }

    setLocationStatus('requesting');
    
    const result = await detectCurrencyFromLocation();
    
    if (result.detected) {
      setPrimaryCurrency(result.currency);
      setDetectedCountry(result.country);
      setLocationStatus('detected');
      setLocationFailureReason(null);
    } else {
      setLocationStatus('failed');
      setLocationFailureReason(result.failureReason || 'unknown_error');
      setPrimaryCurrency('USD');
    }
  }, []);

  // Request location when entering step 3
  useEffect(() => {
    if (step === 'complete' && locationStatus === 'idle') {
      requestLocation();
    }
  }, [step, locationStatus, requestLocation]);

  // Step 1: Send verification code
  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await authService.sendVerificationCode(email);
      setMessage(response.message);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify code
  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await authService.verifyCode(email, code);
      if (response.verificationToken) {
        setVerificationToken(response.verificationToken);
        setMessage(response.message);
        setStep('complete');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password validation helper
  const validatePassword = (pwd: string): { isValid: boolean; message: string } => {
    if (pwd.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(pwd)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(pwd)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(pwd)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    if (!/[^A-Za-z0-9]/.test(pwd)) {
      return { isValid: false, message: 'Password must contain at least one special character' };
    }
    return { isValid: true, message: '' };
  };

  // Step 3: Complete registration
  const handleCompleteRegistration = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      await completeRegistration(email, verificationToken, password, fullName, primaryCurrency || undefined);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend code
  const handleResendCode = async () => {
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await authService.sendVerificationCode(email);
      setMessage('Verification code resent!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <DarkModeToggle size="sm" />
      </div>
      <div className="max-w-md w-full space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'email' ? 'bg-indigo-600 dark:bg-indigo-700 text-white' : 'bg-indigo-200 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'}`}>
            1
          </div>
          <div className={`w-12 h-1 ${step !== 'email' ? 'bg-indigo-600 dark:bg-indigo-700' : 'bg-gray-300 dark:bg-gray-700'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'verify' ? 'bg-indigo-600 dark:bg-indigo-700 text-white' : step === 'complete' ? 'bg-indigo-200 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            2
          </div>
          <div className={`w-12 h-1 ${step === 'complete' ? 'bg-indigo-600 dark:bg-indigo-700' : 'bg-gray-300 dark:bg-gray-700'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'complete' ? 'bg-indigo-600 dark:bg-indigo-700 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            3
          </div>
        </div>

        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            {step === 'email' && 'Create your account'}
            {step === 'verify' && 'Verify your email'}
            {step === 'complete' && 'Complete registration'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {step === 'email' && (
              <>
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Sign in
                </Link>
              </>
            )}
            {step === 'verify' && `We sent a code to ${email}`}
            {step === 'complete' && 'Set up your password'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-sm relative">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded-sm relative">
            {message}
          </div>
        )}

        {/* Step 1: Email input */}
        {step === 'email' && (
          <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
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
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending...' : 'Send verification code'}
            </button>
          </form>
        )}

        {/* Step 2: Verify code */}
        {step === 'verify' && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Verification code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-md focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center text-2xl tracking-widest"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Verifying...' : 'Verify code'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isSubmitting}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Didn't receive the code? Resend
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); setMessage(''); }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ← Use a different email
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Complete registration */}
        {step === 'complete' && (
          <form className="mt-8 space-y-6" onSubmit={handleCompleteRegistration}>
            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-md focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {/* Primary Currency Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Currency
                </label>
                
                {/* Location detection status */}
                {locationStatus === 'requesting' && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <svg className="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Detecting your location...
                  </div>
                )}
                
                {locationStatus === 'detected' && detectedCountry && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Detected: {detectedCountry}
                  </div>
                )}
                
                {locationStatus === 'failed' && (
                  <div className="mb-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                      {locationFailureReason === 'permission_denied'
                        ? '📍 Location access was denied'
                        : locationFailureReason === 'timeout'
                        ? '⏱️ Location detection timed out'
                        : locationFailureReason === 'position_unavailable'
                        ? '📍 Could not determine your location'
                        : locationFailureReason === 'reverse_geocode_failed'
                        ? '🌐 Could not identify your country'
                        : '⚠️ Location detection failed'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Select your preferred currency manually
                    </p>
                  </div>
                )}
                
                {locationStatus === 'manual' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Select your preferred currency for displaying totals
                  </p>
                )}

                {/* Currency dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                    disabled={locationStatus === 'requesting'}
                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      {primaryCurrency ? (
                        <>
                          <span className="text-lg">{getCurrencySymbol(primaryCurrency)}</span>
                          <span>{currencies.find(c => c.code === primaryCurrency)?.name || primaryCurrency}</span>
                          <span className="text-gray-400 dark:text-gray-500">({primaryCurrency})</span>
                        </>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Select currency...</span>
                      )}
                    </span>
                    <svg className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${isCurrencyDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isCurrencyDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                        <input
                          type="text"
                          value={currencySearch}
                          onChange={(e) => setCurrencySearch(e.target.value)}
                          placeholder="Search currencies..."
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {/* Common currencies first */}
                        {currencySearch === '' && (
                          <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900">Common Currencies</div>
                        )}
                        {currencies
                          .filter(c => 
                            currencySearch === '' 
                              ? COMMON_CURRENCIES.includes(c.code)
                              : c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                                c.name.toLowerCase().includes(currencySearch.toLowerCase())
                          )
                          .map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setPrimaryCurrency(c.code);
                                setIsCurrencyDropdownOpen(false);
                                setCurrencySearch('');
                                setLocationStatus('manual');
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                c.code === primaryCurrency ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100'
                              }`}
                            >
                              <span className="w-6">{c.symbol}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-gray-400 dark:text-gray-500">{c.code}</span>
                            </button>
                          ))
                        }
                        {currencySearch !== '' && currencies.filter(c => 
                          c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                          c.name.toLowerCase().includes(currencySearch.toLowerCase())
                        ).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No currencies found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <PasswordInput
                id="password"
                name="password"
                value={password}
                onChange={setPassword}
                placeholder="Strong password"
                autoComplete="new-password"
                required
                label="Password"
                hint="Min 8 chars, uppercase, lowercase, number, special character"
              />

              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
                label="Confirm password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
