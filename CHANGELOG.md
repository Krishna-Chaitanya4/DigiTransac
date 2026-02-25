# Changelog

All notable changes to DigiTransac will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.8.5] - 2026-02-25

### Fixed
- **Chat preview showing wrong message** — Always prefer `ChatMessage.CreatedAt` over `Transaction.Date` for conversation list preview (avoids timezone divergence where frontend noon-UTC fallback is later than actual server time)
- **Transaction preview wrong direction** — Resolve viewer's own transaction via `TransactionLinkId` so preview shows correct "Sent/Received" perspective
- **Duplicate chat bubbles** — Counterparty transaction now reuses the same `ChatMessageId` instead of creating a separate chat message
- **"Seen" indicator not working for transactions** — Send `NewChatMessage` SignalR notification alongside `P2PTransactionCreated` so the counterparty's mark-as-read flow triggers correctly; fix frontend race condition where `cancelQueries` in `useMarkAsRead.onSuccess` could abort the refetch before the message count bumped (optimistically append all message types now)
- **Transaction card alignment** — Use `isMine` instead of `isSent` for positioning (noter app semantics: all user-created transactions go right)
- **Optimistic delete preview** — Handle truncated message content (50 chars) when matching conversation list preview
- **Web push body** — Handle `"Transaction"` message type (was only checking legacy `"money"`)

### Changed
- **Pending transaction card colors** — Use same red/green gradient as confirmed; direction communicated via badge text ("⏳ Sent · Pending" / "⏳ Received · Pending")
- **"You: " prefix in conversation list** — Backend adds prefix when latest activity is from current user; frontend renders it in neutral gray and strips it for transaction color detection
- **Query invalidation** — Conversations now invalidated on `P2PTransactionRejected` and all transaction mutations
- **P2PTransactionCreated** — Optimistically updates conversation list preview on the counterparty's side

### Removed
- Unused `SystemMessageSources.P2P` constant
- Duplicate `CreateTransactionMessageAsync` call from `SendMoneyAsync`

## [1.8.4] - 2026-02-24

### Fixed
- **Message deletion preview** — Optimistic update for conversation list preview when deleting a message (updates both detail and list caches instantly)
- **Unread badge flash** — Hide unread count badge on currently-selected conversation to prevent momentary flash when new message arrives
- **Real-time message deletion** — Counterparty now sees message deletion in real-time via SignalR `MessageDeleted` notification (backend sends notification to recipient, frontend invalidates conversation caches)
- **Real-time message restore (undo)** — Counterparty now sees message restore in real-time via SignalR `MessageRestored` notification with optimistic UI updates on both sides

## [1.8.3] - 2026-02-24

### Fixed
- **Production SignalR connectivity** — Enabled sticky sessions on Azure Container Apps backend so SignalR negotiate and WebSocket connections are routed to the same replica

## [1.8.2] - 2026-02-24

### Fixed
- **Real-time messaging** — Fixed SignalR hub URL (strip `/api` suffix); moved global connection to Layout; added Vite `/hubs` proxy with WebSocket support; fixed React Strict Mode race conditions in connect/disconnect
- **Mobile header auto-hide** — Disabled scroll-based header hiding (always visible)

### Changed
- **Register page** — Updated name placeholder; added "try logging in" hint for existing accounts on verification step
- **Nginx CSP** — Updated `connect-src` to use `photon.komoot.io` (replaces `nominatim.openstreetmap.org`)

## [1.8.1] - 2026-02-23

### Changed
- **Location search: Nominatim → Photon** — Switched to Photon (Komoot) geocoding API for better POI/business search results with native lat/lon bias

### Fixed
- **iOS location permission re-prompting** — Cache location permission in localStorage for iOS Safari (which lacks `navigator.permissions` API); prevents repeated system permission dialogs
- **Transaction form horizontal scroll** — Added `overflow-x-hidden` to mobile form container to prevent horizontal scrolling

## [1.8.0] - 2026-02-23

### Added
- **Typeahead user search** — New Chat modal now searches by partial name or email with 300ms debounce (replaces exact-email-only search)
- **Backend user search endpoint** — `GET /conversations/search-users?query=` with regex partial match on email/name
- **Frequent Contacts sent/received breakdown** — Widget now shows ↑sent, ↓received, net amount, and activity percentage bar (matches Account Activity style)
- **Backend CounterpartySpending fields** — Added `TotalDebits`/`TotalCredits` to DTO; service now includes both Send and Receive transactions
- **Spending map transaction list** — All transactions with location shown below the map; sidebar locations clickable to filter
- **iOS PWA session persistence** — Survive Safari ITP localStorage purge (silent refresh from HttpOnly cookie); `pageshow` handler for bfcache resume
- **Settings name input keyboard shortcuts** — Enter to save, Escape to cancel

### Changed
- **Location search: Nominatim → Photon** — Switched to Photon (Komoot) geocoding API for better POI/business search results with native lat/lon bias
- **Labels: kebab menu** — Replaced 5 inline action icons with ⋮ dropdown menu (Exclude, Add sub-folder, Add category, Edit, Delete); row highlights when menu is open
- **Labels: removed color picker** — Charts now always use the default 10-color palette (prevents duplicate color confusion)
- **Chat: mobile layout** — Moved + button inline with search bar (removes empty header row); removed cumulative transaction totals from conversation list
- **Transactions: simplified date presets** — Reduced to This Month, Last Month, Custom (removed Today, This Week)
- **Transactions: filter badge** — Default "Confirmed" status no longer counts as an active filter
- **Transactions: mobile layout** — Export button moved inline with date presets; summary cards 2-col on mobile with Net full-width
- **Transactions: date preset style** — Gradient → solid `bg-blue-600` for consistency
- **Settings: removed Notifications section** — Push notifications not needed for a finance app
- **Settings: currency dropdown** — Replaced ~100 lines of duplicate inline code with reusable `CurrencyDropdown` component (also fixes outside-click bug)

### Fixed
- **Settings dark mode bugs** — Currency search input and delete-account password input had zero dark mode classes (invisible in dark mode)
- **Input consistency** — Normalized `rounded-lg`, `dark:bg-gray-700`, `focus:ring-2` across 7 components (RecurringSection, SplitCategoriesSection, CurrencyDropdown, SearchableCategoryDropdown, SearchableFolderDropdown, ContactPicker)
- **CalculatorInput migration** — AccountModal, AdjustBalanceModal, BudgetForm now use `CalculatorInput` instead of raw `<input type="number">`
- **CalculatorInput iOS keyboard** — `inputMode="decimal"` → `inputMode="text"` for full keyboard on iOS PWA
- **TransactionForm mobile overlap** — Time/timezone fields stack on mobile (`grid-cols-1 sm:grid-cols-2`)
- **Chat avatars** — Simplified gradients to solid colors across ConversationItem, ChatHeader, ChatHeaderEnhanced
- **Chat ₹ button** — Gradient → solid `bg-blue-500`
- **Self-chat unread badge** — Hidden (logically nonsensical)
- **Emoji picker** — Now supports typed/pasted emojis alongside dropdown picker
- **Integration tests** — Fixed SendVerification test (200 OK for email enumeration prevention), Login cookie test (SameSite=Lax for PWA)
- **Token refresh** — `doRefreshToken` now persists user data alongside access token (full session recovery)
- **Currency dropdown outside-click** — Settings page dropdown now closes when clicking outside

