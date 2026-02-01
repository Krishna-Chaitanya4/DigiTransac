import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { logger } from '../services/logger';
import TwoFactorSettings from '../components/TwoFactorSettings';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  getSupportedCurrencies,
  getCurrencyPreference,
  updateCurrencyPreference,
  getCurrencySymbol,
  Currency
} from '../services/currencyService';
import { invalidateCurrencyDependentQueries } from '../lib/queryClient';

export default function SettingsPage() {
  const { user, logoutAll, deleteAccount, updateName, updatePrimaryCurrency, sendEmailChangeCode, verifyEmailChange } = useAuth();
  const { theme, setTheme } = useTheme();
  
  // Currency preference state
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [primaryCurrency, setPrimaryCurrency] = useState<string>('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isCurrencyLoading, setIsCurrencyLoading] = useState(true);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);
  const [currencyError, setCurrencyError] = useState('');
  const [highlightedCurrencyIndex, setHighlightedCurrencyIndex] = useState(-1);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  
  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.fullName || '');
  const [nameError, setNameError] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  
  // Email change modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState<'enter' | 'verify'>('enter');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  
  // Focus trap refs for modals
  const deleteModalRef = useFocusTrap<HTMLDivElement>(showDeleteModal);
  const emailModalRef = useFocusTrap<HTMLDivElement>(showEmailModal);

  // Load currency data on mount
  useEffect(() => {
    async function loadCurrencyData() {
      try {
        const [currencyList, preference] = await Promise.all([
          getSupportedCurrencies(),
          getCurrencyPreference()
        ]);
        setCurrencies(currencyList);
        setPrimaryCurrency(preference);
      } catch (err) {
        logger.error('Failed to load currency data:', err);
        setCurrencyError('Failed to load currency settings');
      } finally {
        setIsCurrencyLoading(false);
      }
    }
    loadCurrencyData();
  }, []);

  // Currency preference handlers
  const handleCurrencyChange = async (currency: string) => {
    if (currency === primaryCurrency) {
      setIsCurrencyDropdownOpen(false);
      setCurrencySearch('');
      return;
    }

    setIsSavingCurrency(true);
    setCurrencyError('');
    try {
      await updateCurrencyPreference(currency);
      setPrimaryCurrency(currency);
      updatePrimaryCurrency(currency); // Update AuthContext so CurrencyContext gets the new value
      // Invalidate all queries that depend on the primary currency
      // This ensures pages like Insights, Budgets, and Chats will refetch with converted amounts
      invalidateCurrencyDependentQueries();
      setIsCurrencyDropdownOpen(false);
      setCurrencySearch('');
    } catch (err) {
      setCurrencyError(err instanceof Error ? err.message : 'Failed to update currency');
    } finally {
      setIsSavingCurrency(false);
    }
  };

  const filteredCurrencies = currencies.filter(c =>
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const selectedCurrency = currencies.find(c => c.code === primaryCurrency);

  // Reset highlighted index when search changes or dropdown closes
  useEffect(() => {
    setHighlightedCurrencyIndex(-1);
  }, [currencySearch, isCurrencyDropdownOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedCurrencyIndex >= 0 && currencyDropdownRef.current) {
      const items = currencyDropdownRef.current.querySelectorAll('button');
      if (items[highlightedCurrencyIndex]) {
        items[highlightedCurrencyIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedCurrencyIndex]);

  const handleCurrencyKeyDown = (e: React.KeyboardEvent) => {
    if (!isCurrencyDropdownOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedCurrencyIndex(prev => 
          prev < filteredCurrencies.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedCurrencyIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedCurrencyIndex >= 0 && highlightedCurrencyIndex < filteredCurrencies.length) {
          handleCurrencyChange(filteredCurrencies[highlightedCurrencyIndex].code);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsCurrencyDropdownOpen(false);
        setCurrencySearch('');
        break;
    }
  };

  // Name editing handlers
  const handleEditName = () => {
    setEditedName(user?.fullName || '');
    setNameError('');
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName(user?.fullName || '');
    setNameError('');
  };

  const handleSaveName = async () => {
    const trimmedName = editedName.trim();
    if (!trimmedName) {
      setNameError('Name is required');
      return;
    }
    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    if (trimmedName === user?.fullName) {
      setIsEditingName(false);
      return;
    }

    setNameError('');
    setIsSavingName(true);
    try {
      await updateName(trimmedName);
      setIsEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  // Email change handlers
  const handleOpenEmailModal = () => {
    setNewEmail('');
    setEmailCode('');
    setEmailError('');
    setEmailStep('enter');
    setShowEmailModal(true);
  };

  const handleCloseEmailModal = () => {
    setShowEmailModal(false);
    setNewEmail('');
    setEmailCode('');
    setEmailError('');
    setEmailStep('enter');
  };

  const handleSendEmailCode = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setEmailError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (trimmedEmail === user?.email) {
      setEmailError('New email must be different from current email');
      return;
    }

    setEmailError('');
    setIsEmailLoading(true);
    try {
      await sendEmailChangeCode(trimmedEmail);
      setEmailStep('verify');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    const trimmedCode = emailCode.trim();
    if (!trimmedCode) {
      setEmailError('Verification code is required');
      return;
    }
    if (trimmedCode.length !== 6) {
      setEmailError('Code must be 6 digits');
      return;
    }

    setEmailError('');
    setIsEmailLoading(true);
    try {
      await verifyEmailChange(newEmail.trim().toLowerCase(), trimmedCode);
      handleCloseEmailModal();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    await logoutAll();
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm');
      return;
    }

    setDeleteError('');
    setIsDeleting(true);

    try {
      await deleteAccount(deletePassword);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>
      
      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Profile</h2>
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Full Name</label>
              {isEditingName ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your full name"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveName}
                      disabled={isSavingName}
                      className="px-3 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 disabled:opacity-50"
                    >
                      {isSavingName ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEditName}
                      disabled={isSavingName}
                      className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-900 dark:text-gray-100">{user?.fullName}</p>
                  <button
                    onClick={handleEditName}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    Edit
                  </button>
                </div>
              )}
              {nameError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>
              )}
            </div>
            
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-900 dark:text-gray-100">{user?.email}</p>
                <button
                  onClick={handleOpenEmailModal}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Preferences</h2>
          <div className="space-y-4">
            {/* Primary Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Primary Currency</label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Your primary currency for displaying net worth and totals</p>
              {isCurrencyLoading ? (
                <div className="animate-pulse h-10 bg-gray-100 rounded-lg"></div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                    disabled={isSavingCurrency}
                    className="w-full sm:w-64 flex items-center justify-between px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{getCurrencySymbol(primaryCurrency)}</span>
                      <span>{selectedCurrency?.name || primaryCurrency}</span>
                      <span className="text-gray-400">({primaryCurrency})</span>
                    </span>
                    <svg className={`h-4 w-4 text-gray-400 transition-transform ${isCurrencyDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isCurrencyDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full sm:w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          type="text"
                          value={currencySearch}
                          onChange={(e) => setCurrencySearch(e.target.value)}
                          onKeyDown={handleCurrencyKeyDown}
                          placeholder="Search currencies..."
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                      <div ref={currencyDropdownRef} className="max-h-60 overflow-y-auto">
                        {filteredCurrencies.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-gray-500">No currencies found</p>
                        ) : (
                          filteredCurrencies.map((currency, index) => (
                            <button
                              key={currency.code}
                              type="button"
                              onClick={() => handleCurrencyChange(currency.code)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                                currency.code === primaryCurrency ? 'bg-blue-50 text-blue-700' : ''
                              } ${index === highlightedCurrencyIndex ? 'bg-gray-100' : ''}`}
                            >
                              <span className="text-lg w-6">{currency.symbol}</span>
                              <span className="flex-1">{currency.name}</span>
                              <span className="text-gray-400">{currency.code}</span>
                              {currency.code === primaryCurrency && (
                                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {currencyError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{currencyError}</p>
              )}
              {isSavingCurrency && (
                <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">Saving...</p>
              )}
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Appearance</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Theme</label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Choose how DigiTransac looks to you</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                    theme === 'light'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                  </svg>
                  <span className="font-medium">Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                  </svg>
                  <span className="font-medium">Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                    theme === 'system'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
                  </svg>
                  <span className="font-medium">System</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Security</h2>
          
          {/* Two-Factor Authentication */}
          <TwoFactorSettings />
          
          <hr className="my-4 border-gray-200 dark:border-gray-700" />
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sign out from all devices</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">This will sign you out everywhere including this device</p>
            </div>
            <button
              onClick={handleLogoutAll}
              disabled={isLoggingOutAll}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {isLoggingOutAll ? 'Signing out...' : 'Sign out everywhere'}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900 p-6">
          <h2 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">Danger Zone</h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Delete Account</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Permanently delete your account and all data</p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          {/* Backdrop - semi-transparent */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowDeleteModal(false);
              setDeletePassword('');
              setDeleteError('');
            }}
            aria-hidden="true"
          />
          
          {/* Modal */}
          <div 
            ref={deleteModalRef}
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setShowDeleteModal(false);
                setDeletePassword('');
                setDeleteError('');
              }
            }}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 id="delete-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Delete Account
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    This action cannot be undone. All your data will be permanently deleted.
                  </p>
                </div>
              </div>
              
              <div className="mt-5">
                <label htmlFor="delete-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Enter your password to confirm
                </label>
                <div className="relative">
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    id="delete-password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Your password"
                    aria-describedby={deleteError ? 'delete-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                    aria-label={showDeletePassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showDeletePassword}
                  >
                    {showDeletePassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
                {deleteError && (
                  <p id="delete-error" className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{deleteError}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Email Modal */}
      {showEmailModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-modal-title"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseEmailModal}
            aria-hidden="true"
          />
          
          {/* Modal */}
          <div 
            ref={emailModalRef}
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCloseEmailModal();
              }
            }}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 id="email-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {emailStep === 'enter' ? 'Change Email' : 'Verify Email'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {emailStep === 'enter' 
                      ? 'Enter your new email address. We will send a verification code to confirm.'
                      : `We sent a 6-digit code to ${newEmail}. Enter it below to complete the change.`
                    }
                  </p>
                </div>
              </div>
              
              <div className="mt-5">
                {emailStep === 'enter' ? (
                  <>
                    <label htmlFor="new-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      New Email Address
                    </label>
                    <input
                      type="email"
                      id="new-email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="new@example.com"
                      autoFocus
                      aria-describedby={emailError ? 'email-error' : undefined}
                    />
                  </>
                ) : (
                  <>
                    <label htmlFor="email-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      id="email-code"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center tracking-widest font-mono text-lg"
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                      aria-describedby={emailError ? 'email-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEmailStep('enter');
                        setEmailCode('');
                        setEmailError('');
                      }}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      ← Use a different email
                    </button>
                  </>
                )}
                {emailError && (
                  <p id="email-error" className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{emailError}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-xl border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCloseEmailModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={emailStep === 'enter' ? handleSendEmailCode : handleVerifyEmailChange}
                disabled={isEmailLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 disabled:opacity-50"
              >
                {isEmailLoading 
                  ? (emailStep === 'enter' ? 'Sending...' : 'Verifying...') 
                  : (emailStep === 'enter' ? 'Send Code' : 'Verify & Update')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
