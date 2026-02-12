# Changelog

All notable changes to DigiTransac will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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