### Added (Feature Integration)
- **Keyboard shortcuts modal** — Integrated `KeyboardShortcutsModal` into Layout; press `?` or `Ctrl+/` to view all available shortcuts
- **Onboarding tour** — Integrated `OnboardingTour` into Layout; auto-shows for new users with step-by-step walkthrough (desktop & mobile variants, completion tracked via localStorage)
- **Tour target attributes** — Added `data-tour` attributes to sidebar nav and all navigation links for tour highlighting

### Fixed
- **Push subscription sync** — `pushsubscriptionchange` handler in service worker now fetches the VAPID key, re-subscribes, and syncs the new subscription to the server (previously a TODO that could silently break push notifications)
- **Production logging** — Replaced 13 `console.log`/`console.error` calls with the structured `logger` service in `useNotifications`, `BudgetsPage`, and `CurrencyDropdown` (prevents sensitive notification data from leaking to browser console)

### Changed (Duplicate Code Consolidation)

#### Frontend
- **Transaction filter params** — `getTransactionSummary` and `exportTransactions` now reuse `buildFilterQuery` instead of duplicating 20+ lines of filter param construction
- **Analytics date range params** — Created `buildDateRangeParams` helper; all 7 analytics functions now use it instead of repeating `URLSearchParams` construction
- **Transaction invalidation** — Extracted `invalidateTransactionRelatedQueries()` helper, replacing 9 duplicated 3-line invalidation blocks across mutation hooks
- **Conversation query keys** — Centralized conversation query keys into `queryKeys.conversations` (with `list`, `detail`, `userSearch`); removed local duplicate in `useConversationQueries`
- **Error message extraction** — Exported `getErrorMessage` from `queryClient.ts`; replaced 3 inline `error instanceof Error ? error.message : 'Unknown error'` patterns in push notification service
- **Duplicate interface** — Removed duplicate `CurrencyBalances` interface from `currencyService.ts` (only `accountService.ts` version is used)

#### Backend
- **User ID extraction** — Created `ClaimsPrincipalExtensions` with `GetUserId()` and `TryGetUserId()` extension methods; replaced 85 occurrences of the 4-line userId extraction pattern across 14 endpoint files

### Removed (Dead Code Cleanup)

#### Frontend (~2,950 lines removed)
- **Unused hooks** — Deleted `useLongPress`, `usePinchZoom`, `useSwipeGesture` (~200 lines)
- **Unused validation schemas** — Deleted entire `lib/validations/` directory (1,718 lines: accounts, auth, budgets, common, transactions + 5 test files)
- **Dead re-exports** — Removed backward-compat `getStoredAccessToken` re-exports from `apiClient.ts` and `authService.ts`
- **Dead Sentry exports** — Removed unused `captureMessage` function and `ErrorBoundary` re-export from `sentry.ts`
- **Dead analytics exports** — Made internal types/constants non-exported, removed unused `useAnalytics()` and `usePageTracking()` functions
- **Dead barrel exports** — Removed `ChatHeader`, `FloatingActionButton`, `PullToRefreshIndicator` from chat barrel; `useSwipeGesture`, `usePinchZoom` from hooks barrel; `PendingP2PIndicator` alias from PendingIndicator
- **Duplicate constant** — Replaced duplicate `ACCESS_TOKEN_KEY` in AuthContext with import from tokenStorage
- **Unused component** — Deleted top-level `TransactionTypeSelector` (35 lines)

#### Backend
- **Orphaned `Encryption:Key` config** — Removed from all 4 appsettings files, ConfigurationExtensions env var mapping/validation, both integration test factories, docker-compose, CI pipeline, `.env.example`, and DEPLOYMENT.md (EncryptionSettings only has `Kek`)
- **Commented-out code** — Removed V2 API versioning placeholder from ApiVersioning.cs

## [1.7.0] - 2026-02-21

### Security
- **Eliminate code injection** — Replaced `new Function()` in CalculatorInput with a safe recursive-descent math parser (supports +, -, *, /, parentheses)
- **Remove default secrets** — Docker Compose now uses `${VAR:?required}` fail-fast syntax for JWT_SECRET_KEY, ENCRYPTION_KEK
- **MongoDB binding** — Dev compose binds MongoDB to `127.0.0.1`; prod compose removes MongoDB/Redis port exposure entirely
- **CSP hardening** — Removed `'unsafe-eval'` from `script-src` in nginx Content-Security-Policy
- **Timing-safe OTP comparison** — Login OTP check uses `CryptographicOperations.FixedTimeEquals()` to prevent timing attacks
- **Email redaction in logs** — All auth logs now use truncated email prefixes or UserId instead of full email addresses
- **Redis password enforcement** — Production Redis now requires `--requirepass` with fail-fast env var
- **User enumeration prevention** — Registration endpoint returns generic success for existing emails (same as forgot-password)
- **Email template XSS prevention** — All email template code interpolations wrapped with `HtmlEncode()`
- **Secure cookie production guard** — CookieService throws at startup if `UseSecureCookies=false` in Production environment
- **ReDoS prevention** — Transaction search text is now escaped with `Regex.Escape()` before use in MongoDB regex queries

### Improved
- **CSV export** — Uses `Results.File()` with proper `Content-Disposition: attachment` header instead of inline text
- **Nginx hardening** — Added `keepalive_timeout 65`, `client_max_body_size 1m`, and `.well-known` path handling
- **Max password length** — Server-side validation now enforces 128-character maximum to prevent bcrypt DoS
- **Email validation** — Replaced regex with `System.Net.Mail.MailAddress` parser (RFC-compliant, no regex edge cases)
- **Consolidated handleResponse** — Removed duplicate response handler from authService; both apiClient and authService now share one implementation
- **Empty response safety** — `handleResponse` returns `undefined` instead of `{} as T` for empty bodies (safer for array/primitive return types)
- **Background service resilience** — All 3 background services now use exponential backoff (1h → 2h → 4h cap) on consecutive errors
- **Geolocation timeout** — SpendingMapPage `getCurrentPosition` now has 10s timeout and 5-minute cache
- **isPwaStandalone extraction** — Moved PWA detection to shared `utils/pwa.ts` utility, memoized with `useMemo` in AuthContext
- **JWT parsing documentation** — Added comment clarifying client-side JWT parsing is intentional (server validates signature)

### Accessibility
- **role="alert"** — Added `role="alert"` to MapErrorBoundary, PageErrorBoundary, and QueryErrorBoundary (full-page variant) for screen reader announcements

## [1.6.24] - 2026-02-21

### Fixed — Frontend Docker Deployment
- **Port Mismatch** — Azure Container Apps ingress targetPort was 80 but nginx listens on 8080; updated to 8080
- **Non-Root PID File** — nginx crashed with `Permission denied` writing PID to `/run/nginx.pid` as non-root user; `sed` replaces PID path to `/tmp/nginx/nginx.pid` during build (base image uses `/run/nginx.pid`, not `/var/run/nginx.pid`)

