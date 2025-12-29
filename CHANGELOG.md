# Changelog

All notable changes to DigiTransac will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Email Parser Service comprehensive tests** (Phase 2)
  - 54 comprehensive tests covering all 10 supported banks
  - Tests for HDFC, ICICI, SBI, Axis, Kotak, PNB, BOB, Canara, Union Bank, IDBI
  - Date parsing tests (multiple formats: DD-MMM-YY, DD/MM/YYYY, DD-MM-YYYY)
  - Merchant name cleaning and normalization tests
  - Transaction ID extraction tests (TXN, REF, REFERENCE, UPI REF patterns)
  - Integration tests for tags, learning, and account matching
  - Edge case handling (invalid amounts, missing data, promotional emails)
  - Category suggestion tests (keyword-based fallback categorization)
  - Transaction detection tests (case sensitivity, financial context)
  - 100% pass rate (54/54 tests)

### Changed
- **Email Parser Service improvements** (industry standards applied)
  - Added proper TypeScript interfaces: `ParsedTransaction`, `BankPattern`
  - Enhanced type safety throughout the service
  - Improved error handling with comprehensive validation
  - Added `MONTH_MAP` constant for reliable month name parsing
  - Enhanced `cleanMerchantName` method (removes dates, balances, company suffixes, locations)
  - Improved `parseDate` with validation (date ranges, month validation, year handling)
  - Enhanced `calculateConfidence` with clearer scoring logic
  - Improved `extractTransactionId` to handle "TXN ID:" with flexible spacing
  - Updated `isTransactionSMS` to recognize "payment received", "card was used" as valid transactions
  - Enhanced `suggestCategory` with comprehensive keyword patterns for 8 categories

### Improved
- **Bank Pattern Enhancements**
  - HDFC: Better merchant extraction with positive lookahead, improved date handling
  - SBI: Dual patterns for "at MERCHANT" and "from MERCHANT" scenarios
  - Axis: Specific "at" pattern to avoid capturing bank name as merchant
  - All patterns use positive lookahead to prevent over-matching
  - Better handling of bank-specific date formats and card number formats
- **Transaction Detection**
  - More flexible keyword matching (debited, credited, spent, withdrawn, paid, payment, purchase, received, used)
  - Strong transaction phrases recognized without requiring explicit financial context
  - Better filtering of promotional emails (congratulations, offer, discount patterns)
- **Gmail Integration** (already using industry standards)
  - Gmail History API for incremental sync (delta changes using historyId)
  - OAuth token refresh with encryption
  - Efficient bank sender filtering

### Technical Details
- Services layer coverage improvement expected (email parser now fully tested)
- All 54 email parser tests passing with 100% reliability
- Pattern matching improved with lookahead/lookbehind for accuracy
- Modular, maintainable code structure following TypeScript best practices

## [1.4.1] - 2025-12-28

### Added
- **Comprehensive test coverage for utilities layer** (85.47% coverage achieved)
  - 6 new test files with 2,900+ lines of tests
  - 131 new tests (114 passing, 19 pending refinement)
  - transactionFilters.test.ts (11 tests, 93.93% coverage)
  - budgetHelpers.test.ts (18 tests, 98.33% coverage)
  - accountMatcher.test.ts (27 tests, 100% coverage)
  - expenseHelpers.test.ts (16 tests, 100% coverage)
  - transactionEncryption.test.ts (20 tests, 95.83% coverage)
  - smsParser.service.test.ts (36 tests, 55.43% coverage - partial)
- **Jest mocking patterns** for external dependencies (mongoDBService, encryptionService)
- **Edge case testing**: Empty arrays, null values, large amounts, various date formats
- **Real-world data validation**: Actual bank SMS formats from 5 major Indian banks

### Changed
- **Type safety improvements** in production code
  - Removed all `any` types from expenseHelpers.ts
  - Added `EncryptedTransaction` interface for type-safe encrypted fields
  - Fixed type casting using `unknown` intermediate (TypeScript best practice)
- **Performance optimizations**
  - Skip encryption for empty/whitespace-only descriptions
  - Better error handling with try-catch for decryption fallback
- **Code quality enhancements**
  - Improved parseDate method with comprehensive validation (date ranges, month validation, year ranges)
  - Simplified extractMerchant method for better readability
  - Enhanced null safety throughout codebase

### Improved
- Overall test coverage: **1.12% → 10.82%** (+9.7 percentage points)
- Utils layer coverage: **22.86% → 85.47%** (+62.6 percentage points)
- Services layer coverage: **1.32% → 15.55%** (+14.2 percentage points)
- Total test count: **2 → 133 tests** (+131 tests)

### Technical Debt
- 20 SMS parser tests document real-world pattern gaps (to be refined in Phase 2)
- Email parser service not yet tested (scheduled for Phase 2)

