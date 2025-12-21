# Changelog

All notable changes to DigiTransac will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
