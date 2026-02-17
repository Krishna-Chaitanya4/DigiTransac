// Transaction queries
export {
  useTransactions,
  useInfiniteTransactions,
  useTransactionSummary,
  useTransactionAnalytics,
  usePendingCount,
  useCounterparties,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useRestoreTransaction,
  useUpdateStatus,
  useBatchDelete,
  useBatchMarkConfirmed,
  useBatchMarkPending,
  usePrefetchTransactions,
  useInvalidateTransactions,
  // Extended analytics hooks
  useTopCounterparties,
  useSpendingByAccount,
  useSpendingPatterns,
  useSpendingAnomalies,
  useLocationInsights,
  useTripGroups,
} from './useTransactionQueries';

// Account queries
export {
  useAccounts,
  useAccountSummary,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useAdjustBalance,
  useSetDefaultAccount,
  useInvalidateAccounts,
  usePrefetchAccounts,
} from './useAccountQueries';

// Label queries
export {
  useLabels,
  useLabelsTree,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
  useDeleteLabelWithReassignment,
  useLabelTransactionCount,
  useInvalidateLabels,
  usePrefetchLabels,
} from './useLabelQueries';

// Tag queries
export {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useTagTransactionCount,
  useDeleteTagConfirmed,
  useInvalidateTags,
  usePrefetchTags,
} from './useTagQueries';

// Conversation queries
export {
  useConversations,
  useConversation,
  useSendMessage,
  useEditMessage,
  useDeleteMessage,
  useRestoreMessage,
  useMarkAsRead,
  useUserSearch,
  useInvalidateConversations,
  useOptimisticSendMessage,
  conversationKeys,
} from './useConversationQueries';

// Budget queries
export {
  useBudgets,
  useBudget,
  useBudgetBreakdown,
  useBudgetNotifications,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useInvalidateBudgets,
} from './useBudgetQueries';

// Other hooks
export { useBulkSelection } from './useBulkSelection';
export { useFocusTrap } from './useFocusTrap';
export { useInfiniteScroll } from './useInfiniteScroll';
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export { useTransactionFilters } from './useTransactionFilters';
export {
  useOnlineStatus,
  useOnlineStatusExtended,
  useOfflineQueue,
  useOfflineLocations,
  useOfflineMessages,
  cacheLocations,
  getCachedLocations,
  clearOldCachedLocations,
  cacheMessages,
  getCachedMessages,
} from './useOffline';
export type { CachedLocation, CachedMessage, OfflineAction } from './useOffline';
export { useModalState, useDeleteModalState } from './useModalState';
export { usePullToRefresh } from './usePullToRefresh';
export { useSwipeGesture } from './useSwipeGesture';
export { usePinchZoom } from './usePinchZoom';

// Re-export query keys for external use
export { queryKeys } from '../lib/queryClient';