## [1.6.23] - 2026-02-21

### Fixed — Frontend Docker Deployment
- **Port Mismatch** — Azure Container Apps ingress targetPort was 80 but nginx listens on 8080; updated to 8080
- **Non-Root PID File** — nginx crashed with `Permission denied` writing PID to `/run/nginx.pid` as non-root user; moved PID to `/tmp/nginx/nginx.pid`
- **Duplicate PID Directive** — Passing `pid` via `-g` flag conflicted with default `nginx.conf`; use `sed` to replace PID path in-place during build

## [1.6.21] - 2026-02-20

### Fixed — Session Persistence (PWA & Browser)
- **Token Refresh Race Condition** — Unified all refresh paths through a single shared mutex in apiClient; prevents server token-rotation conflicts from concurrent refreshes
- **Cross-Tab Token Desync** — Added `storage` event listener in AuthContext to sync auth state across tabs; prevents server "token theft" detection from revoking all sessions
- **SignalR Stale Token** — `accessTokenFactory` now reads from localStorage instead of closure-captured value; reconnections use fresh token after refresh
- **iOS PWA Cookie Blocking** — Changed `SameSite=Strict` to `SameSite=Lax` on refresh token cookie; iOS standalone PWA cold starts no longer fail to send cookies
- **React Query Retry Storm** — Added `session.*expired` to `isClientError()` match; prevents 3x redundant refresh attempts on session expiration
- **Query Cache Leak on Logout** — `clearAuth()` now calls `queryClient.clear()` to wipe stale data between user sessions
- **Network Reconnection** — Added `online` event listener for eager token refresh after connectivity is restored
- **Cold-Start Flash** — Failed refresh on app start now immediately calls `clearAuth()` instead of showing dead-token UI
- **Service Worker Auth Bypass** — Explicit no-cache route for `/api/auth/` endpoints in service worker

## [1.6.20] - 2026-02-20

### Changed — Insights Page
- **Categories** — Renamed to Money Out / Money In by Category with recharts donut charts; type-based analytics instead of income/spending concept
- **Cash Flow Trends** — Merged financial summary stats into TrendsWidget; recharts AreaChart with daily granularity, zero-fill, and timezone-safe date formatting
- **Budget Tracking** — Health header with colored status badges, warning indicators, sorted by utilization
- **Top Recipients** — Renamed from Counterparties; P2P badges, percentage shown
- **Account Activity** — New widget replacing Spending by Account: per-account emoji icon, transaction count, money in/out, net change, activity share progress bar
- **Spending Alerts** — Type-specific icons (warning triangle, trend arrow, tag, person+)
- **Compact Mobile Layout** — Mobile reorder controls for widget drag-and-drop

### Fixed — Real-time Data
- **Stale Insights After P2P Transactions** — Backend analytics endpoints changed from `max-age=300` to `no-cache` with ETag revalidation; browser no longer serves stale cached responses
- **SignalR P2P Handlers** — Added `refetchType: 'all'` and accounts/budgets invalidation to all P2P event handlers (Created/Accepted/Rejected)
- **Mutation Cache Invalidation** — `useUpdateStatus`, `useBatchMarkConfirmed`, `useBatchMarkPending` now invalidate accounts and budgets queries
- **Analytics Stale Time** — Reduced from 5 minutes to 30 seconds

### Removed — Dead Code (-1,778 lines)
- Deleted entire `components/insights/` directory (12 orphaned files from prior refactoring)
- Removed unused `FinancialSummaryWidget`, `ByAccountWidget`, duplicate `CounterpartiesWidget`
- Removed Transaction Averages widget (redundant with trends)

## [1.6.19] - 2026-02-18

### Fixed — Tests
- **SettingsPage Test Stderr Noise** — Mocked `currencyService` in SettingsPage tests to prevent `Failed to load currency data` errors flooding CI output
- **CI Duplicate Coverage Report** — Fixed `dotnet test` targeting all assemblies instead of specific test project, causing duplicate rows in code coverage PR comment

## [1.6.18] - 2026-02-18

### Added — Testing
- **Comprehensive Test Coverage** — Added ~643 new unit tests across API and Web, bringing total to 1,818 tests (819 API + 999 Web)
- **API Validator Tests (170)** — Account, Auth, Budget, Label, Tag, Transaction validators and ValidationExtensions
- **API Service Tests (207)** — BudgetService (22), TransactionCoreService (13), TransactionImportService (42), AuditService (30), TransferService (16), RecurringTransactionService (22), TransactionMapperService (23), TransactionBatchService (14), TransactionExportService (8), GlobalExceptionHandlerMiddleware (17)
- **API Common Tests (29)** — CurrencyFormatter (15), ETagHelper (14)
- **Web Validation Tests (~180)** — Zod schema tests for accounts, auth, budgets, common, transactions
- **Web Utils & Hook Tests (54)** — formatters, labelExclusion, useAccountQueries, useLabelQueries
- **Web Component Tests (3)** — ProtectedRoute auth guard

### Fixed — Integration Tests
- **DigiTransacWebApplicationFactory** — Added missing DI mocks for IPushSubscriptionRepository, IUnitOfWork, IAuditService, and SecuritySettings config; all 24 non-MongoDB integration tests now pass
- **MongoDb Test Skip on No Docker** — MongoDbContainerFixture now gracefully skips tests when Docker is unavailable using SkippableFact instead of hard-failing
- **MongoDbBuilder Deprecation** — Replaced deprecated parameterless `MongoDbBuilder()` with `MongoDbBuilder("mongo:7.0")`

### Fixed — Bugs
- **ChatMessage Anonymization Crash** — `ChatMessageRepository.AnonymizeByUserIdAsync` was setting SenderUserId/RecipientUserId to `"deleted"` which is not a valid ObjectId hex string; changed to `"000000000000000000000000"` sentinel

## [1.6.17] - 2026-02-18

### Fixed
- **Chat Instant Display** — New conversation messages now appear instantly for the sender; fixed by seeding React Query cache with pending conversation data before sending, so optimistic updates work from the first message
- **CI Pipeline grep Bug** — Fixed `grep -c || echo "0"` pattern that produced `0\n0` (two zeros) instead of a single integer, causing `integer expression expected` errors in VERSION validation

## [1.6.16] - 2026-02-14

