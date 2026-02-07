# Changelog

All notable changes to DigiTransac will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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