import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as authService from '../services/authService';

export default function TwoFactorSettings() {
  const { getValidAccessToken } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Setup modal state
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupData, setSetupData] = useState<authService.TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  
  // Disable modal state
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  // Load 2FA status on mount
  useEffect(() => {
    async function load2FAStatus() {
      try {
        const token = await getValidAccessToken();
        if (!token) return;
        
        const status = await authService.getTwoFactorStatus(token);
        setIs2FAEnabled(status.enabled);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load 2FA status');
      } finally {
        setIsLoading(false);
      }
    }
    
    load2FAStatus();
  }, [getValidAccessToken]);

  const handleStartSetup = async () => {
    setError('');
    setSuccess('');
    setIsSettingUp(true);
    
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      const setup = await authService.setupTwoFactor(token);
      setSetupData(setup);
      setShowSetupModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start 2FA setup');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleEnable2FA = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    
    setError('');
    setIsEnabling(true);
    
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      await authService.enableTwoFactor(token, verificationCode);
      setIs2FAEnabled(true);
      setShowSetupModal(false);
      setSetupData(null);
      setVerificationCode('');
      setSuccess('Two-factor authentication has been enabled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable 2FA');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleCloseSetupModal = () => {
    setShowSetupModal(false);
    setSetupData(null);
    setVerificationCode('');
    setError('');
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setError('Password is required');
      return;
    }
    
    setError('');
    setIsDisabling(true);
    
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      await authService.disableTwoFactor(token, disablePassword);
      setIs2FAEnabled(false);
      setShowDisableModal(false);
      setDisablePassword('');
      setSuccess('Two-factor authentication has been disabled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setIsDisabling(false);
    }
  };

  const handleCloseDisableModal = () => {
    setShowDisableModal(false);
    setDisablePassword('');
    setError('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-400"></div>
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <>
      {/* Success/Error messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess('')} className="text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {error && !showSetupModal && !showDisableModal && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 2FA Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Two-Factor Authentication</p>
            {is2FAEnabled && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400">
                Enabled
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {is2FAEnabled 
              ? 'Your account is protected with an authenticator app'
              : 'Add an extra layer of security using an authenticator app'}
          </p>
        </div>
        {is2FAEnabled ? (
          <button
            onClick={() => setShowDisableModal(true)}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Disable
          </button>
        ) : (
          <button
            onClick={handleStartSetup}
            disabled={isSettingUp}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-indigo-900 dark:to-indigo-950 rounded-lg hover:from-indigo-700 hover:to-indigo-800 dark:hover:from-indigo-800 dark:hover:to-indigo-900 disabled:opacity-50"
          >
            {isSettingUp ? 'Setting up...' : 'Enable'}
          </button>
        )}
      </div>

      {/* Setup Modal */}
      {showSetupModal && setupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={handleCloseSetupModal} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Set Up Two-Factor Authentication</h3>
              
              <div className="space-y-4">
                {/* Step 1: Scan QR */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Scan this QR code with your authenticator app</p>
                  <div className="flex justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUri)}`}
                      alt="2FA QR Code"
                      className="w-48 h-48"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Manual entry key */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Or enter this key manually:</p>
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg font-mono text-sm text-center break-all select-all text-gray-900 dark:text-gray-100">
                    {setupData.manualEntryKey}
                  </div>
                </div>

                {/* Step 2: Enter code */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Enter the 6-digit code from your app</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCloseSetupModal}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEnable2FA}
                    disabled={isEnabling || verificationCode.length !== 6}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-indigo-900 dark:to-indigo-950 rounded-lg hover:from-indigo-700 hover:to-indigo-800 dark:hover:from-indigo-800 dark:hover:to-indigo-900 disabled:opacity-50"
                  >
                    {isEnabling ? 'Verifying...' : 'Enable 2FA'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={handleCloseDisableModal} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Disable Two-Factor Authentication</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                This will make your account less secure. Enter your password to confirm.
              </p>
              
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showDisablePassword ? 'text' : 'password'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg pr-10 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter your password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowDisablePassword(!showDisablePassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showDisablePassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleCloseDisableModal}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisable2FA}
                    disabled={isDisabling || !disablePassword}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDisabling ? 'Disabling...' : 'Disable 2FA'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