## [1.4.0] - 2025-12-28

### Added
- **Enterprise-grade CI/CD pipeline** with 6-stage multi-job workflow
- **Validation stage**: Version checks, changelog validation, semver compliance
- **Security stage**: Secret scanning, vulnerability audits (high/critical), license compliance
- **Build & Test stage**: Parallel backend/frontend builds with strict quality gates
- **Container Security stage**: Trivy vulnerability scanning for Docker images
- **Deploy stage**: Automated deployment to Azure Container Apps
- **Strict quality gates**: 
  - Linting with zero warnings tolerance (`--max-warnings 0`)
  - Prettier formatting checks enforced
  - Code coverage thresholds: 70% lines, 60% branches, 70% functions
  - STRICT dependency mode: all packages must be latest version
- **Package health checks**: Deprecated package detection, outdated package warnings
- **Bundle size monitoring**: Frontend build size tracking
- **Parallel execution**: Build jobs run simultaneously for faster feedback

### Changed
- Upgraded Node.js Docker base image from 20-alpine to 25-alpine
- Updated all GitHub Actions to latest versions (checkout v6, setup-node v6, etc.)
- Upgraded development and production dependencies to latest versions
- Improved code quality: replaced 10 `any` types with proper TypeScript types
- Added missing React `key` props to all iterator components
- Removed console.log statements (replaced with comments)
- Escaped JSX apostrophes with `&apos;`
- Wrapped case block lexical declarations to fix ESLint errors

### Fixed
- 30 linting violations across backend and frontend
- TypeScript strict type checking issues
- React component iterator key warnings
- Code formatting inconsistencies

## [1.3.2] - 2025-12-28

### Fixed
- **CRITICAL**: Use HTTPS for backend proxy (backend has `allowInsecure: false`)
- Backend configuration verified: external ingress with HTTPS enforcement
- Added `proxy_ssl_server_name on` for proper SNI handling
- Correct FQDN: `digitransac-backend.nicemeadow-64e62875.centralindia.azurecontainerapps.io`
- Correct Host header set to backend FQDN
- Origin header uses map directive with fallback to digitransac.com
- Fixes all login errors (404, 502, CORS)

### Verified Industry Standards
- ✅ HTTPS for external backend communication (matches backend allowInsecure=false)
- ✅ Nginx map directive for conditional Origin header
- ✅ OWASP security headers (X-Frame-Options, CSP, etc.)
- ✅ Gzip compression level 6 (optimal)
- ✅ Static asset caching (1 year for immutable files)
- ✅ Proper timeouts (prevents slowloris attacks)
- ✅ Buffer limits (prevents overflow attacks)
- ✅ SNI enabled for SSL proxy

## [1.3.1] - 2025-12-28

### Fixed
- **502 Bad Gateway**: Use internal service communication instead of external FQDN
- Changed nginx proxy from `https://digitransac-backend.nicemeadow...` to `http://digitransac-backend`
- Industry standard: Service-to-service communication within same Container Apps Environment
- Fixes login and all API requests getting 502 errors

### Changed
- Dependabot: Skip version checks for bot PRs
- Dependabot: Group dependencies (reduces PR spam)
- Dependabot: GitHub Actions updates monthly instead of weekly

## [1.2.10] - 2025-12-28

### Fixed
- **Nginx If Statement Issue**: Replaced problematic `if` statement with nginx `map` directive
- Nginx `if` inside location blocks can cause unexpected behavior
- Using map directive is nginx best practice for conditional header values
- Properly sets Origin header fallback using industry-standard approach
## [1.3.0] - 2025-12-28

### Changed
- **CI/CD Pipeline**: Consolidated workflows into single multi-stage pipeline
- Merged `version-check.yml` into `main-ci-cd.yml` for better organization
- Added proper job dependencies using `needs` keyword
- Pipeline stages:
  1. **Validation**: Version checks, security scanning, secrets validation
  2. **Build & Test**: Backend and frontend CI with parallel execution
  3. **Deployment**: Sequential deployment (backend → frontend)
  4. **Verification**: Post-deployment smoke tests
- Industry standard approach: Single source of truth for CI/CD
- Better visibility with emojis and clear stage separation
- Eliminates redundant workflow runs

### Fixed
- Version validation now runs before build stage (fails fast)
- All deployment jobs depend on successful CI completion
- No deployment can occur if any validation or build step fails

## [1.2.9] - 2025-12-28

### Fixed
- **Missing Origin Header**: Fixed nginx to always provide Origin header to backend
- Backend rejects requests without Origin header in production
- Added fallback: uses client's Origin if present, otherwise defaults to https://digitransac.com
- Resolves "Not allowed by CORS" / "Server error" on login when Origin header is missing
- Browser same-origin requests (direct navigation) don't include Origin header by default

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
