# Changelog

All notable changes to DigiTransac will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.8] - 2025-12-28

### Fixed
- **502 CORS Error**: Fixed nginx proxy Origin header configuration
- Changed from hardcoded `Origin: https://digitransac.com` to pass-through `Origin: $http_origin`
- Backend was rejecting requests with "Not allowed by CORS" due to missing/incorrect Origin
- Now properly forwards the actual Origin header from client requests
- Resolves 502 Bad Gateway errors on login and all API calls

## [1.2.7] - 2025-12-28

### Fixed
- **405/404 Login Error**: Added nginx proxy configuration to forward `/api` requests to backend
- Frontend nginx was treating API calls as file requests instead of proxying to backend
- Login and all API requests now properly routed through nginx to backend service
- **User Error Messages**: Better error messages - no more technical HTTP codes shown to users
  - 405: \"Service temporarily unavailable. Please try again in a moment\"
  - 500+: \"Server error. Please try again later\"
  - Default: \"Login failed. Please check your credentials and try again\"

### Changed
- Added `/api` location block in nginx.conf to proxy requests to backend
- Removed duplicate CI/CD workflow files (ci-checks.yml, deploy-backend.yml, deploy-frontend.yml)
- Now using only main-ci-cd.yml as single source of truth
- Eliminates redundant workflow executions

## [1.2.6] - 2025-12-28

### Fixed
- **CI/CD Workflow**: Prevented duplicate workflow runs on PR merge
- Removed `closed` type from pull_request trigger events
- When a PR is merged, only the push to main event triggers workflows now
- Eliminates 5 duplicate workflow executions on every merge
- **User Error Messages**: Improved 405 error message from "Login failed (Error 405)" to "Service temporarily unavailable. Please try again in a moment"
- All error codes now show user-friendly messages instead of technical HTTP status codes
- **Nginx API Proxy**: Added proxy configuration to forward `/api` requests from frontend to backend
- Fixed CORS issues by properly routing API calls through the frontend domain

### Added
- **Performance Optimizations** (Industry Standard):
  - Nginx: Gzip compression with optimal settings (comp_level 6, min_length 1024)
  - Nginx: Connection pooling and buffer optimizations
  - MongoDB: Connection pool (maxPoolSize: 50, minPoolSize: 10)
  - MongoDB: Compression enabled (zlib)
  - Nginx: Static asset caching (1 year for immutable assets)
  - Nginx: HTML no-cache policy for index.html
  
- **Security Enhancements** (OWASP Recommendations):
  - Added Referrer-Policy header: "strict-origin-when-cross-origin"
  - Added Permissions-Policy header (blocks geolocation, microphone, camera)
  - Client request timeouts to prevent slowloris attacks
  - Buffer size limits to prevent buffer overflow
  - Deny access to hidden files
  - Proper timeout settings for proxy connections (60s)

### Changed
- Pull request workflows now only run for: `opened`, `synchronize`, `reopened`
- Reduced unnecessary CI/CD runs and GitHub Actions usage
- Error messages for all HTTP status codes are now clear and actionable:
  - 405: "Service temporarily unavailable. Please try again in a moment"
  - 500+: "Server error. Please try again later"
  - Default: "Login failed. Please check your credentials and try again"
- Nginx proxy now sets correct Host header for backend CORS validation
- Nginx proxy adds Origin header for proper CORS handling

## [1.2.5] - 2025-12-28

### Fixed
- **Authentication Errors**: HTTP 405 Method Not Allowed error during login
- Removed problematic 308 redirect middleware for legacy API routes
- Legacy routes (`/api/auth`, `/api/users`, etc.) now mounted directly alongside v1 routes
- Both `/api/auth/login` and `/api/v1/auth/login` now work correctly

### Improved
- **Error Messages**: User-friendly error messages for login and registration
- Backend now provides specific field information for duplicate errors (e.g., "Email is already registered")
- Frontend displays clear messages based on HTTP status codes:
  - 401: "Invalid username/email/phone or password"
  - 409: "This username, email, or phone number is already registered"
  - 429: "Too many attempts. Please try again later"
  - Network errors: "Please check your connection"
- No more technical errors like "HTTP 405" or "Error registering user" shown to users
- Better duplicate key error handling with specific field identification

## [1.2.4] - 2025-12-27

### Fixed
- **CI/CD Pipeline**: Deployment jobs now only trigger on main branch push
- Removed incorrect `pull_request.merged` condition that caused duplicate deployments
- CI validation jobs still run on all PRs as expected
- Follows industry standard: CI on PRs, CD only on main

### Changed
- Deploy conditions simplified to `github.event_name == 'push' && github.ref == 'refs/heads/main'`

## [1.2.3] - 2025-12-27

### Changed
- **Refactoring**: Renamed `cosmosdb.ts` to `mongodb.ts` for accurate naming
- Renamed `CosmosDBService` class to `MongoDBService`
- Updated all service references from `cosmosDBService` to `mongoDBService`
- Replaced all "Cosmos DB" references with "MongoDB" in logs and comments

