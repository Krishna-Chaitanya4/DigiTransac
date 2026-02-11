# DigiTransac - Project Context for AI Assistants

## Project Overview
DigiTransac is a full-stack digital transaction tracker that helps users manage their personal finances with features like transaction tracking, transfers between accounts, recurring transactions, P2P payments, budgeting, spending map visualization, and analytics.

## Tech Stack

### Backend (./api)
- **.NET 9** Web API with Minimal APIs
- **MongoDB** database with async driver and configurable connection pooling
- **MediatR** for domain events and CQRS patterns
- **FluentValidation** for request validation
- **JWT Authentication** with HS256
- **AES-256-GCM Encryption** for sensitive data (envelope encryption with per-user DEK wrapped by KEK)
- **SignalR** for real-time notifications
- **Serilog** for structured logging with file and console sinks
- **Redis** (optional) for distributed caching via `IDistributedCache`
- **OpenTelemetry** for distributed tracing
- **Swashbuckle** for Swagger/OpenAPI documentation

### Frontend (./web)
- **React 19** with TypeScript
- **Vite 7** build tool with PWA support
- **TanStack Query (React Query)** for server state management
- **TanStack Virtual** for virtualized lists
- **Tailwind CSS 4** for styling with dark mode
- **React Router** for navigation
- **Leaflet.js** for map visualization
- **Chart.js** for analytics charts

### Testing (./tests)
- **xUnit** test framework
- **Moq** for mocking
- **TestContainers** for MongoDB integration tests
- **FluentAssertions** for assertions

## Architecture Patterns

### Service Layer (./api/Services/Transactions/)
The transaction handling is split into focused services:
- `TransactionCoreService` - CRUD operations
- `TransferService` - Account-to-account transfers
- `RecurringTransactionService` - Scheduled recurring transactions
- `TransactionAnalyticsService` - Analytics and reporting
- `TransactionExportService` - CSV/JSON export
- `TransactionBatchService` - Batch operations (bulk delete, status updates)
- `TransactionMapperService` - DTO mapping with encryption/decryption
- `P2PTransactionService` - Peer-to-peer transactions
- `TransactionServiceFacade` - Unified interface implementing `ITransactionService`

### Design Patterns Used
1. **Unit of Work** (`./api/Services/UnitOfWork/`) - MongoDB transaction management with graceful fallback for standalone instances
2. **Result Pattern** (`./api/Common/Result.cs`) - Type-safe `Result<T>` with `Error` records, `DomainErrors` catalog, and extension methods (`Map`, `Bind`, `Match`, `Ensure`, `ToApiResult()`)
3. **Domain Events** (`./api/Events/`) - MediatR-based event publishing for decoupled notifications and cache invalidation
4. **Repository Pattern** (`./api/Repositories/`) - Data access abstraction
5. **Facade Pattern** - `TransactionServiceFacade` provides unified API over split services
6. **Partial Classes** - `AuthService` split into 7 partial class files for maintainability without interface/DI changes

### Caching (`./api/Services/Caching/`)
- `ICacheService` interface with tag-based invalidation, pattern removal, and `GetOrCreateAsync`
- `MemoryCacheService` - In-memory caching with `IMemoryCache` (default)
- `RedisCacheService` - Redis-backed distributed caching via `IDistributedCache` (when `Redis:ConnectionString` configured)
- `CacheKeys` - Centralized cache key definitions
- `CacheInvalidationHandler` - MediatR handler that invalidates cache on domain events
- Conditional registration: Redis when connection string present, otherwise in-memory

### Rate Limiting
- 6 rate limit policies: global, auth, sensitive, per-user, transaction-create, export
- Configured via `RateLimitSettings` in `appsettings.json`
- Can be disabled via `DISABLE_RATE_LIMITING` environment variable

### Middleware Pipeline (`./api/Middleware/`)
- `GlobalExceptionHandlerMiddleware` - RFC 7807 Problem Details with exception-to-status mapping
- `RequestLoggingMiddleware` - Structured request/response logging with sensitive path redaction

### Observability
- **OpenTelemetry** integration (`./api/Extensions/OpenTelemetryExtensions.cs`) - Distributed tracing for HTTP, MongoDB, and custom activities
- **Structured Logging** - Serilog with enriched context (RequestId, HttpMethod, StatusCode, ElapsedMs, UserId)
- **ETag Support** - Content-based SHA256 ETags with `If-None-Match` / 304 Not Modified (`./api/Common/ETagHelper.cs`)

## Key Features

