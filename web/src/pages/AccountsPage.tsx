import { useState, useCallback, useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { PullToRefreshContainer } from '../components/PullToRefreshContainer';
import {
  useAccounts,
  useAccountSummary,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useAdjustBalance,
  useSetDefaultAccount,
  useInvalidateAccounts,
} from '../hooks';
import {
  AccountType,
  accountTypeConfig,
} from '../services/accountService';
import type {
  Account,
  CreateAccountRequest,
  UpdateAccountRequest,
} from '../services/accountService';
import { 
  formatCurrency as formatCurrencyWithCode, 
  refreshExchangeRates,
} from '../services/currencyService';
import {
  AccountModal,
  AccountCard,
  AdjustBalanceModal,
  DeleteConfirmModal,
  SummaryCard,
} from '../components/accounts';

export default function AccountsPage() {
  const { formatWithConversion, primaryCurrency: userPrimaryCurrency, refreshRates: refreshCurrencyContext } = useCurrency();
  
  // UI state
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // React Query hooks
  const { data: accounts = [], isLoading, error: queryError } = useAccounts(showArchived);
  const { data: summary } = useAccountSummary();
  const invalidateAccounts = useInvalidateAccounts();
  
  // Combined error display
  const displayError = queryError?.message || error;
  
  // Mutations
  const createAccountMutation = useCreateAccount();
  const updateAccountMutation = useUpdateAccount();
  const deleteAccountMutation = useDeleteAccount();
  const adjustBalanceMutation = useAdjustBalance();
  const setDefaultAccountMutation = useSetDefaultAccount();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  
  // Derived submitting state from mutations
  const isSubmitting = createAccountMutation.isPending || 
    updateAccountMutation.isPending || 
    deleteAccountMutation.isPending ||
    adjustBalanceMutation.isPending ||
    setDefaultAccountMutation.isPending;

  const handleRefreshRates = useCallback(async () => {
    try {
      await refreshExchangeRates();
      // Update CurrencyContext to use new rates
      await refreshCurrencyContext();
      // Invalidate account queries to refetch with new rates
      invalidateAccounts();
    } catch {
      setError('Failed to refresh exchange rates');
    }
  }, [refreshCurrencyContext, invalidateAccounts]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      Bank: [],
      CreditCard: [],
      Cash: [],
      DigitalWallet: [],
      Investment: [],
      Loan: [],
    };

    accounts.forEach((account) => {
      groups[account.type].push(account);
    });

    return groups;
  }, [accounts]);

  const handleCreate = () => {
    setEditingAccount(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleDelete = (account: Account) => {
    setDeletingAccount(account);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleAdjustBalance = (account: Account) => {
    setAdjustingAccount(account);
    setIsAdjustModalOpen(true);
  };

  const handleArchiveFromDeleteModal = async () => {
    if (!deletingAccount) return;
    
    try {
      await updateAccountMutation.mutateAsync({ id: deletingAccount.id, data: { isArchived: true } });
      setIsDeleteModalOpen(false);
      setDeletingAccount(null);
      setDeleteError(null);
    } catch {
      setError('Failed to archive account');
    }
  };

  const handleArchiveToggle = async (account: Account) => {
    try {
      await updateAccountMutation.mutateAsync({ id: account.id, data: { isArchived: !account.isArchived } });
    } catch {
      setError('Failed to update account');
    }
  };

  const handleSetDefault = async (account: Account) => {
    try {
      await setDefaultAccountMutation.mutateAsync(account.id);
    } catch {
      setError('Failed to set default account');
    }
  };

  const handleModalSubmit = async (data: CreateAccountRequest | UpdateAccountRequest) => {
    try {
      setModalError(null);
      if (editingAccount) {
        await updateAccountMutation.mutateAsync({ id: editingAccount.id, data: data as UpdateAccountRequest });
      } else {
        await createAccountMutation.mutateAsync(data as CreateAccountRequest);
      }
      setIsModalOpen(false);
      setModalError(null);
    } catch (err) {
      // Show error in the modal
      const message = err instanceof Error ? err.message : (editingAccount ? 'Failed to update account' : 'Failed to create account');
      setModalError(message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAccount) return;

    try {
      await deleteAccountMutation.mutateAsync(deletingAccount.id);
      setIsDeleteModalOpen(false);
      setDeletingAccount(null);
      setDeleteError(null);
    } catch (err) {
      // Show error in the modal instead of the global error
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      setDeleteError(message);
    }
  };

  const handleAdjustSubmit = async (newBalance: number, notes: string) => {
    if (!adjustingAccount) return;

    try {
      await adjustBalanceMutation.mutateAsync({ id: adjustingAccount.id, data: { newBalance, notes } });
      setIsAdjustModalOpen(false);
      setAdjustingAccount(null);
    } catch {
      setError('Failed to adjust balance');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <PullToRefreshContainer
      onRefresh={async () => {
        await invalidateAccounts();
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="hidden lg:block text-2xl font-bold text-gray-900 dark:text-gray-100">Accounts</h1>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Account
        </button>
      </div>

      {displayError && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {displayError}
          <button onClick={() => setError(null)} className="float-right font-bold">×</button>
        </div>
      )}

      {/* Summary Card */}
      {summary && accounts.length > 0 && <SummaryCard summary={summary} onRefreshRates={handleRefreshRates} />}

      {/* Show Archived Toggle */}
      {accounts.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="showArchived"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
          />
          <label htmlFor="showArchived" className="text-sm text-gray-600 dark:text-gray-400">
            Show archived accounts
          </label>
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Accounts Yet</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Add your bank accounts, credit cards, and other financial accounts to track your money.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Your First Account
          </button>
        </div>
      )}

      {/* Accounts grouped by type */}
      {accounts.length > 0 && (
        <div className="space-y-6">
          {(Object.keys(groupedAccounts) as AccountType[]).map((type) => {
            const typeAccounts = groupedAccounts[type];
            if (typeAccounts.length === 0) return null;

            const config = accountTypeConfig[type];
            // Use the converted total from summary (properly handles multi-currency)
            const typeTotal = summary?.balancesByType?.[type] ?? 0;

            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span>{config.icon}</span>
                    {config.label}s
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({typeAccounts.length})
                    </span>
                  </h2>
                  <span
                    className={`text-lg font-semibold ${
                      config.isLiability
                        ? typeTotal > 0
                          ? 'text-red-600 dark:text-red-400'    // Liability with debt = red
                          : 'text-green-600 dark:text-green-400' // Liability paid off = green
                        : typeTotal >= 0
                        ? 'text-green-600 dark:text-green-400'  // Asset with money = green
                        : 'text-red-600 dark:text-red-400'      // Asset overdraft = red
                    }`}
                  >
                    {/* For liabilities: negate the balance (positive debt → negative display, negative credit → positive display)
                        For assets: show as-is (negative for overdraft) */}
                    {formatCurrencyWithCode(
                      config.isLiability ? -typeTotal : typeTotal,
                      summary?.primaryCurrency || 'INR'
                    )}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {typeAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onEdit={() => handleEdit(account)}
                      onDelete={() => handleDelete(account)}
                      onAdjustBalance={() => handleAdjustBalance(account)}
                      onArchiveToggle={() => handleArchiveToggle(account)}
                      onSetDefault={() => handleSetDefault(account)}
                      formatWithConversion={formatWithConversion}
                      primaryCurrency={userPrimaryCurrency}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AccountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalError(null);
        }}
        onSubmit={handleModalSubmit}
        editingAccount={editingAccount}
        isLoading={isSubmitting}
        primaryCurrency={summary?.primaryCurrency || 'USD'}
        error={modalError}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingAccount(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        onArchive={handleArchiveFromDeleteModal}
        accountName={deletingAccount?.name || ''}
        isLoading={isSubmitting}
        errorMessage={deleteError}
      />

      <AdjustBalanceModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setAdjustingAccount(null);
        }}
        onSubmit={handleAdjustSubmit}
        account={adjustingAccount}
        isLoading={isSubmitting}
      />
    </PullToRefreshContainer>
  );
}