### Changed — Architecture
- **CancellationToken Propagation** — Added `CancellationToken ct = default` to all async methods across repositories (TransactionRepository, RefreshTokenRepository, EmailVerificationRepository, AuditLogRepository, ExchangeRateRepository), service interfaces (IAuthService, ITransactionService + sub-services, IExchangeRateService, ITransactionImportService), service implementations, and endpoint handlers; tokens are now forwarded from HTTP request through service layer to MongoDB driver calls
- **CurrencyContext → React Query** — Replaced manual `useState`/`useEffect`/`useCallback` with `useQuery` from TanStack React Query for exchange rate fetching; eliminates manual localStorage caching (React Query's `staleTime`/`gcTime` handles it), reduces code from 167 to 103 lines while preserving the same `useCurrency()` API surface
- **InsightsPage Decomposition** — Split ~1931-line monolith into 14 focused files under `pages/insights/`: types, helpers, shared widgets (`InsightWidgets.tsx`), `FinancialSummaryWidget`, `CategoryPairWidget`, `TrendsWidget`, `BudgetsWidget`, `AveragesWidget`, `CounterpartiesWidget`, `ByAccountWidget`, `PatternsWidget`, `AnomaliesWidget`, and orchestrator `InsightsPage.tsx`; old import path re-exports for backward compatibility

## [1.6.15] - 2026-02-14

### Fixed — Security
- **Password Change/Reset Token Revocation** — All refresh tokens are now revoked when a user changes or resets their password, preventing stolen tokens from retaining access
- **Forgot-Password Email Enumeration** — Endpoint now always returns generic success message regardless of whether the email exists, fixing a code path that leaked failures before the generic response
- **Login Timing Attack Mitigation** — BCrypt.Verify now runs against a dummy hash when the user doesn't exist, preventing timing-based email enumeration
- **CSV Injection Prevention** — Transaction CSV export now sanitizes formula injection characters (`=`, `+`, `-`, `@`, `\t`, `\r`) and properly escapes quotes in all fields (AccountName, categoryName, tagNames were previously unescaped)
- **Refresh Token Rate Limiting** — Added `.RequireRateLimiting("auth")` to the `/refresh-token` endpoint to prevent brute-force attacks
- **Decryption Error Handling** — `DecryptIfNotEmpty` now catches only `CryptographicException` (returns null) and `FormatException` (legacy unencrypted data), instead of a catch-all that leaked ciphertext to callers
- **Exception Message Leak** — `GlobalExceptionHandlerMiddleware` no longer exposes `ArgumentException.Message` or `InvalidOperationException.Message` to clients; uses generic messages instead
- **Verification Code Range** — Fixed off-by-one in `GenerateVerificationCode`: upper bound changed from 999999 (exclusive) to 1000000 so code 999999 can be generated

### Fixed — Bugs
- **Offline Sync Broken** — `useOffline.ts` used wrong localStorage key (`'accessToken'` instead of `'digitransac_access_token'`); all offline queue sync operations silently failed
- **Auth Crash on Corrupted Storage** — `AuthContext` initialization now wraps `JSON.parse(storedUser)` in try/catch; corrupted localStorage no longer causes unrecoverable white-screen crash
- **Batch Delete Double Balance Reversal** — When both sides of a transfer were included in batch delete IDs, balances were reversed twice; now tracks processed IDs in a `HashSet` to skip already-handled linked transactions
- **Batch Status Update Missing Balance** — Changing transaction status between Confirmed ↔ Pending/Declined now correctly adjusts account balances
- **Recurring Transfer Currency Conversion** — Recurring transfers between accounts with different currencies now perform exchange rate conversion (previously used raw template amount with destination currency)
- **Shared Mutable References in Recurring** — Recurring transaction instances now deep-copy `Splits`, `TagIds`, and `Location` from the template instead of sharing object references
- **Email Change Stale Records** — `SendEmailChangeCodeAsync` now deletes existing verification records before creating new ones (was accumulating stale records unlike other flows)
- **Account Deletion Not Atomic** — Removed misleading `ExecuteInTransactionAsync` wrapper from `DeleteAccountAsync` since repository `DeleteAll*` methods don't support `IClientSessionHandle`; operations now execute sequentially with user record deleted last for safety
- **429 Rate Limit Retry** — 429 (Too Many Requests) is no longer treated as a non-retryable client error; rate-limited requests now benefit from exponential backoff retry
- **markAsRead Spam** — Chat `markAsReadMutation` no longer fires on every React Query refetch; tracks last-marked conversation to prevent redundant API calls
- **Uncleared Timeouts** — TransactionsPage highlight/undo `setTimeout` calls are now tracked in refs and cleaned up on unmount

### Fixed — Performance
- **Budget N+1 Labels Query** — `CheckBudgetAlertsAsync` now pre-fetches labels once before the budget loop instead of fetching per-budget; `GetBudgetTransactionsAsync` accepts optional pre-fetched labels
- **Budget Parallel DB Calls** — `BuildBudgetResponseAsync` (single-budget overload) now parallelizes accounts, labels, rates, and user queries with `Task.WhenAll`
- **ETag Double Serialization** — `OkWithETag` now serializes JSON once and uses `Results.Text()` for the response body, avoiding redundant serialization by `Results.Ok()`
- **Analytics PageSize Clamped** — Analytics endpoints clamp `pageSize` to max 200; conversation message `limit` clamped to 200
- **Batch Operation Max Size** — Batch operations now enforce a maximum of 100 IDs per request via FluentValidation
- **Static Compiled Regex** — Email validation regex is now a `static readonly Regex` with `RegexOptions.Compiled` instead of being recompiled per call
- **MailMessage Disposal** — All three `EmailService` send methods now dispose `MailMessage` after sending

### Changed
- **Optimistic Error Visibility** — MutationCache global error handler no longer skips error toasts for mutations with `onError` (optimistic rollback); users now see failure notifications after rollback

## [1.6.14] - 2026-02-14

### Added
- **Chat Undo Delete** — Deleted chat messages can now be restored within a 24-hour window
  - Backend: `RestoreMessageAsync` on `ChatMessageRepository` and `ConversationService` — validates ownership, checks undo window, verifies content not yet purged
  - Backend: `PurgeExpiredDeletedMessagesAsync` repository method — sets `Content = null` for messages deleted beyond the undo window
  - Backend: `DeletedMessageCleanupService` background service — runs hourly to permanently scrub content from expired deleted messages
  - Backend: `POST /api/conversations/messages/{messageId}/restore` endpoint
  - Backend: `DeletedAt` field added to `ConversationMessage` DTO for undo window calculation
  - Frontend: `restoreMessage()` service function and `useRestoreMessage()` React Query hook
  - Frontend: "Undo" button with countdown timer on deleted messages (visible only to sender within 24h)
  - Frontend: `canUndoDelete()` and `getUndoTimeRemaining()` helper functions in `MessageBubble`
  - Constants: `UndoDeleteWindowMinutes = 1440` (24 hours) in `ConversationConstants`

## [1.6.13] - 2026-02-14

### Fixed
- **Chat Transaction Menu on Mobile** — Transaction message cards in chat now support long-press to open the actions menu (including "View in Transactions"). Previously, the menu trigger only used `group-hover:opacity-100` which doesn't work on touch devices, and long-press handlers (`onTouchStart`/`onTouchEnd`/`onTouchMove`) were only attached to text message bubbles.
- **Deleted Transactions in Chat** — When a transaction is deleted from the Transactions page, the corresponding chat message now shows a "Transaction deleted" placeholder card instead of rendering nothing. Previously, `message.type === 'Transaction'` with `message.transaction === null` fell through all rendering branches silently.
- **MessageActionsMenu Option Count** — Fixed menu height calculation that counted "View in Transactions" for all transaction-type messages even when `message.transaction` was null (deleted transaction). Now correctly checks `message.transaction` existence.

## [1.6.12] - 2026-02-14

### Fixed
- **Push Notification Permission Bug** — `PushNotificationSettings.tsx` `handleToggle` incorrectly checked `requestNotificationPermission()` return value as boolean (`if (!granted)`) instead of comparing the `NotificationPermission` string (`if (permission !== 'granted')`). The "permission denied" error message never displayed because all string values (`"granted"`, `"denied"`, `"default"`) are truthy.

### Changed
- **WebPushSettings → Options Pattern** — Moved `WebPushSettings` class from `WebPushService.cs` to `AppSettings.cs` and registered via `builder.Services.Configure<WebPushSettings>()` for consistency with all other settings classes. `WebPushService` now injects `IOptions<WebPushSettings>` instead of manually binding from `IConfiguration`.
- **CancellationToken in WebPush** — Added `CancellationToken` parameter to all `IWebPushService` methods (`SendToUserAsync`, `SendToSubscriptionAsync`) and all `IPushSubscriptionRepository` methods, propagated through to MongoDB driver calls. Push endpoints now pass `HttpContext.RequestAborted`.

## [1.6.0] - 2026-02-12

### Added
- **Mobile UX Overhaul** — 16-item comprehensive mobile experience improvement for PWA usage
  
  #### Phase 1: Core Mobile Navigation
  - **Bottom Tab Bar** — Native-style 5-tab navigation (Insights, Accounts, Add FAB, Transactions, More) with active state indicators and haptic feedback on taps
  - **More Menu** — Bottom sheet for secondary navigation items (Chats, Budgets, Map, Labels, Settings) with sign-out action
  - **Sidebar Hidden on Mobile** — Desktop sidebar hidden below `lg` breakpoint; mobile uses bottom tab bar exclusively
  - **OfflineIndicator Repositioned** — Moved from bottom bar to top-center pill toast to avoid tab bar overlap
  - **InstallPrompt Repositioned** — PWA install banner uses `bottom-20 lg:bottom-4` to clear tab bar
  - **Safe Area CSS** — `safe-area-bottom` and `safe-area-top` utility classes for notched devices
  - **Print Styles** — Bottom tab bar hidden in print media
  
  #### Phase 2: Touch Quality
  - **ConfirmDialog Component** — Dual-mode confirmation: bottom sheet on mobile (`useIsMobile()`), centered modal on desktop; replaces all `window.confirm()` usage
  - **useConfirmDialog Hook** — Promise-based hook returning `{ confirm, dialogProps }` for async confirmation flows
  - **useHaptics Hook** — Vibration API wrapper with 7 named patterns (`light`, `medium`, `heavy`, `success`, `warning`, `error`, `selection`) via `navigator.vibrate()`
  - **Haptic Feedback Integration** — Added haptic feedback to SwipeableRow (threshold crossing, swipe complete), PullToRefresh (threshold, refresh trigger), BottomTabBar taps, delete actions, and form wizard step transitions
  - **Touch Target Audit** — All interactive elements enforce minimum 44×44px with `min-h-[44px]` and `touch-manipulation` class
  
  #### Phase 3: Form & Page Optimization
  - **TransactionForm Mobile Wizard** — 3-step mobile wizard (Amount → Account/Category → Details) with step indicators, shared field renderers, and haptic feedback on step transitions; desktop retains single-page layout
  - **Auto-Hide Header** — `useScrollDirection` hook detects scroll direction; mobile header slides up on scroll-down and reappears on scroll-up with smooth transitions
  - **Insights Page Mobile Layout** — Touch-friendly reorder buttons (up/down arrows replacing drag-and-drop), horizontally scrollable period selector, `grid-cols-1 sm:grid-cols-3` hero stats
  - **AccountCard Bottom Action Sheet** — Mobile: full-width bottom sheet with account info header, large touch targets with icons; Desktop: existing dropdown menu preserved
  
  #### Phase 4: Feature Parity & Polish
  - **Mobile Export** — Web Share API integration (`navigator.share()` + `navigator.canShare()`) for sharing exported files on mobile; fallback to `<a>` download
  - **Swipe-to-Navigate** — `useSwipeNavigation` hook enables horizontal swipe between adjacent tab pages (Insights ↔ Accounts ↔ Transactions) with haptic feedback
  - **Branded Pull-to-Refresh** — Custom SVG progress ring with indigo gradient, rotating transaction arrows icon, and status text ("Pull to refresh" / "Release to refresh" / "Refreshing…")
  - **Keyboard-Aware Scroll** — `useKeyboardAwareScroll` hook uses VisualViewport API + focusin events to auto-scroll focused inputs into view when virtual keyboard opens
  - **Long-Press Quick Actions** — `useLongPress` hook (500ms delay, 10px move threshold) with haptic feedback; transaction rows show bottom sheet with Edit, Confirm/Pending, Select, and Delete actions
  - **OnboardingTour Mobile Steps** — Mobile-specific tour steps targeting tab bar, more menu, swipe gestures, and pull-to-refresh (replacing desktop sidebar-targeted steps); touch-friendly buttons with `min-h-[44px]`

### New Hooks
- `useMediaQuery(query)` + `useIsMobile()` — Generic media query hook with SSR-safe initialization
- `useHaptics()` — Vibration API with 7 named haptic patterns
- `useScrollDirection(options)` — Scroll direction detection with configurable threshold and topOffset
- `useSwipeNavigation(options)` — Horizontal swipe navigation between tab pages
- `useKeyboardAwareScroll()` — Auto-scroll inputs into view on virtual keyboard open
- `useLongPress(options)` — Touch gesture hook with configurable delay and movement threshold
- `useConfirmDialog()` — Promise-based confirmation dialog hook

### New Components
- `BottomTabBar` — Mobile bottom navigation with 5 tabs and FAB center button
- `MoreMenu` — Bottom sheet for secondary navigation items
- `ConfirmDialog` — Responsive confirmation dialog (bottom sheet on mobile, modal on desktop)

### Changed
- `Layout.tsx` — Integrated BottomTabBar, auto-hide header, swipe navigation, keyboard-aware scroll; sidebar hidden on mobile
- `TransactionList.tsx` — Added long-press quick actions on transaction rows with bottom action sheet
- `TransactionForm.tsx` — Refactored to 3-step mobile wizard with shared field renderers
- `InsightsPage.tsx` — Mobile reorder buttons, horizontal scroll period selector, responsive hero stats grid
- `AccountCard.tsx` — Dual-mode menu (desktop dropdown + mobile bottom action sheet)
- `TransactionsPage.tsx` — Mobile export with Web Share API, touch-friendly filter controls
- `SwipeableRow.tsx` — Added haptic feedback on threshold crossing and swipe completion
- `PullToRefreshIndicator.tsx` — Complete rewrite with branded SVG animation
- `OnboardingTour.tsx` — Mobile-specific tour steps and touch-friendly UI
- `OfflineIndicator.tsx` — Repositioned to top-center pill toast
- `InstallPrompt.tsx` — Repositioned to avoid tab bar overlap
- `BudgetsPage.tsx` / `BudgetList.tsx` — Replaced `window.confirm` with `useConfirmDialog`

### Fixed
- `TransactionList.test.tsx` — Updated 3 tests to match new direct-delete behavior (parent handles undo toast instead of `window.confirm`)

## [1.5.0] - 2026-02-12

### Added
- **Exclude from Analytics** - Per-label `excludeFromAnalytics` flag to hide categories/folders from analytics, budgets, and spending reports
  - Backend: `excludeFromAnalytics` field on Label model with full CRUD support in DTOs and LabelService
  - Backend: `BuildExcludedLabelIds` helper with parent-chain inheritance — excluding a folder excludes all children
  - Backend: All 8 analytics methods (`GetSummaryAsync`, `GetAnalyticsAsync`, `GetTopCounterpartiesAsync`, `GetSpendingByAccountAsync`, `GetSpendingPatternsAsync`, `GetSpendingAnomaliesAsync`, `GetLocationInsightsAsync`, `GetTripGroupsAsync`) filter excluded labels
  - Backend: `IsFullyExcluded` — transactions excluded only when ALL splits are in excluded categories
  - Backend: `GetIncludedAmount` — partial exclusion returns sum of non-excluded splits with currency conversion
  - Backend: BudgetService respects exclusion when fetching budget transactions
  - Backend: Lazy migration sets `excludeFromAnalytics=true` on existing "Transfers" and "Adjustments" system labels
  - Backend: Smart defaults — new system labels (Transfers, Adjustments) created with `excludeFromAnalytics=true`
  - Frontend: Toggle button on each label in the tree view to exclude/include from analytics
  - Frontend: Visual inheritance — child labels of excluded folders show "inherited" badge with dimmed appearance
  - Frontend: Exclude toggle in create/edit label modal with parent-inherited state detection
  - Frontend: Search results show "excluded" badge for excluded labels
  - 9 unit tests covering `BuildExcludedLabelIds` (empty dict, no exclusions, direct exclusion, folder inheritance, nested inheritance, child-only, mixed, orphaned parent, root-level category)

### Fixed
- **MemoryCacheServiceTests** - Updated 3 pre-existing broken tests to match current `CacheOptions`/`CacheKeys` API

## [1.4.1] - 2026-02-12

### Fixed
- **CI/CD Pipeline .NET Version Mismatch** - Updated `DOTNET_VERSION` from `9.0.x` to `10.0.x` in GitHub Actions pipeline to match the project's `net10.0` target framework
- **Dockerfile .NET Version Mismatch** - Updated Docker base images from `dotnet/sdk:9.0` and `dotnet/aspnet:9.0` to `dotnet/sdk:10.0` and `dotnet/aspnet:10.0` to match the project's `net10.0` target framework

## [1.4.0] - 2026-02-12

### Performance
- **Fix N+1 in TransactionBatchService.BatchDeleteAsync** - Batch-fetch transactions via `GetByIdsAsync` and accounts via `GetByUserIdAsync`, build dictionaries for O(1) lookups instead of per-item repository queries
- **Fix N+1 in TransactionBatchService.BatchUpdateStatusAsync** - Same batch-fetch + dictionary pattern for status update operations
- **Fix N+1 in TransactionImportService.CreateTransaction** - Pre-fetch labels once before the import loop instead of re-querying per CSV row
- **Fix N+1 in RecurringTransactionService.DeleteRecurringAsync** - Batch-fetch accounts with `GetByUserIdAsync` and build `accountMap` instead of per-recurring-transaction account lookup

### Changed
- **Extract GetTransactionCurrency** - Deduplicated currency resolution logic (was copy-pasted in 6 analytics methods) into a single `private static` method in `TransactionAnalyticsService`
- **Extract CalculateDistanceKm** - Deduplicated Haversine formula (was duplicated in location insights and trip grouping) into a single `private static` method with `ToRadians` helper
- **Extract FetchAnalyticsContextAsync** - Consolidated shared analytics data-fetch pattern (primary currency, exchange rates, accounts, labels, DEK) into `FetchAnalyticsContextAsync` returning an `AnalyticsContext` record
- **TransactionImportService → ITransactionMapperService** - Replaced `IEncryptionService` + `IKeyManagementService` + `IUserRepository` with unified `ITransactionMapperService` for encryption operations
- **TransactionAnalyticsService Logging** - Added `ILogger<TransactionAnalyticsService>` with debug logging on all 8 public analytics methods
- **CancellationToken in TwoFactorService** - Propagated `CancellationToken` to all `IUserRepository` calls (`GetByIdAsync`, `UpdateAsync`) in all 4 async methods
- **CancellationToken in RecurringTransactionBackgroundService** - Propagated `stoppingToken` through to `ProcessRecurringTransactionsAsync`; updated `IRecurringTransactionService` interface and implementation
- **CancellationToken in IUserRepository** - Added `CancellationToken ct = default` to all interface methods and MongoDB driver calls in implementation
- **Centralized API URL in useNotifications** - Replaced hardcoded `import.meta.env.VITE_API_URL || 'http://localhost:5000'` with imported `API_BASE_URL` from `apiClient`

### Security
- **Environment guard on curl fallback** - `ExchangeRateService.FetchWithCurlAsync` now only executes curl in Development environment; logs error and throws `InvalidOperationException` in production instead of spawning system processes

### Fixed
- **Test Suite Updated** - All 401 unit tests passing with updated mocks for `CancellationToken` parameters on `IUserRepository` methods and `IHostEnvironment` on `ExchangeRateService`

## [1.3.0] - 2026-02-12

### Performance
- **Fix N+1 in BudgetService.GetSummaryAsync** - Batch-fetch all accounts upfront instead of querying per-budget inside loop
- **Fix N+1 in ConversationService.GetConversationsAsync** - Batch-fetch all users upfront instead of querying per-conversation inside loop
- **Fix N+1 in ReorderAsync** - AccountService and LabelService now use `BulkUpdateOrderAsync` repository methods instead of per-item `UpdateAsync` calls
- **Fix dictionary recreation in TransactionCoreService.GetAllAsync** - Moved `accountMap` dictionary creation outside the transaction loop

### Changed
- **Transaction Facade Pattern** - Extracted `AccountService` encryption/decryption logic into `ITransactionMapperService`, reducing 3 injected dependencies (`IKeyManagementService`, `IDekCacheService`, `IEncryptionService`) to 1
- **Result Pattern Migration** - Migrated remaining 6 services (`LabelService`, `TagService`, `BudgetService`, `AccountService`, `ConversationService`, `RecurringTransactionService`) from tuple returns `(bool, string, T?)` to `Result<T>` pattern with `DomainErrors`
- **CancellationToken Propagation** - Added `CancellationToken ct = default` parameter to all service interfaces, implementations, and repository methods; endpoints pass `HttpContext.RequestAborted` through the call chain
- **Centralized API_BASE_URL** - Frontend `apiClient.ts` now exports `API_BASE_URL`; `authService.ts` and all other services import from single source
- **CSV Export via apiClient** - Frontend CSV export now uses `apiClient` with proper auth headers instead of raw `fetch` with manual token handling
- **Frontend formatCurrency** - Replaced hardcoded `'en-IN'` locale with `navigator.language` for proper locale-sensitive currency formatting
- **FluentValidation for Budgets** - Added `CreateBudgetRequestValidator` and `UpdateBudgetRequestValidator` with proper validation rules for budget endpoints
- **ConversationService Logging** - Added `ILogger<ConversationService>` for structured logging of conversation operations

### Fixed
- **Auth Email Conflict** - `DomainErrors.Auth.EmailAlreadyRegistered` now correctly returns HTTP 409 Conflict instead of 400 Bad Request
- **Test Suite Updated** - All 425 tests passing (up from 421) with updated mocks for CancellationToken parameters, Result pattern assertions, and corrected error message expectations

## [1.2.0] - 2026-02-11

### Added
- **Result Pattern** - Type-safe `Result<T>` with `Error` records, `DomainErrors` catalog, and extension methods (`Map`, `Bind`, `Match`, `Ensure`, `ToApiResult()`)
- **Global Exception Handler** - RFC 7807 Problem Details middleware with exception-to-HTTP-status mapping and trace IDs
- **Content-based ETags** - SHA256-based content hashing via `ETagHelper`, `If-None-Match` support with 304 Not Modified responses on analytics and transaction list endpoints
- **Redis Caching** - `RedisCacheService` implementation with conditional registration (Redis when `Redis:ConnectionString` configured, in-memory fallback)
- **Cache Keys** - Centralized `CacheKeys` static class for consistent cache key naming across cache invalidation handlers
- **Request Logging Middleware** - Structured request/response logging with method, path, status code, duration, user ID, and sensitive path redaction
- **Configurable MongoDB Pool** - Connection pool size, timeouts, idle time, retry settings all configurable via `appsettings.json > MongoDb` section
- **CurrencyFormatter** - Shared utility extracted from duplicated formatting logic across analytics services
- **Notification DTOs** - Dedicated `Models/Dto/NotificationDto.cs` with `P2PTransactionNotification`, `ChatMessageNotification`, `PendingCountNotification`, `BudgetAlertNotification`, `PushNotificationPayload`

### Changed
- **Program.cs Refactored** - Extracted all service registration and middleware pipeline into extension methods (~62 lines)
- **Transaction Endpoints Split** - Monolithic `TransactionEndpoints.cs` split into 4 focused files: CRUD, Analytics, Batch, Export with coordinator
- **Auth Endpoints Split** - Monolithic `AuthEndpoints.cs` split into 4 focused files: Core, Account, Password with coordinator
- **AuthService Split** - Split into 7 partial class files (Registration, Login, Account, Password, Token, Helpers, core) for maintainability
- **ITransactionCoreService** - Migrated from tuple returns `(bool, string, T?)` to `Result<T>` pattern
- **IAuthService** - Migrated from tuple returns to `Result<T>` pattern with `DomainErrors`
- **Caching Architecture** - `ICacheService` now supports tag-based invalidation, pattern removal, and `GetOrCreateAsync` with `CacheOptions`

### Fixed
- **SSL Certificate Validation** - Removed dangerous `ServerCertificateCustomValidationCallback` that bypassed all SSL validation
- **ETag Implementation** - Replaced timestamp-based ETags with content-hash-based ETags that correctly detect data changes
- **BatchOperationRequestValidator** - Synced validator with endpoint handler to validate all required fields
- **Account Deletion** - Now transactional using Unit of Work pattern to ensure atomic deletion of all user data
- **AzureKeyVaultService** - Added guard against runtime crashes when Key Vault URL is not configured
- **UnitOfWork DI Registration** - Added missing `IUnitOfWork` registration in dependency injection container

### Security
- Removed SSL bypass that accepted all certificates in non-development environments
- Auth endpoints have sensitive path redaction in request logging
- Exception details (stack traces) only exposed in Development environment

## [1.1.8] - 2026-02-09

### Added
- **PWA Push Notifications**: Receive chat message notifications even when app is closed
  - Backend: Web Push API integration with VAPID authentication
  - Backend: Push subscription management endpoints (`/api/push/*`)
  - Backend: Automatic push notification on new chat messages
  - Frontend: Custom service worker with push notification handlers
  - Frontend: Push notification settings in Settings page with toggle
  - Frontend: Test notification feature to verify push is working
  - Works on mobile and desktop browsers that support Web Push API
  - Notifications include sender name, message preview, and deep link to conversation

## [1.1.7] - 2026-02-09

### Added
- **Balance Adjustment Audit Trail**: Balance adjustments now create a message in the Personal conversation
  - Messages are system-generated and linked to the adjustment transaction
  - Format: "Balance Adjustment: HDFC Bank +₹1,000.00 → ₹15,000.00"
  - Provides audit trail for all balance changes in the user's chat history

### Improved
- **Conversation List Transaction Display**: Enhanced conversation item preview
  - Transaction preview colors now match direction:
    - "Sent ₹X" shows in RED (money out)
    - "Received ₹X" shows in GREEN (money in)
    - Other transactions show in BLUE
  - For P2P chats: Shows sent/received totals with colored arrows
    - ↑ Red = amount sent, ↓ Green = amount received
  - Uses currency formatting with proper symbols

## [1.1.6] - 2026-02-09

### Fixed
- **Liability Account Balance Calculations**: Fixed incorrect balance handling for credit cards and loans
  - Backend (`AdjustBalanceAsync`): Now creates correct transaction types for liability accounts
    - Increasing debt (e.g., 500→4000) creates `Send` transaction (money spent)
    - Decreasing debt (e.g., 500→400) creates `Receive` transaction (payment made)
  - Backend (`GetSummaryAsync`): Properly categorizes negative liability balances
    - Negative balance on credit card (overpayment) now correctly counted as asset
    - Negative balance on bank account (overdraft) now correctly counted as liability
  - Net worth calculation now handles edge cases correctly
- **Consistent Balance Color Coding**: Unified color scheme across all account types
  - `AdjustBalanceModal`: Balance difference shows contextually appropriate colors for liability accounts
  - `AccountCard`: Now shows consistent green/red coloring for all account types
  - `AccountsPage`: Account type totals now show green/red colors with appropriate signs
  - `AccountSummaryCard`: Liabilities now display with negative sign (−) for clarity
  - `MultiCurrencyDashboard`: "In Good Standing" count now correctly evaluates liability accounts
    - 🟢 Green = Good (positive balance on assets, paid-off liabilities)
    - 🔴 Red = Bad (overdraft on assets, debt on liabilities)
    - Shows negative sign (−) for liabilities with debt and assets with overdraft

## [1.1.5] - 2026-02-07

### Fixed
- **Real-time Chat Messages**: Messages now appear instantly for recipients without manual refresh
  - Backend: Added SignalR notification calls when sending text messages and money
  - Frontend: Fixed query key mismatch in notification handlers to properly invalidate conversation caches
  - Users in the same conversation now receive messages in real-time via WebSocket

## [1.1.4] - 2026-02-07

### Fixed
- **XML Documentation Warnings**: Added missing param tags for `GetTripGroupsAsync` method
  - Resolves 3 CS1573 compiler warnings
  - API project now builds with 0 warnings

## [1.1.3] - 2026-02-07

### Fixed
- **Complete Account Deletion**: Delete account now properly removes ALL user data
  - Previously only deleted: User record, refresh tokens, email verifications
  - Now also deletes: Transactions, accounts, labels, tags, budgets, budget notifications, chat messages, two-factor tokens
  - Ensures GDPR compliance and complete data cleanup
- **Database Cleanup**: Stale `username_1` index causing registration failures
  - Users need to manually drop the index from MongoDB (see MongoDB console or Atlas)

## [1.1.2] - 2026-02-07

### Added
- **Personal Conversation on Registration**: New users now see a welcome message in their Personal chat
- **Mandatory VERSION Bump**: CI/CD pipeline now enforces VERSION file updates in PRs

### Fixed
- **Location Detection in Production**: Added BigDataCloud and ipapi.co to CSP connect-src
- Reverse geocoding now works correctly in Azure deployment
- **Pay Button UX**: Users can now click Pay button in chats without having accounts first
- Shows helpful message with link to create account when no accounts exist

## [1.1.1] - 2026-02-06

### Added
- Pull-to-refresh for mobile users (#80)
- **PWA Pull-to-Refresh on All Data Pages**:
  - Chats page conversation list
  - Insights dashboard (refreshes all analytics data)
  - Labels page (refreshes categories and tags)
  - Spending Map page (refreshes transaction locations and trips)
- Comprehensive security checks in CI/CD pipeline (#79)
- Critical outdated package check in pipeline (fails on 2+ major versions behind)
- Warning for packages 1+ major versions behind
- **Release Management System**:
  - VERSION file for semantic versioning
  - CHANGELOG enforcement in PR pipeline (requires updating CHANGELOG.md)
  - Automatic git tagging on successful deployments to main
  - ROLLBACK.md documentation for disaster recovery

### Changed
- Updated Swashbuckle.AspNetCore from 7.3.1 to 10.1.2
- Updated Microsoft.OpenApi to 2.4.1 (breaking namespace changes handled)
- Updated MediatR from 12.4.1 to 14.0.0
- Updated Serilog.AspNetCore from 9.0.0 to 10.0.0
- Updated Azure.Identity from 1.13.2 to 1.17.1
- Updated Azure.Security.KeyVault.Secrets from 4.7.0 to 4.8.0
- Improved LocationPicker error messages with actionable guidance

### Fixed
- MongoDB index conflict in TagRepository (#81)
- BsonIgnoreExtraElements added to all MongoDB models for schema resilience (#78)
- Include custom domains in CORS_ALLOWED_ORIGINS during deployment (#75)
- Location permission errors now show helpful guidance instead of generic "Failed to get location"
- **Currency Detection Improvement**: Registration page now shows specific failure reasons (timeout, network, reverse geocode failure) instead of incorrectly showing "permission denied"

## [1.0.0] - 2026-02-01

### Added
- **Azure Deployment** - Full CI/CD pipeline with OIDC and Key Vault integration (#51)
- **Spending Map** - Interactive map showing transaction locations with Leaflet.js
- **Budgets Page** - Dedicated budgets page with multi-currency support
- **Insights Dashboard** - Month-over-month comparison, income categories, drag-to-reorder widgets
- **Real-time Updates** - SignalR notifications for transactions
- **PWA Support** - Offline support, caching, and mobile optimizations
- **Error Boundaries** - Graceful error handling throughout the app
- **Touch Gestures** - Swipe actions for mobile UX

### Changed
- Cash Flow Trend labels: renamed Income/Expenses to Money In/Money Out
- Transaction types renamed from Credit/Debit to Receive/Send
- App is now fully currency-agnostic

### Fixed
- All 383 API tests passing
- All 784+ web tests passing

## [0.9.0] - 2026-01-15

### Added
- **Chat-based Transactions** - WhatsApp-style P2P transaction UI
- **Message Actions** - Smart positioning menu for message actions
- **Resizable Sidebar** - Drag-to-resize chat sidebar
- **Conversation Search** - Search through conversations with highlighting

### Changed
- Message bubble colors updated to complementary blue/indigo theme
- Send button icon updated
- Reduced highlight duration for better UX

### Fixed
- Scroll-to-bottom button positioning and visibility
- Personal chat display bugs

## [0.8.0] - 2026-01-01

### Added
- **P2P Multi-user Transactions** - Send/receive money with multiple users
- **Default Account Support** - Set default account for quick transactions
- **Transfer Improvements** - Better transfer display and exchange rates

### Changed
- CategoriesTab decomposed into smaller components
- Transaction Role removed, using nameof() for type safety
- IsCleared boolean replaced with TransactionStatus enum

### Fixed
- Transfer summary calculations
- Exchange rate display issues

## [0.7.0] - 2025-12-15

### Added
- **Circuit Breaker Pattern** - Polly for external API resilience
- **OpenTelemetry Tracing** - Distributed tracing support
- **Rate Limiting** - Per-user and endpoint-specific rate limits
- **API Versioning** - URL, header, and query string versioning

### Changed
- Major architecture improvements (13 phases)
- Counterparty filter for P2P transactions

### Fixed
- TransactionForm tests - form submission timing issues
- Sidebar resize bugs

## [0.6.0] - 2025-12-01

### Added
- **React Query Migration** - Full migration to React Query with DevTools
- **Optimistic Updates** - Instant UI feedback for transactions
- **Toast Notifications** - User feedback for all actions
- **Empty States** - Improved UX for empty data

### Changed
- Transactions page migrated to React Query
- Accounts page migrated to React Query

## [0.5.0] - 2025-11-15

### Added
- **Location Capture** - Auto-capture location when transaction form opens
- **Time Zones** - Full timezone support for transactions
- **Advanced Options** - Streamlined UI for optional fields

### Changed
- Date derived from DateLocal + TimeLocal + DateTimezone
- TimeLocal added to transaction model

## [0.4.0] - 2025-11-01

### Added
- **Two-Factor Authentication** - TOTP-based 2FA
- **Email Verification** - Account verification flow
- **Refresh Tokens** - Secure token refresh mechanism
- **Audit Logging** - Security event logging

## [0.3.0] - 2025-10-15

### Added
- **Multi-currency Support** - 160+ currencies with exchange rates
- **Labels & Tags** - Hierarchical categorization
- **Accounts** - Multiple account management
- **Recurring Transactions** - Automatic transaction scheduling

## [0.2.0] - 2025-10-01

### Added
- **JWT Authentication** - Secure API authentication
- **User Management** - Registration, login, password reset
- **MongoDB Integration** - Document database for transactions
- **Basic CRUD** - Transaction create, read, update, delete

## [0.1.0] - 2025-09-15

### Added
- Initial project setup
- .NET 9 API with minimal APIs
- React + TypeScript frontend with Vite
- TailwindCSS styling
- Basic project structure

---

## Version Policy

### Semantic Versioning
- **MAJOR** (X.0.0): Breaking API changes, database migrations
- **MINOR** (0.X.0): New features, non-breaking changes
- **PATCH** (0.0.X): Bug fixes, security updates

### Dependency Policy
- **Warning**: Packages 1+ major versions behind
- **Failure**: Packages 2+ major versions behind
- Updates reviewed monthly for security and features