### Spending Map (`./web/src/pages/SpendingMapPage.tsx`)
- **Location-based transaction visualization** using Leaflet.js
- **Category color-coded markers** with clustering
- **Heatmap view** for spending density
- **Trip detection** - groups transactions by geographic region
- **Location insights** - "You spent ₹X near home"
- **Dark mode** with CartoDB dark tiles

### Budget Management (`./web/src/pages/BudgetsPage.tsx`)
- **Category-based budgets** with customizable limits
- **Multi-period support** - weekly, monthly, yearly
- **Rollover budgets** for unused amounts
- **Visual progress indicators** with warning thresholds
- **Budget notifications** when approaching/exceeding limits

### Chat & P2P Transactions (`./web/src/pages/ChatsPage.tsx`)
- **WhatsApp-style messaging** with real-time updates via SignalR
- **Transaction cards** embedded in messages with category icons
- **Personal chat** for self-transactions and transfers
- **Mobile responsive** with slide-in panels
- **Message search** and reply functionality

### Analytics Dashboard (`./web/src/pages/InsightsPage.tsx`)
- **Income vs Expenses** breakdown
- **Top spending categories** with progress bars
- **Spending patterns** - by day of week and time
- **Monthly trends** chart
- **Spending anomalies** detection
- **Draggable widget ordering**

## Key Files

### Configuration
- `./api/appsettings.json` - App configuration (MongoDB pool settings, rate limits, JWT, encryption, Redis, etc.)
- `./api/Settings/AppSettings.cs` - Strongly-typed settings classes (`MongoDbSettings`, `JwtSettings`, `EncryptionSettings`, `RateLimitSettings`, `SecuritySettings`)
- `./web/vite.config.ts` - Vite config with API proxy (port 5000)

### Extension Methods (`./api/Extensions/`)
- `ApplicationServiceExtensions.cs` - Core service DI registration (auth, transaction, caching, validation, MediatR)
- `MongoDbServiceExtensions.cs` - MongoDB and repository registration with health checks
- `SecurityServiceExtensions.cs` - JWT auth, CORS, rate limiting
- `SwaggerExtensions.cs` - OpenAPI/Swagger configuration
- `OpenTelemetryExtensions.cs` - Distributed tracing setup
- `ConfigurationExtensions.cs` - Settings binding from `IConfiguration`
- `MiddlewareExtensions.cs` - HTTP pipeline configuration
- `ResultExtensions.cs` - `Result<T>` to `IResult` HTTP response mapping

### API Endpoints (`./api/Endpoints/`)
Transaction endpoints are split into focused files:
- `TransactionEndpoints.cs` - Route group coordinator
- `TransactionCrudEndpoints.cs` - CRUD operations with ETag support
- `TransactionAnalyticsEndpoints.cs` - Analytics with ETag + 304 Not Modified
- `TransactionBatchEndpoints.cs` - Batch operations
- `TransactionExportEndpoints.cs` - CSV/JSON export

Auth endpoints are split similarly:
- `AuthEndpoints.cs` - Route group coordinator
- `AuthCoreEndpoints.cs` - Login, register, refresh
- `AuthAccountEndpoints.cs` - Profile, delete account
- `AuthPasswordEndpoints.cs` - Password change/reset/forgot

Other endpoints:
- `AccountEndpoints.cs` - Account CRUD
- `BudgetEndpoints.cs` - Budget management
- `ConversationEndpoints.cs` - Chat & P2P
- `TwoFactorEndpoints.cs` - 2FA setup/verify

### Frontend State
- `./web/src/hooks/useTransactionQueries.ts` - React Query hooks for transactions
- `./web/src/hooks/useBudgetQueries.ts` - Budget management hooks
- `./web/src/hooks/useConversationQueries.ts` - Chat hooks with optimistic updates
- `./web/src/hooks/useOffline.ts` - Offline support with IndexedDB caching
- `./web/src/lib/queryClient.ts` - Query client configuration with error handling
- `./web/src/services/apiClient.ts` - HTTP client wrapper

### Models
- `./api/Models/Transaction.cs` - Transaction entity with location support
- `./api/Models/Budget.cs` - Budget entity
- `./api/Models/Dto/TransactionDto.cs` - Request/response DTOs

## Common Tasks

### Running the Application
```bash
# Backend (port 5000)
cd api && dotnet run

# Frontend (port 5173, proxies /api to backend)
cd web && npm run dev
```

### Running Tests
```bash
# Unit tests
cd tests && dotnet test

# Integration tests (requires Docker for TestContainers)
cd tests && dotnet test --filter "Category=Integration"
```

### Database
- MongoDB connection string in `appsettings.json`
- Database name: `digitransac`
- Collections: `users`, `accounts`, `transactions`, `labels`, `tags`, `chatMessages`