### Fixed
- Email and phone indexes now use `sparse: true` option
- Allows multiple users to register without email or phone (prevents duplicate key violations)
- Fixes "Duplicate key violation on Index 'email_1'" error for phone-only registrations

### Added
- Unique index on username field for data integrity

## [1.2.2] - 2025-12-27

### Fixed
- CORS middleware blocking production health check endpoints
- Health check endpoints (`/ping` and `/health`) now execute before CORS middleware
- Resolves 500 errors during GitHub Actions deployment health checks

## [1.2.1] - 2025-12-27

### Fixed
- Version synchronization across all version files for CI/CD pipeline

## [1.2.0] - 2025-12-27

### Added
- **Azure Key Vault Integration**: Enterprise-grade secret management
  - Centralized KeyVaultService for all secret access
  - Lazy initialization pattern for proper dotenv timing
  - Support for both development (Azure CLI) and production (Managed Identity)
  - Secret caching for performance optimization
- **Comprehensive CI/CD Pipeline**: Industry-standard automated deployment
  - Secret scanning and Key Vault validation
  - Backend: linting, TypeScript compilation, tests with coverage
  - Frontend: linting and production builds
  - Dependency vulnerability scanning (npm audit)
  - Version consistency checks
  - Multi-stage Docker builds with verification
  - Automated deployment to Azure on PR merge
  - Health checks and production smoke tests
  - Code coverage reporting to Codecov
- **GitHub Secrets Management**: Automated setup script for CI/CD
  - Service Principal creation and configuration
  - Automatic retrieval of Azure resource URLs
  - One-command GitHub Secrets configuration

### Changed
- **Database Migration**: Moved from Azure Cosmos DB to Azure DocumentDB M10 FREE tier
  - Cost reduction: ₹7,150/month → ₹0/month (99% savings)
  - 32GB storage with shared vCore architecture
  - Updated connection string format for DocumentDB
- **Security Architecture**: "Key Vault everywhere" pattern
  - All secrets moved from environment variables to Azure Key Vault
  - JWT-Secret: Fetched from Key Vault on first authentication
  - Master-Encryption-Key: Fetched from Key Vault during service initialization
  - MongoDB-ConnectionString: Fetched from Key Vault on startup
  - Zero secrets in code, containers, or environment files
- **Docker Compose**: Simplified for production testing only
  - Removed development volume mounts
  - Production-like builds for local testing
  - Clearer documentation about daily development workflow
- **Environment Configuration**: Streamlined to Key Vault requirements
  - Removed: COSMOS_ENDPOINT, COSMOS_KEY, JWT_SECRET, MASTER_ENCRYPTION_KEY
  - Required: AZURE_KEY_VAULT_URL only
  - Updated .env.example files to reflect Key Vault architecture
- **Documentation**: Simplified and focused on essentials
  - README.md: Crisp, essential information only
  - Removed temporary migration documentation
  - Focus on long-term maintainable content

### Fixed
- **Version Management**: Package.json now syncs with VERSION files
- **Prettier Formatting**: All TypeScript files properly formatted
- **BOM Characters**: Removed from VERSION files for CI compatibility

### Removed
- **Temporary Documentation**: Cleanup of migration-specific docs
  - LEARNING_SYSTEM.md (feature-specific)
  - MIGRATION_MERCHANT_LEARNING.md (temporary)
  - OFFLINE.md (feature-specific)
  - CI-CD.md (one-time setup)
- **Setup Scripts**: One-time configuration scripts removed
  - setup-github-secrets.ps1 (GitHub Secrets now configured)
- **Legacy Workflows**: Redundant CI/CD workflows consolidated
  - security-scan.yml (CodeQL requires paid GitHub Advanced Security)
  - Kept main-ci-cd.yml as comprehensive pipeline

### Security
- **Enhanced Secret Management**
  - Azure Managed Identity for passwordless authentication
  - DefaultAzureCredential pattern (dev: az login, prod: Managed Identity)
  - RBAC-based Key Vault access control
  - Full audit trail for secret access
  - TLS 1.2+ encryption for all communications
- **CI/CD Security**
  - Automated secret scanning in pull requests
  - Dependency vulnerability scanning
  - No hardcoded secrets validation
  - Multi-stage Docker builds minimize attack surface

### Infrastructure
- **Cost Optimization**
  - Total monthly cost: ~₹50 (~$0.60)
  - Azure DocumentDB M10: FREE tier (32GB)
  - Azure Key Vault: Pay-per-operation (~₹50/month)
  - Azure Container Apps: Consumption plan (scales to zero)
  - Previous total: ₹7,150/month
  - **Savings: ₹7,100/month (99% reduction)**

## [1.1.0] - 2025-12-21

### Added - Infrastructure
- **Testing Infrastructure**: Complete Jest setup with TypeScript support
  - Sample health check tests included
  - Test coverage reporting configured
  - New scripts: `test:watch`, `test:coverage`
- **API Documentation**: Swagger/OpenAPI 3.0 integration
  - Interactive API docs at `/api-docs` endpoint
  - Complete schema definitions for all models
  - JWT authentication support in documentation
