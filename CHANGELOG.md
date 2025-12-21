# Changelog

All notable changes to DigiTransac will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
