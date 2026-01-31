# DigiTransac - Project Context for AI Assistants

## Project Overview
DigiTransac is a full-stack digital transaction tracker that helps users manage their personal finances with features like transaction tracking, transfers between accounts, recurring transactions, P2P payments, and analytics.

## Tech Stack

### Backend (./api)
- **.NET 8** Web API with Minimal APIs
- **MongoDB** database with async driver
- **MediatR** for domain events and CQRS patterns
- **FluentValidation** for request validation
- **JWT Authentication** with HS256
- **AES-256 Encryption** for sensitive data (envelope encryption with DEK/KEK)

### Frontend (./web)
- **React 18** with TypeScript
- **Vite** build tool
- **TanStack Query (React Query)** for server state management
- **Tailwind CSS** for styling
- **React Router** for navigation

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
2. **Result Pattern** (`./api/Common/Result.cs`) - Type-safe error handling without exceptions
3. **Domain Events** (`./api/Events/`) - MediatR-based event publishing for decoupled notifications
4. **Repository Pattern** (`./api/Repositories/`) - Data access abstraction
5. **Facade Pattern** - `TransactionServiceFacade` provides unified API over split services

### Caching
- `MemoryCacheService` (`./api/Services/Caching/`) - In-memory caching with configurable TTL
- Cache invalidation via domain event handlers

### Rate Limiting
- Per-user rate limiting configured in `AppSettings.cs`
- Prevents API abuse with configurable limits

### Observability
- OpenTelemetry integration (`./api/Extensions/OpenTelemetryExtensions.cs`)
- Distributed tracing for HTTP, MongoDB, and custom activities

## Key Files

### Configuration
- `./api/appsettings.json` - App configuration
- `./api/Settings/AppSettings.cs` - Strongly-typed settings
- `./web/vite.config.ts` - Vite config with API proxy (port 5000)

### API Endpoints
- `./api/Endpoints/TransactionEndpoints.cs` - Transaction API routes
- `./api/Endpoints/AccountEndpoints.cs` - Account API routes
- `./api/Endpoints/AuthEndpoints.cs` - Authentication routes

### Frontend State
- `./web/src/hooks/useTransactionQueries.ts` - React Query hooks for transactions
- `./web/src/lib/queryClient.ts` - Query client configuration with error handling
- `./web/src/services/apiClient.ts` - HTTP client wrapper

### Models
- `./api/Models/Transaction.cs` - Transaction entity
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

## Recent Changes (Jan 2026)

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