- **Code Quality Tools**: ESLint and Prettier configurations
  - Consistent code style enforcement
  - Automatic formatting capabilities
  - New scripts: `lint:fix`, `format`, `format:check`
- **Pre-commit Hooks**: Husky + lint-staged integration
  - Automatic linting and formatting before commits
  - Prevents bad code from entering repository
- **CI/CD Enhancements**: Security scanning workflows
  - Weekly npm audit scans
  - Dependency review on pull requests
  - CodeQL analysis for security vulnerabilities
- **Dependabot**: Automated dependency update management
  - Weekly checks for npm, GitHub Actions, and Docker
  - Grouped updates with appropriate labels

### Added - Backend
- **Environment Validation**: Startup validation for all required env variables
  - Validates JWT secret minimum length (32 chars)
  - Validates URI formats for endpoints
  - Fails fast with clear error messages
- **Request Size Limits**: 10MB limits on JSON and URL-encoded payloads
- **Dependencies**: jest, ts-jest, supertest, husky, lint-staged, prettier, swagger-jsdoc, swagger-ui-express

### Added - Frontend  
- **Dependencies**: eslint-plugin-react, eslint-plugin-react-hooks, husky, lint-staged, prettier

### Changed - Security
- **Removed sensitive credentials from git**: Google OAuth client_secret file untracked
- **Enhanced .gitignore**: Patterns added to exclude all OAuth credential files
- **Enhanced .dockerignore**: Exclude test files, configs, and dev dependencies from builds

### Changed - CI/CD
- **Enhanced ci-checks.yml**: Now enforces linting, formatting, and test coverage
- **Build optimization**: Smaller Docker images with improved .dockerignore

## [1.0.15] - 2024-12-21

### Added - Frontend
- **Review Queue feature** for managing pending transactions
  - New page at `/pending` for reviewing imported transactions
  - Real-time badge count in navigation menu (auto-refreshes every 60 seconds)
  - Filter by source: All, Email, SMS
  - Sort by: Date, Amount, Confidence score
  - Confidence badges (High ≥80%, Medium ≥50%, Low <50%)
  - Source badges (Email, SMS) with color coding
  - Bulk approve/reject actions with selection checkboxes
  - Empty state with "All Caught Up!" message
  - Error handling with retry functionality
  - Material-UI components throughout
- **Review Queue** menu item in sidebar navigation

### Added - Backend
- New Transaction model fields:
  - `reviewStatus`: 'pending' | 'approved' | 'rejected'
  - `reviewedAt`: Timestamp of approval/rejection
  - `rejectionReason`: User-provided reason for rejection
  - `confidence`: 0-100 parser confidence score
  - `originalContent`: Raw email/SMS content for reference
- 5 new API endpoints for pending transaction management:
  - `GET /api/transactions/pending/count` - Get badge count
  - `PATCH /api/transactions/:id/approve` - Approve single transaction
  - `PATCH /api/transactions/:id/reject` - Reject single transaction with optional reason
  - `POST /api/transactions/bulk-approve` - Approve multiple transactions
  - `POST /api/transactions/bulk-reject` - Reject multiple transactions with optional reason

### Changed - Frontend
- Fixed transaction API response handling to use `.data.transactions` property
- Updated sidebar menu text from "Pending" to "Review Queue" for clarity

## [1.0.14] - 2024-12-20

### Added - Frontend
- Dynamic currency formatting with 20+ supported currencies
  - USD, EUR, GBP, INR, JPY, CNY, AUD, CAD, CHF, SEK, NZD, SGD, HKD, KRW, BRL, MXN, ZAR, AED, SAR
- New currency utility (`src/utils/currency.ts`) with locale-specific formatting
- Currency symbol display based on user preference

### Changed - Frontend
- All pages now use dynamic currency instead of hardcoded `$` symbol
  - Dashboard, Transactions, Accounts, Budgets, Analytics, Categories
- All API calls now use axios `baseURL` configuration

### Fixed - Frontend
- Empty dashboard data handling for new users
- TypeScript compilation errors (unused imports removed)

## [1.0.2] - 2024-12-19

### Added - Backend
- Runtime configuration endpoint (`/api/config`)
- CORS configuration for multiple origins
- Improved error handling for configuration failures

### Changed - Frontend
- Implemented runtime configuration fetching (industry standard)
- Removed hardcoded API_URL from build artifacts
- Updated nginx configuration

### Fixed - Backend
- CORS to handle multiple origins properly
- Config service fallback mechanism

## [1.0.0] - 2024-12-18

### Added - Initial Release
- User authentication with JWT
- Transaction management (credit/debit)
- Account management (multiple accounts support)
- Category management (hierarchical categories)
- Budget tracking with alerts
- Analytics and reporting
- Gmail integration for transaction parsing
- Email polling service
- Transaction splits support
- Recurring transactions
- Tag-based organization
- Azure Cosmos DB integration
- Docker containerization
- Azure Container Apps deployment

---

## Version Format

**Format:** `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backward-compatible)
- **PATCH**: Bug fixes (backward-compatible)

## Categories

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security fixes