## Important Notes

1. **Transactions on MongoDB Standalone**: The Unit of Work pattern gracefully handles MongoDB standalone instances by catching `NotSupportedException` and falling back to non-transactional execution.

2. **Encryption**: User data is encrypted using envelope encryption. Each user has a DEK (Data Encryption Key) wrapped with a KEK (Key Encryption Key).

3. **P2P Transactions**: Send/Receive transactions can be linked to counterparty users. Pending P2P transactions need to be confirmed by the recipient.

4. **Recurring Transactions**: Template-based recurring transactions with configurable frequency (daily, weekly, monthly, etc.). Background service processes due recurring transactions.

5. **Optimistic UI Updates**: Frontend uses optimistic updates for delete/status changes - targets only `['transactions', 'list']` queries to avoid cache structure mismatches.

6. **Location Data**: Transactions can have optional location (lat/long, place name, city, country). Used for Spending Map visualization.

7. **Offline Support**: IndexedDB-based caching for locations and messages. Offline queue for pending actions synced when back online.

8. **PWA Features**: Service Worker for offline caching, installable as desktop/mobile app.

## UI/UX Patterns

### Error Handling
- **Error Boundaries** - Specialized for Map, Chat, and Charts
- **Toast Notifications** - For success/error feedback
- **Skeleton Loaders** - During data fetching

### Performance
- **Lazy Loading** - All pages lazy loaded with React.lazy()
- **Virtualized Lists** - For transaction lists (VirtualizedTransactionList)
- **Lazy Emoji Picker** - Heavy component loaded on demand

### Accessibility
- **ARIA Labels** - Comprehensive labeling throughout
- **Keyboard Navigation** - Full keyboard support
- **Screen Reader** - Proper role attributes and live regions

### Dark Mode
- **System-aware** - Respects OS preference
- **Persistent** - Saves preference to localStorage
- **Leaflet Maps** - CartoDB dark tiles for dark mode

## Recent Changes (Feb 2026)

### Architecture Refactoring (Feb 11, 2026)
- **Result Pattern** - Migrated `ITransactionCoreService` and `IAuthService` from tuple returns to `Result<T>` with `DomainErrors`
- **Program.cs Refactor** - Extracted service registration and middleware pipeline into extension methods (~62 line Program.cs)
- **Endpoint Splitting** - Split monolithic `TransactionEndpoints.cs` into 4 focused files, `AuthEndpoints.cs` into 4 focused files
- **AuthService Splitting** - Split into 7 partial class files (Registration, Login, Account, Password, Token, Helpers, core)
- **Global Exception Handler** - RFC 7807 Problem Details middleware replacing inline exception handling
- **Content-based ETags** - SHA256-based content hashing with `If-None-Match` / 304 Not Modified support
- **Redis Caching** - Added `RedisCacheService` with conditional registration (Redis or in-memory fallback)
- **MongoDB Pool Config** - Connection pool, timeout, and retry settings now configurable via `appsettings.json`
- **Request Logging** - Structured logging middleware with sensitive path redaction and timing
- **CurrencyFormatter** - Extracted shared utility from duplicated formatting logic
- **Cache Keys** - Centralized `CacheKeys` static class for consistent cache key naming
- **Notification DTOs** - Extracted to dedicated `Models/Dto/NotificationDto.cs`
- **Security Fixes** - SSL validation fix, ETag fix, validator sync, transactional deletion, KeyVault guard
- **DI Audit** - Verified all service lifetime registrations are correct

### New Features (Feb 2026)
- **Spending Map** - Leaflet.js visualization with markers, clustering, heatmap, trip grouping
- **Budget Management** - Full CRUD with notifications and rollovers
- **Location Insights** - "You spent ₹X near home" analysis
- **Trip Grouping** - Automatic detection of travel spending
- **Category Icons in Chat** - Transaction cards show category badge
- **Dark Mode Maps** - CartoDB dark tiles
- **Skeleton Loaders** - For map, chat, trips
- **Error Boundaries** - Specialized for map/chat/charts
- **Offline Support** - IndexedDB caching for locations and messages

### Architecture Improvements (Jan 2026)
- Split monolithic `TransactionService` into focused services
- Added Unit of Work pattern with MongoDB transactions
- Implemented Result pattern for error handling
- Added MediatR domain events
- Improved frontend error handling with toast notifications
- Added API versioning support
- Enhanced caching strategy
- Added comprehensive test coverage
- Integration tests with MongoDB TestContainers
- OpenTelemetry distributed tracing
- Per-user rate limiting