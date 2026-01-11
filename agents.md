# DigiTransac - Complete Project Blueprint

---

## 🔍 CURRENT STATE: .NET 10 + React Implementation (MIGRATION IN PROGRESS)

### **Backend Features Already Built** ✅
- ✅ **Authentication:** JWT tokens (7-day expiry), BCrypt password hashing, role-based access
- ✅ **Categories:** Full hierarchy support (folders + categories), search, stats, soft delete
- ✅ **Accounts:** Multi-type support (credit_card, debit_card, bank_account, cash, upi, wallet)
- ✅ **Transactions:** 
  - CRUD with advanced search and filtering
  - Transaction splits (divide expense across multiple categories)
  - Recurring transactions with cron jobs
  - Transaction review workflow (pending/approved/rejected)
  - Encryption for sensitive data at rest
- ✅ **Budgets:**
  - Category-based budgets with rollover support
  - Tag-based budgets (complex AND/OR logic)
  - Multi-threshold alerts (in-app, email)
  - Flexible period support (this-month, next-month, this-year, custom)
- ✅ **Analytics:**
  - Spending overview (date range, filtering by account/category/tags)
  - Monthly trends and comparisons
  - Category breakdown
  - Top merchants analysis
- ✅ **Tags:** Full CRUD, multi-tag per transaction, tag-based filtering
- ✅ **Email Integration:**
  - Gmail OAuth integration with CSRF protection
  - Incremental delta sync using Gmail History API
  - Receipt parsing with pattern matching
  - Bank pattern customization (user can add custom bank patterns)
  - Email parsing service with transaction extraction
- ✅ **SMS Integration:**
  - SMS-to-transaction parsing service
  - SMS route for manual SMS parsing
- ✅ **Core Infrastructure:**
  - Swagger/OpenAPI documentation
  - Rate limiting (global + auth-specific)
  - Structured logging (Pino) with correlation IDs
  - Request validation with Joi
  - Error handling with consistent response format
  - Database indexes for performance
  - CORS configuration for React frontend
  - Azure Key Vault integration for secrets

### **Frontend Features Already Built** ✅
- ✅ **Authentication Pages:** Login, Register with JWT token storage
- ✅ **Dashboard:** Key metrics (income, expense, net), transaction list, budget status
- ✅ **Categories Page:** Hierarchical tree view, search, filter, sort, CRUD operations
- ✅ **Accounts Page:** Account cards, multi-type support, balance display
- ✅ **Transactions Page:** Advanced search, filters (date, category, account, tags), pagination
- ✅ **Budgets Page:** Progress bars, alert thresholds, period selection
- ✅ **Analytics Page:** Charts (spending by category, trends), date range selection, export
- ✅ **User Profile:** User settings, preferences
- ✅ **UI/UX:**
  - Material Design 3 (MUI v7)
  - Purple/Blue gradient theme
  - Dark mode support
  - Responsive mobile-first design
  - Loading skeletons & spinners
  - Toast notifications (Snackbar)
  - Smooth animations (300ms transitions)

### **Quality & Reliability** ✅
- ✅ **Testing:**
  - Unit tests for utilities and services
  - Jest coverage setup
  - API tests with health checks
  - Component tests for React
- ✅ **Performance:**
  - Vite build (fast dev server)
  - React Query for caching (reduces API calls)
  - Pagination in transactions (default 50, max 1000)
  - Database indexes on frequently queried fields
  - Encrypted transaction search (search on decrypted data in memory)
- ✅ **Observability:**
  - Structured logging with request IDs
  - Swagger API documentation
  - Health check endpoints
- ✅ **Offline Support:**
  - PWA with service worker
  - IndexedDB for offline caching
  - Offline API class with local persistence

### **Data Model (MongoDB)** ✅
```
Collections:
- Users (auth, profile)
- Categories (hierarchy, metadata)
- Accounts (PaymentMethods)
- Transactions (main ledger)
- TransactionSplits (expense allocation)
- Budgets (spending limits + rollover)
- Tags (custom labels)
- EmailIntegrations (Gmail OAuth tokens)
- BankPatterns (user-defined SMS/email patterns)
```

### **Deployment** ✅
- **Infrastructure:** Azure Container Apps (low-cost production)
- **Database:** Azure Cosmos DB (MongoDB API)
- **Secrets:** Azure Key Vault
- **CI/CD:** GitHub Actions (build, test, deploy)
- **Monitoring:** Application Insights (optional)

### **What's NOT Yet Done**
- ❌ Mobile app (PWA in progress, but not fully tested)
- ❌ Advanced ML features (anomaly detection, recommendations)
- ❌ Bank API integrations (Plaid, Yodlee)
- ❌ Tax reporting features
- ❌ Invoice/receipt OCR
- ❌ Multi-user collaboration (shared accounts)
- ❌ Goals & targets feature
- ❌ Performance optimization (already good, but could be better)
- ❌ Microservices architecture (monolithic Node.js API)

---

### **Migration Status: Phase 1 Auth Complete ✅**

**What's Done:**
- ✅ Phase 1: Authentication System (.NET backend) - 100% complete
  - User registration with BCrypt password hashing (work factor 12)
  - JWT dual-token strategy (15-min access, 14-day refresh)
  - Token rotation pattern (old tokens automatically revoked)
  - Complete error handling and input validation
  - All 8 test cases passing
  - API build successful (all 4 projects compile in ~2.2s)

**What's Next:**
- 🔄 Phase 1.B: React Frontend (login/register pages, Auth context) - Pending
- ⏳ Phase 2: Categories (.NET backend) - Queued
- ⏳ Phase 3: Accounts & Transactions - Queued

**Migration Strategy:**
- Keep Node.js API running as fallback during migration
- Gradually migrate features (auth → categories → accounts → transactions)
- Use shared MongoDB for data compatibility
- Test each phase thoroughly before moving to next
- Cutover traffic after React frontend is complete

---

## 🎯 PART 1: PRODUCT VISION & GOALS

### **Core Purpose**
DigiTransac is a **comprehensive personal finance management platform** that digitalizes and automates transaction tracking, categorization, and analysis. It replaces manual expense tracking with intelligent, unified visibility into all financial transactions across multiple accounts and sources.

### **Primary Goal**
Enable users to **spend less time managing finances** and **more time making better financial decisions** through:
- Zero-friction transaction capture (email, SMS, manual entry)
- Intelligent auto-categorization
- Real-time budget tracking
- Powerful analytics and insights

---

## 📋 PART 2: CORE FEATURES (MVP & Beyond)

### **Tier 1: MVP Features** (Phase 1-3)
These are minimum viable product—without these, the app is not useful.

#### **1. Multi-Account Management**
- Add/manage bank accounts, credit cards, cash wallets
- Multi-currency support (USD, EUR, INR, GBP, etc.)
- Account type indicators (Bank/Credit/Cash/Investment)
- Real-time balance tracking
- Account reconciliation helpers

#### **2. Transaction Capture & Management**
- Manual transaction entry (income/expense/transfer)
- Bulk import (CSV, bank statements)
- Email/SMS receipt parsing (auto-extract from Gmail/Outlook/SMS)
- Transaction search and filtering (date range, amount, account, category)
- Transaction editing/deletion with history
- Recurring transaction setup (auto-duplicate on schedule)
- Split transactions (divide one expense across categories)

#### **3. Intelligent Categorization**
- Pre-built category hierarchy (Income, Expenses, Transfers)
- Custom folder structure for organizing categories
- Smart auto-categorization (ML-ready, v1 = rules-based)
- Merchant learning (remember Starbucks → Coffee category)
- Category rename/move/delete with cascading updates
- Category usage statistics (how many transactions, total amount)

#### **4. Budget Management**
- Set monthly/yearly budgets per category
- Real-time spending alerts (10%, 50%, 90%, 100% of budget)
- Budget vs. actual visualization
- Period-based budget switching (Jan vs Feb budgets, etc.)
- Budget performance reports

#### **5. Basic Analytics & Reporting**
- Dashboard with key metrics (total income, total expense, net, balance)
- Spending by category (pie chart, bar chart)
- Monthly trend analysis (income/expense trends)
- Top merchants/categories
- Income vs. expense breakdown
- Date range reports (custom date picker)

#### **6. User Authentication & Security**
- User registration and login (email-based)
- JWT token-based authentication
- Secure password storage (BCrypt hashing)
- Session management (auto-logout after inactivity)
- Logout with token invalidation

---

### **Tier 2: Advanced Features** (Phase 4-6)
Game-changers for power users, but not blocking MVP.

#### **7. Advanced Analytics**
- Recurring expense detection (find patterns)
- Seasonal trends (compare same month across years)
- Category velocity (spending acceleration/deceleration)
- Savings rate calculation
- Net worth tracking (assets - liabilities)
- Forecasting (predict future spending)

#### **8. Tags & Labeling**
- Custom tags for transactions (e.g., "Trip", "Business", "Charity")
- Multi-tag assignment per transaction
- Tag-based filtering and search
- Tag usage analytics
- Tag-based budgets (budget for all "Trip" tagged expenses)

#### **9. Goals & Targets**
- Savings goals (amount + deadline)
- Spending targets (don't exceed X/month)
- Goal progress tracking
- Goal-based analytics

#### **10. Insights & Recommendations**
- ML-powered anomaly detection (unusual spending)
- Category-specific insights ("You spent 20% more on Food this month")
- Merchant-based recommendations
- Budget optimization suggestions

#### **11. Multi-User & Collaboration**
- Shared accounts (family/couple budgeting)
- User roles (Owner, Viewer, Editor)
- Shared category hierarchies
- Expense splitting between users
- Activity log (who did what, when)

#### **12. Mobile & PWA Support**
- Responsive mobile UI
- Progressive Web App (offline support)
- Mobile-optimized transaction entry
- Push notifications (budget alerts)
- Apple/Google Pay integration (future)

---

### **Tier 3: Future / Nice-to-Have** (Phase 7+)
Differentiators, but not essential for launch.

#### **13. Integration Ecosystem**
- Bank API integrations (Plaid, Yodlee)
- Google Sheets export
- Slack notifications
- IFTTT integration
- Zapier support

#### **14. Invoice & Receipt Management**
- Receipt image upload
- OCR (extract text from receipt photos)
- Receipt linking to transactions
- Tax category marking (for tax deductions)

#### **15. Tax Reporting**
- Tax category marking
- Tax summary generation
- Export for accountants (PDF/Excel)
- Multi-year tax comparison

#### **16. Expense Forecasting & Budgeting**
- AI-powered budget recommendations
- "What-if" budget scenarios
- Savings rate optimization

---

## � PART 2.5: FUNCTIONAL CAPABILITIES (What Users Can DO)

### **🎯 Core Problem DigiTransac Solves**
Users struggle with scattered financial data across multiple accounts, no visibility into spending patterns, and manual tracking is tedious. **DigiTransac centralizes everything and automates insights.**

---

### **📊 Core Functionalities**

#### **1. CAPTURE & ORGANIZE Transactions**
- **Manual Entry:** Income, expense, or transfer transactions with date, amount, category, notes
- **Auto-Capture:** Extract transactions from Gmail (with OAuth), SMS messages
- **Bulk Import:** CSV/Excel bank statements with column mapping
- **Account Assignment:** Route transactions to correct account (bank/credit/cash/wallet/UPI)
- **Split Transactions:** Divide one transaction across multiple categories (e.g., groceries → Food + Household)
- **Recurring Automation:** Set up recurring transactions (weekly/bi-weekly/monthly/quarterly/yearly)
- **Search & Filter:** By date range, amount, category, tags, merchants, account
- **Transaction History:** Edit/delete with audit trail

#### **2. STRUCTURE & CATEGORIZE Spending**
- **Hierarchical Structure:** Create unlimited nested category folders (e.g., Expenses → Food → Groceries)
- **Smart Auto-Categorization:** Rules-based pattern matching (rules-based in v1, ML in v2)
- **Merchant Learning:** Remember merchant-to-category mappings (Starbucks → Coffee)
- **Multi-Tag Assignment:** Label transactions with custom tags (Trip, Business, Charity, etc.)
- **Flexible Tagging:** AND/OR logic for complex tag combinations
- **Category Management:** Rename, move, delete with cascading updates
- **Category Stats:** See total spending per category, transaction count, trends

#### **3. BUDGET & MONITOR Spending**
- **Category Budgets:** Set monthly/yearly spending limits by category
- **Tag-Based Budgets:** Budget for all expenses with specific tags (all "Trip" expenses)
- **Complex Budget Logic:** Combine multiple categories/tags with AND/OR operators
- **Real-Time Alerts:** Notifications at 10%, 50%, 90%, 100% of budget threshold
- **Rollover Feature:** Carry unused budget to next month (optional, configurable)
- **Budget Performance:** Visual progress bars, budget vs. actual comparison
- **Period Flexibility:** January budget ≠ February budget (customize per month)

#### **4. ANALYZE & GAIN INSIGHTS**
- **Dashboard Overview:** Income, expense, net balance, account balances at a glance
- **Spending Analytics:** Pie charts, bar charts, spending by category/merchant/account
- **Trends & Patterns:** Month-to-month comparison, year-over-year trends, seasonal analysis
- **Advanced Metrics:** 
  - Recurring expense detection (find patterns you didn't know existed)
  - Category velocity (spending acceleration/deceleration)
  - Savings rate calculation
  - Net worth tracking (assets - liabilities)
  - Top merchants, top categories
- **Custom Reports:** Date range selection, filter by category/account/tags
- **Export:** PDF/Excel reports for external use (accountant, tax prep, etc.)

#### **5. MANAGE MULTIPLE ACCOUNTS**
- **Multi-Account Support:** Unlimited bank accounts, credit cards, cash wallets, UPI, Apple Pay
- **Account Types:** Different handling for each type (credit card payments, bank transfers, cash tracking)
- **Multi-Currency:** USD, EUR, INR, GBP, JPY, etc. with automatic conversion (future)
- **Balance Tracking:** Real-time balance per account
- **Account Reconciliation:** Helper to match transactions to bank statements
- **Segregated View:** See all accounts or filter to specific account

#### **6. STAY SECURE & PRIVATE**
- **User Authentication:** Email/password registration with verification
- **Secure Login:** JWT token-based authentication (15-min access, 14-day refresh)
- **Password Security:** BCrypt hashing (adaptive, salted)
- **Data Encryption:** Sensitive fields encrypted at rest (MongoDB field-level)
- **HTTPS/TLS:** All data in transit encrypted
- **Access Control:** Only logged-in user can see their financial data
- **Session Management:** Auto-logout after inactivity
- **Audit Trail:** All sensitive actions logged (login, logout, data changes)
- **GDPR Compliance:** Export all data, delete account anytime

#### **7. Advanced Insights (v2+)**
- **ML-Powered Anomaly Detection:** "You spent 30% more this month than usual"
- **Personalized Recommendations:** "You can save $X if you reduce Food spending"
- **Spending Forecast:** Predict next month's spending based on patterns
- **Goals & Targets:** Save $X by Y date, spending limits with progress tracking
- **What-If Scenarios:** See impact of changing budget allocations

#### **8. Multi-User & Collaboration (v2+)**
- **Shared Accounts:** Family or couple can share one account view
- **User Roles:** Owner (full control), Editor (add/modify transactions), Viewer (read-only)
- **Shared Budgets:** Set family budgets across shared account
- **Expense Splitting:** Split expense between users (e.g., couple split dinner 50/50)
- **Activity Log:** Who did what and when

#### **9. Integration Ecosystem (v2+)**
- **Bank API Integration:** Auto-sync transactions from banks (Plaid, Yodlee, Open Banking APIs)
- **Email Integration:** Gmail/Outlook with CSRF protection, incremental sync
- **SMS Integration:** Auto-parse bank SMS notifications
- **Google Sheets:** Export transactions, budgets, analytics to Sheets
- **Slack:** Budget alerts, spending summaries via Slack
- **IFTTT/Zapier:** Create workflows (e.g., SMS → Transaction, Slack notification on budget alert)
- **Receipt OCR:** Upload photo, extract amount/merchant/date automatically

#### **10. Tax & Compliance Features (v2+)**
- **Tax Category Marking:** Tag expenses as tax-deductible, business expense, personal, etc.
- **Tax Summary:** Generate tax report by category or tag
- **Export for Accountants:** Formatted PDF/Excel reports for tax filing
- **Multi-Year Comparison:** Compare tax-relevant spending across years
- **Deduction Tracking:** Automatic calculation of deductible amounts

---

### **📱 Where Users Access DigiTransac**
- **Web Application:** Desktop/tablet browser (responsive)
- **Progressive Web App (PWA):** Mobile app-like experience, works offline, can install on home screen
- **Responsive Design:** Optimized for phones (< 5 min to add transaction)
- **Native Apps:** iOS/Android (future, post-MVP)

---

### **🎯 Key User Outcomes**
After using DigiTransac, users can:
1. ✅ See exactly where their money goes (real-time visibility)
2. ✅ Set and stick to budgets (automated alerts prevent overspending)
3. ✅ Reduce manual data entry by 80% (auto-capture from email/SMS)
4. ✅ Discover spending patterns (categories, trends, anomalies)
5. ✅ Make data-driven financial decisions (forecasting, recommendations)
6. ✅ Manage multiple accounts in one place (bank, credit, cash)
7. ✅ Share finances securely (family/couple mode)
8. ✅ Prepare for taxes easily (categorized, exportable)

---

## �🔐 PART 3: SECURITY & COMPLIANCE

### **Data Security**
- ✅ All sensitive data encrypted at rest (MongoDB field-level encryption)
- ✅ HTTPS/TLS for all data in transit
- ✅ Password hashing with BCrypt (min 10 rounds)
- ✅ JWT tokens with 7-day expiry (refresh token flow)
- ✅ No sensitive data in localStorage (only JWT, consider httpOnly cookies)
- ✅ API rate limiting (10 req/sec per user)
- ✅ Input validation on all endpoints
- ✅ SQL injection / XSS prevention (parameterized queries, CSP headers)

### **Authentication & Authorization**
- ✅ Email-based registration + email verification (v2)
- ✅ JWT Bearer token authentication
- ✅ Role-based access control (RBAC) - Owner, Viewer, Editor
- ✅ User data isolation (can't access other user's data)
- ✅ Audit log (all sensitive actions logged)
- ✅ 401/403 handling with automatic redirect to login

### **Privacy & Compliance**
- ✅ GDPR compliance (data export, account deletion)
- ✅ Privacy policy & Terms of Service
- ✅ No third-party tracking (no Google Analytics, no ads)
- ✅ User consent for integrations

### **Production Security**
- ✅ Azure Key Vault for secrets (API keys, DB passwords, JWT signing key)
- ✅ Environment-specific configurations (dev/stage/prod)
- ✅ CORS whitelisting (only trusted origins)
- ✅ Security headers (HSTS, X-Frame-Options, CSP)
- ✅ Dependency vulnerability scanning (dependabot, snyk)

---

## 🎨 PART 4: UI/UX STANDARDS

### **Design Philosophy**
- **Mobile-first:** Design for small screens, scale up
- **Simplicity:** 3-5 tap/click rule for common actions
- **Consistency:** Same components, patterns across app
- **Feedback:** Loading states, toast notifications, confirmations
- **Accessibility:** WCAG 2.1 AA (keyboard nav, screen readers, contrast)

### **Design System**
- **Color Scheme:** Purple/Blue gradient (modern, professional, financial)
- **Typography:** Open Sans (primary), Roboto Mono (data/numbers)
- **Component Library:** Material Design 3 (MUI v7)
- **Icons:** Material Icons
- **Animations:** 300ms ease-out (not jarring)
- **Spacing:** 8px grid (all margins/padding multiples of 8)

### **Key Screens**
1. Login/Register (clean, minimal)
2. Dashboard (key metrics at top, charts below)
3. Transactions (list, filters, actions)
4. Categories (hierarchy tree, search)
5. Accounts (cards, balance summary)
6. Budgets (progress bars, alerts)
7. Analytics (charts, trends, exports)
8. Settings (user profile, preferences, security)

---

## ⚡ PART 5: QUALITY & RELIABILITY

### **Testing Strategy**
- ✅ **Unit Tests:** 80%+ coverage for services, repositories, business logic
- ✅ **Integration Tests:** API endpoints + database (happy path + error cases)
- ✅ **Component Tests:** React components (render, user interactions)
- ✅ **E2E Tests:** Critical user flows (auth → categories → transactions → budgets)
- ✅ **Contract Tests:** Frontend ↔ Backend API compatibility
- ✅ **Load Testing:** 100 concurrent users, 1000 transactions/sec

### **Error Handling**
- ✅ Consistent error response format: `{ success: false, error: "...", code: "ERROR_CODE", details: {} }`
- ✅ Proper HTTP status codes (400, 401, 403, 404, 409, 500, 503)
- ✅ User-friendly error messages (no stack traces to frontend)
- ✅ Retry logic for transient failures (network, timeouts)
- ✅ Graceful degradation (fallback UI when API is slow)

### **Performance**
- ✅ API response time < 200ms (p95)
- ✅ Frontend First Contentful Paint < 2s
- ✅ Database query optimization (indexes on frequently filtered fields)
- ✅ Pagination for large datasets (default 50, max 1000)
- ✅ Caching strategy (React Query, Redis for API responses)
- ✅ Bundle size < 500KB (gzipped, frontend)

### **Observability**
- ✅ Structured logging (Serilog for .NET, Winston for Node)
- ✅ Correlation IDs (trace requests across services)
- ✅ Health check endpoints (liveness + readiness probes)
- ✅ Distributed tracing (OpenTelemetry)
- ✅ APM integration (Application Insights or similar)
- ✅ Real-time alerting (errors, slow queries, high CPU)

---

## 🛠️ PART 6: ARCHITECTURE DECISIONS & TECH STACK

### **Core Architecture Pattern**
**Clean Architecture (Layered Approach)**

```
┌─────────────────────────────────────────┐
│   Presentation Layer (API)              │
│   - Controllers                         │
│   - DTOs                                │
│   - Middleware                          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Application Layer (Core)              │
│   - Entities/Models                     │
│   - Business Logic                      │
│   - Interfaces/Abstractions             │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Infrastructure Layer                  │
│   - MongoDB Repositories                │
│   - External Services                   │
│   - Azure Key Vault                     │
└─────────────────────────────────────────┘
```

**Why Clean Architecture?**
- ✅ Clear separation of concerns
- ✅ Testable (mock repositories easily)
- ✅ Scalable (add features without breaking existing code)
- ✅ Industry standard (easier for team expansion)
- ✅ Framework-independent (business logic doesn't depend on MongoDB/Azure)

---

### **Technology Stack**

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 19 + TypeScript + Vite + MUI v7 | Ecosystem richness, React Query caching, Material Design 3 |
| **Backend** | ASP.NET Core 10 Web API + C# 13 | Performance (3-5x faster than Node.js), type safety, async-first |
| **Database** | Azure Cosmos DB for MongoDB | Flexible schema, ACID transactions, Azure-native, JSON-like |
| **ORM/Driver** | MongoDB.Driver for .NET | Official driver, full async support, LINQ queries |
| **Auth** | JWT (Access + Refresh tokens) | Stateless, scalable, industry standard |
| **API Design** | REST + OpenAPI/Swagger | Simple, well-documented, widely supported, auto-generate clients |
| **Validation** | FluentValidation | Clean, testable, reusable validation rules |
| **Logging** | Serilog | Structured logging, multiple sinks (console, file, Application Insights) |
| **Testing** | xUnit + Moq + FluentAssertions | Standard .NET testing tools |
| **DevOps** | Docker + GitHub Actions → Azure | Container-based deployment, CI/CD automation |
| **Secrets** | Azure Key Vault | Secure storage, Managed Identity, no hardcoded secrets |

---

### **Authentication & Security Architecture**

**Token Strategy: Dual-Token Flow (Production-Grade)**

```
Access Token:
- Lifetime: 15 minutes (short-lived)
- Storage: React state (memory, XSS-safe)
- Purpose: API authorization
- Format: JWT with claims (userId, email, username)

Refresh Token:
- Lifetime: 14 days (long-lived)
- Storage: httpOnly cookie (secure, SameSite=Strict)
- Purpose: Renew access tokens
- CSRF Protection: Custom header or double-submit cookie
```

**Authentication Flow:**
```
1. User Login:
   POST /api/auth/login { email, password }
   ← Returns: { accessToken } + Set-Cookie: refreshToken (httpOnly)

2. API Requests:
   GET /api/transactions
   Header: Authorization: Bearer <accessToken>

3. Token Expiry (after 15 min):
   → Access token expires
   → Axios interceptor catches 401
   → Auto-refresh: POST /api/auth/refresh (refreshToken in cookie)
   ← New accessToken returned
   → Retry original request

4. Refresh Token Expiry (after 14 days):
   → Both tokens invalid
   → Redirect to login
```

**Password Security:**
```csharp
// BCrypt with work factor 12 (adaptive hashing)
using BCrypt.Net;

// Registration
string hashedPassword = BCrypt.HashPassword(password, workFactor: 12);

// Login validation
bool isValid = BCrypt.Verify(password, storedHash);
```

**Security Features:**
- ✅ XSS Protection: Refresh token in httpOnly cookie (JS can't access)
- ✅ CSRF Protection: SameSite=Strict cookie + custom header validation
- ✅ Token Rotation: New refresh token issued on each refresh
- ✅ Adaptive Hashing: BCrypt work factor = 12 (2^12 iterations)
- ✅ Password Requirements: Min 8 chars, mix of upper/lower/digit/special
- ✅ Rate Limiting: 5 login attempts per 15 minutes per IP
- ✅ Audit Logging: All auth events logged (login, logout, refresh, failures)

**User Roles (v2 Ready):**
```csharp
// Reserved for multi-user expansion
public enum UserRole
{
    User = 0,   // Regular user (default for v1)
    Admin = 1   // Future: billing, support access
}

// User model includes role field (default: User)
// v1: All users are "User" role
// v2: Add admin capabilities when needed
```

**Implementation Details:**

**Backend (.NET):**
```csharp
// JWT generation
var claims = new[]
{
    new Claim(ClaimTypes.NameIdentifier, user.Id),
    new Claim(ClaimTypes.Email, user.Email),
    new Claim(ClaimTypes.Name, user.Username)
};

var accessToken = new JwtSecurityToken(
    issuer: "DigiTransac",
    audience: "DigiTransac",
    claims: claims,
    expires: DateTime.UtcNow.AddMinutes(15),
    signingCredentials: credentials
);

var refreshToken = GenerateSecureRandomToken(); // 32-byte random
// Store refreshToken hash in DB with userId + expiry
```

**Frontend (React):**
```typescript
// Auth Context with memory storage
const [accessToken, setAccessToken] = useState<string | null>(null);

// Axios interceptor for auto-refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken(); // Calls /auth/refresh
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

### **Database Architecture**

**Choice:** Azure Cosmos DB for MongoDB (MongoDB API)

**Why MongoDB over SQL?**
1. **Flexible Schema:** Email/SMS parsing from different banks = varying fields
2. **Future-Proof:** Receipt OCR, custom user fields, unpredictable data
3. **JSON-Native:** Direct mapping to React/TypeScript (no ORM impedance)
4. **Nested Data:** Transaction splits naturally nest in documents
5. **Azure Integration:** Cosmos DB offers ACID transactions + global distribution

**Collections Structure:**
```
Users
  ├── _id, email, username, passwordHash, fullName, currency
  └── emailIntegration (nested)

Categories
  ├── _id, userId, name, parentId, isFolder, path[]
  └── icon, color, metadata

Accounts
  ├── _id, userId, name, type, bankName, last4
  └── icon, color, isDefault

Transactions
  ├── _id, userId, accountId, type, amount, date
  ├── description, merchantName, notes, tags[]
  ├── isRecurring, recurrencePattern (nested)
  ├── reviewStatus, source
  └── parsedData (nested)

TransactionSplits
  ├── _id, transactionId, userId, categoryId, amount
  └── tags[], notes

Budgets
  ├── _id, userId, name, categoryIds[], includeTagIds[], excludeTagIds[]
  ├── amount, period, startDate, endDate
  ├── alertThresholds[], enableRollover
  └── rolledOverAmount

Tags
  ├── _id, userId, name, color
  └── usageCount

EmailIntegrations
  ├── userId, provider, email, accessToken, refreshToken
  └── lastProcessedAt, lastHistoryId, customBankPatterns[]

BankPatterns
  ├── _id, userId, bankName, senderPattern
  └── amountPattern, merchantPattern, datePattern, isActive
```

**Indexing Strategy:**
```javascript
// Users
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "username": 1 }, { unique: true })

// Categories
db.categories.createIndex({ "userId": 1, "name": 1 })
db.categories.createIndex({ "userId": 1, "parentId": 1 })

// Transactions (most queried)
db.transactions.createIndex({ "userId": 1, "date": -1 })
db.transactions.createIndex({ "userId": 1, "accountId": 1, "date": -1 })
db.transactions.createIndex({ "userId": 1, "reviewStatus": 1 })

// Budgets
db.budgets.createIndex({ "userId": 1, "startDate": 1 })

// TransactionSplits
db.transactionSplits.createIndex({ "transactionId": 1 })
db.transactionSplits.createIndex({ "userId": 1, "categoryId": 1 })
```

---

### **API Design & Contract**

**REST with OpenAPI Specification + Auto-Generated Clients**

**API Versioning:** `/api/v1/[controller]`
- All endpoints versioned from day one
- Future-proof for breaking changes
- Example: `/api/v1/transactions`, `/api/v1/categories`

**OpenAPI Client Generation (NSwag):**
```bash
# .NET generates OpenAPI spec at runtime
# React auto-generates TypeScript client
npm run generate:api
# → Creates src/generated/api with typed Axios client
```

**Benefits:**
- ✅ Single source of truth (.NET controllers → TypeScript interfaces)
- ✅ Compile-time type safety (catch API mismatches before runtime)
- ✅ Zero manual sync (regenerate on API changes)
- ✅ IntelliSense in React (auto-complete for API methods)

**Request Validation: FluentValidation**
```csharp
// Validators live in separate classes
public class CreateTransactionValidator : AbstractValidator<CreateTransactionDto>
{
    public CreateTransactionValidator()
    {
        RuleFor(x => x.Amount)
            .GreaterThan(0)
            .WithMessage("Amount must be positive");
            
        RuleFor(x => x.Date)
            .NotEmpty()
            .LessThanOrEqualTo(DateTime.UtcNow)
            .WithMessage("Date cannot be in the future");
            
        RuleFor(x => x.CategoryId)
            .NotEmpty()
            .WithMessage("Category is required");
    }
}

// Automatically registered via DI
builder.Services.AddValidatorsFromAssemblyContaining<CreateTransactionValidator>();
```

**Pagination Strategy: Offset-Based**
```csharp
// Controller action
[HttpGet]
public async Task<ActionResult<PagedResult<Transaction>>> GetTransactions(
    [FromQuery] int page = 1,
    [FromQuery] int size = 50)
{
    var skip = (page - 1) * size;
    var transactions = await _transactionRepo
        .Find(t => t.UserId == userId)
        .Skip(skip)
        .Take(Math.Min(size, 1000)) // Max 1000 per request
        .ToListAsync();
        
    return new PagedResult<Transaction>
    {
        Data = transactions,
        Page = page,
        PageSize = size,
        TotalCount = await _transactionRepo.CountAsync()
    };
}
```

**Standard Response Format:**
```json
// Success
{
  "success": true,
  "data": { /* entity or array */ },
  "message": "Operation completed"
}

// Paginated Success
{
  "success": true,
  "data": [ /* items */ ],
  "page": 1,
  "pageSize": 50,
  "totalCount": 1234,
  "totalPages": 25
}

// Validation Error
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "amount", "message": "Amount must be positive" },
    { "field": "date", "message": "Date cannot be in the future" }
  ]
}

// Business Logic Error
{
  "success": false,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Account balance too low for this transaction"
}
```

**HTTP Status Codes:**
- `200 OK` - Success (GET, PUT, PATCH)
- `201 Created` - New resource created (POST)
- `204 No Content` - Success with no body (DELETE)
- `400 Bad Request` - Validation error, business rule violation
- `401 Unauthorized` - Authentication required (missing/invalid token)
- `403 Forbidden` - Insufficient permissions (valid token, wrong role)
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Duplicate resource (unique constraint violation)
- `422 Unprocessable Entity` - Semantic validation error
- `500 Internal Server Error` - Unhandled exception
- `503 Service Unavailable` - Database down, external service unavailable

---

## � ARCHITECTURE DECISIONS SUMMARY

### **✅ All Core Decisions Locked**

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Database** | Azure Cosmos DB for MongoDB | Flexible schema, ACID transactions, Azure-native, JSON-like |
| **Architecture** | Clean Architecture (Layered) | Testable, scalable, clear separation of concerns |
| **Backend** | ASP.NET Core 10 + C# 13 | Performance, type safety, async-first, enterprise features |
| **Frontend** | React 19 + TypeScript + Vite | Ecosystem, React Query, fast dev experience |
| **ORM** | MongoDB.Driver for .NET | Official driver, async support, LINQ queries |
| **Auth Strategy** | JWT (15min access + 14day refresh) | Production-grade security, XSS protection, token rotation |
| **Token Storage** | Access: Memory, Refresh: httpOnly cookie | XSS-safe refresh, CSRF protection |
| **Password Hashing** | BCrypt (work factor 12) | Adaptive, industry standard, brute-force resistant |
| **API Versioning** | `/api/v1/[controller]` | Future-proof, side-by-side deployment |
| **Validation** | FluentValidation | Clean, testable, separates concerns |
| **OpenAPI Client** | Auto-generate with NSwag | Type-safe, single source of truth, zero drift |
| **Pagination** | Offset-based (skip/take) | Simple for UI, EF Core optimized |
| **Logging** | Serilog | Structured logging, multiple sinks |
---

## 📐 ARCHITECTURE DECISIONS SUMMARY

### **✅ All Core Decisions Locked**

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Database** | Azure Cosmos DB for MongoDB | Flexible schema, ACID transactions, Azure-native, JSON-like |
| **Deployment** | Azure Container Apps + Static Web Apps | Serverless, auto-scaling, low ops overhead |
| **Environments** | Dev (local) + Prod (Azure) | Staging added later if needed |
| **Secrets** | Azure Key Vault (Prod), GitHub Secrets (Bootstrap) | Secure, Managed Identity ready |
| **CI/CD** | GitHub Actions → Azure Container Registry | Native integration, simple YAML workflows |
| **Monitoring** | Application Insights (basic tier) | Request traces, exceptions, performance metrics |
| **Backup** | Azure default backups | 7 days retention, sufficient for v1 |
| **Data Migration** | None (start with empty DB) | Test data only from Node.js, clean slate |

### **Design Principles**
1. **Clean Code:** Follow SOLID principles, DRY, separation of concerns
2. **Type Safety:** Strong typing in C# + TypeScript, no `any` types
3. **Security First:** OWASP guidelines, secure defaults, audit logging
4. **Performance:** Indexes, pagination, caching, async/await everywhere
5. **Testability:** Dependency injection, interfaces, mocks
6. **Maintainability:** Consistent patterns, clear naming, documentation
7. **Scalability:** Stateless API, horizontal scaling ready
8. **Observability:** Structured logs, correlation IDs, health checks

---

## �📅 PART 7: IMPLEMENTATION ROADMAP

### **Phase 1: Foundations** (2-3 weeks)
- [ ] Auth system (login/register/JWT/refresh tokens)
- [ ] API skeleton with error handling, logging, CORS
- [ ] React project setup with routing, auth context
- [ ] Database schema design
- [ ] CI/CD pipeline (build + deploy on main)

### **Phase 2: Core Features** (4-5 weeks)
- [ ] Categories (CRUD, hierarchy, search)
- [ ] Accounts (multi-currency, balance tracking)
- [ ] Transactions (CRUD, search, filters, pagination)
- [ ] Dashboard (key metrics)

### **Phase 3: Advanced Features** (3-4 weeks)
- [ ] Budgets (monthly budgets, alerts)
- [ ] Basic Analytics (charts, trends)
- [ ] Tags (assign, filter, stats)
- [ ] Recurring transactions

### **Phase 4: Polish & Scale** (2-3 weeks)
- [ ] Email/SMS receipt parsing
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] E2E tests + load testing
- [ ] Documentation + user guide

### **Phase 5: Launch** (1 week)
- [ ] UAT (user acceptance testing)
- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Post-launch support

---

## 📊 SUCCESS METRICS

### **Product Metrics**
- User retention (% of users active after 30 days)
- Daily active users (DAU) and monthly active users (MAU)
- Transactions tracked per user (avg)
- Budget compliance rate (% of budget-setting users who stick to budgets)

### **Technical Metrics**
- API uptime: 99.5%+
- API response time: < 200ms (p95)
- Error rate: < 0.1%
- Frontend load time: < 2s (p95)

### **User Satisfaction**
- NPS (Net Promoter Score): > 50
- Error-free usage session rate: > 95%
- Feature adoption rate: > 60% for each new feature

---

## 📝 MIGRATION NOTES

- **Old Stack:** Node.js + React (keep as reference, gradual migration)
- **Coexistence:** Both backends can run in parallel during migration
- **Data:** Shared MongoDB during transition, then cutover
- **Users:** Gradual rollout (canary → 25% → 50% → 100%)

---

---

## � PART 8: DETAILED IMPLEMENTATION PHASES

### **Phase 1: Categories** ✅ COMPLETE

**Backend (.NET API):**
- [x] Project structure (Core, Infrastructure, API) - **.NET 10**
- [x] Category.cs model with MongoDB attributes
- [x] ICategoryRepository interface
- [x] CategoryRepository implementation
- [x] CategoriesController with CRUD endpoints
- [x] MongoDB/Cosmos DB connection via Azure Key Vault
- [x] CORS configuration for React
- [x] Swagger/OpenAPI documentation
- [x] **Build successful!**
- [x] **API tested and working!**

**Frontend (React):**
- [x] Beautiful Categories.tsx page (2198 lines) ✨
- [x] Hierarchical tree view with expand/collapse
- [x] Search with debouncing (300ms)
- [x] Filter by type (All/Folder/Category)
- [x] Sort by (Name/Usage/Recent)
- [x] MUI v7 with gradients and animations
- [x] API_BASE_URL updated to .NET API
- [ ] Test all CRUD operations with .NET backend
- [ ] Fix any TypeScript interface mismatches

**API Endpoints:**
```
GET    /api/categories          - Get all categories with stats
POST   /api/categories          - Create new category
PUT    /api/categories/{id}     - Update category
DELETE /api/categories/{id}     - Delete category
```

**Testing Checklist:**
- [ ] Create category
- [ ] Create folder
- [ ] Edit category
- [ ] Delete category
- [ ] Search categories
- [ ] Filter by type
- [ ] Sort categories
- [ ] Expand/collapse folders
- [ ] Parent-child relationships

---

### **Phase 2: Accounts** 📅 PLANNED

**Backend (.NET API):**
- [ ] Account.cs model (multi-currency support)
- [ ] IAccountRepository interface
- [ ] AccountRepository implementation
- [ ] AccountsController
- [ ] Currency enum (USD, EUR, INR, etc.)
- [ ] Balance calculation logic

**Frontend (React):**
- [ ] Accounts.tsx page with beautiful cards
- [ ] Multi-currency support
- [ ] Account creation dialog
- [ ] Balance display with formatting
- [ ] Account type indicators (Bank/Cash/Credit)

**API Endpoints:**
```
GET    /api/accounts           - Get all accounts
POST   /api/accounts           - Create account
PUT    /api/accounts/{id}      - Update account
DELETE /api/accounts/{id}      - Delete account
GET    /api/accounts/{id}/balance - Get current balance
```

---

### **Phase 3: Transactions** 📅 PLANNED

**Backend (.NET API):**
- [ ] Transaction.cs model with splits support
- [ ] ITransactionRepository interface
- [ ] TransactionRepository with advanced queries
- [ ] TransactionsController
- [ ] Pagination support (skip/take)
- [ ] Date range filtering
- [ ] Category/Account filtering
- [ ] Encryption for sensitive data

**Frontend (React):**
- [ ] Transactions.tsx with infinite scroll
- [ ] Advanced search and filters
- [ ] Date range picker
- [ ] Transaction form with splits
- [ ] Recurring transaction setup
- [ ] Import from email/SMS

**API Endpoints:**
```
GET    /api/transactions        - Get paginated transactions
GET    /api/transactions/{id}   - Get single transaction
POST   /api/transactions        - Create transaction
PUT    /api/transactions/{id}   - Update transaction
DELETE /api/transactions/{id}   - Delete transaction
GET    /api/transactions/search - Advanced search
```

---

### **Phase 4: Budgets** 📅 PLANNED

**Backend (.NET API):**
- [ ] Budget.cs model
- [ ] IBudgetRepository interface
- [ ] BudgetRepository with spending calculations
- [ ] BudgetsController
- [ ] Period-based budgets (monthly/yearly)
- [ ] Category-based budget tracking

**Frontend (React):**
- [ ] Budgets.tsx with progress bars
- [ ] Visual spending indicators
- [ ] Budget alerts/warnings
- [ ] Period selection
- [ ] Beautiful charts (Recharts)

---

### **Phase 5: Analytics** 📅 PLANNED

**Backend (.NET API):**
- [ ] AnalyticsController with aggregation
- [ ] Spending trends by category
- [ ] Monthly/yearly comparisons
- [ ] Top categories/merchants
- [ ] Income vs Expense reports

**Frontend (React):**
- [ ] Analytics.tsx with stunning charts
- [ ] Interactive visualizations
- [ ] Date range selection
- [ ] Export to PDF/Excel
- [ ] Dashboard widgets

---

### **Phase 6: Tags** 📅 PLANNED

**Backend (.NET API):**
- [ ] Tag.cs model
- [ ] ITagRepository interface
- [ ] TagRepository
- [ ] TagsController
- [ ] Tag usage statistics

**Frontend (React):**
- [ ] Tags management in Categories page
- [ ] Tag assignment in transactions
- [ ] Tag filtering
- [ ] Tag replacement on delete

---

### **Phase 7: Authentication & Security** � IN PROGRESS

**Backend (.NET API):**
- [x] User.cs model with email, username, password hash
- [x] IUserRepository interface
- [x] UserRepository implementation
- [x] AuthController with login/register endpoints
- [x] Password hashing with BCrypt
- [x] JWT token generation (7-day expiry, sign with key from config/env)
- [x] JwtSettings configuration and bearer auth middleware
- [ ] Refresh tokens (TODO: add /api/auth/refresh endpoint)
- [ ] Role-based authorization
- [ ] Email verification (optional)
- [ ] Password reset flow (optional)

**API Endpoints:**
```
POST   /api/auth/register       - Register new user
POST   /api/auth/login          - Login user
POST   /api/auth/refresh        - Refresh JWT token (TODO)
POST   /api/auth/logout         - Logout user (TODO)
```

**Frontend (React):**
- [x] Login/Register pages exist
- [x] Call .NET API endpoints with correct payload
- [x] JWT stored in localStorage as `auth-token`
- [x] Protected routes via `PrivateRoute` component
- [x] Auth context/provider set up
- [ ] Logout functionality (clear token, API call optional)
- [ ] Handle 401 responses and redirect to login

**Database:**
- [x] User collection created
- [x] Unique indexes on email and username
- [ ] Email verification status field (optional)
- [ ] Password reset token field (optional)

---

## 🔧 Configuration

### **Backend (.NET API)**

**Environment Variables (Dev):**
```bash
# JWT Configuration
JWT_ISSUER=DigiTransac
JWT_AUDIENCE=DigiTransac
JWT_SIGNING_KEY=DEV_ONLY_CHANGE_ME__DigiTransac_SigningKey_AtLeast_32_Chars

# MongoDB/Cosmos
MONGODB_CONNECTION_STRING=mongodb://localhost:27017  # or Cosmos URI
MONGODB_DATABASE_NAME=DigiTransacDB

# Azure Key Vault (optional in dev, required in prod)
AZURE_KEY_VAULT_URL=https://digitransac.vault.azure.net/
```

**appsettings.json:**
```json
{
  "Jwt": {
    "Issuer": "DigiTransac",
    "Audience": "DigiTransac",
    "SigningKey": "DEV_ONLY_CHANGE_ME__DigiTransac_SigningKey_AtLeast_32_Chars"
  },
  "MongoDB": {
    "ConnectionString": "mongodb://localhost:27017",
    "DatabaseName": "DigiTransacDB"
  }
}
```

**Run Commands:**
```bash
cd E:\personal\DigiTransac\DigiTransac.Net\src\DigiTransac.API
dotnet run
# API runs on http://localhost:5253
```

### **Frontend (React)**
```typescript
// src/config/api.ts
export const API_BASE_URL = 'https://localhost:5253/api';
```

**Run Commands:**
```bash
cd E:\personal\DigiTransac\frontend
npm run dev
# App runs on http://localhost:5173
```

---

## 🚀 Quick Start (Phase 1 + Auth Testing)

### **Prerequisites:**
1. MongoDB running on `localhost:27017` OR Cosmos DB connection string set
2. Azure Key Vault URL (optional in dev, required in prod)

### **Setup Steps:**

**1. Start .NET API:**
```bash
cd E:\personal\DigiTransac\DigiTransac.Net\src\DigiTransac.API
dotnet run
# Output: 🚀 DigiTransac.NET API is running!
#         Now listening on: http://localhost:5253
```

**2. Start React Frontend:**
```bash
cd E:\personal\DigiTransac\frontend
npm run dev
# Output: ➜  Local:   http://localhost:5173/
```

**3. Test Authentication:**
- Open http://localhost:5173/login in browser
- Click "Register" to create a new account
- Fill in: email, username, password, full name
- Backend will:
  - Hash password with BCrypt
  - Generate 7-day JWT token with user claims
  - Return: `{ success: true, token: "jwt...", user: {...} }`
- React will:
  - Store token in localStorage as `auth-token`
  - Store user object in localStorage as `auth-user`
  - Set Bearer auth header on all API requests
  - Redirect to Categories page (protected route)

**4. Test Categories:**
- Navigate to Categories page (should not redirect if authenticated)
- Test CRUD operations

---

## 📊 Progress Tracking

### Overall Migration Status
- ✅ **Phase 1 (Categories):** 100% complete
  - Backend: 100% ✅ (REST API, MongoDB driver, CORS)
  - Frontend: 95% (UI complete, needs CRUD testing with JWT auth)
- ⏳ **Phase 2 (Accounts):** 0%
- ⏳ **Phase 3 (Transactions):** 0%
- ⏳ **Phase 4 (Budgets):** 0%
- ⏳ **Phase 5 (Analytics):** 0%
- ⏳ **Phase 6 (Tags):** 0%
- ✅ **Phase 7 (Auth):** 70% (JWT token generation complete, refresh tokens TODO)

### Files Created (Phase 1)
**Backend:**
- `DigiTransac.Core/Models/Category.cs`
- `DigiTransac.Infrastructure/Interfaces/ICategoryRepository.cs`
- `DigiTransac.Infrastructure/Repositories/CategoryRepository.cs`
- `DigiTransac.API/Controllers/CategoriesController.cs`
- `DigiTransac.API/Program.cs`
- `DigiTransac.API/appsettings.json`

**Frontend:**
- `frontend/src/pages/Categories.tsx` (already exists, needs update)

---

## 🐛 Known Issues

### Phase 1
- [ ] React API calls still pointing to Node.js (http://localhost:3000)
- [ ] Need to verify TypeScript interfaces match C# models
- [ ] Potential CORS configuration needed

---

## 💡 Best Practices

1. **API Design:**
   - Use consistent endpoint naming
   - Return proper HTTP status codes
   - Include pagination for large datasets
   - Add proper error handling

2. **Frontend:**
   - Use React Query for caching
   - Implement proper loading states
   - Add optimistic updates
   - Error boundaries for graceful failures

3. **Database:**
   - Keep MongoDB connection string in environment variables
   - Use indexes for frequently queried fields
   - Implement soft deletes where appropriate

4. **Security:**
   - Validate all inputs
   - Use HTTPS in production
   - Implement rate limiting
   - Store secrets securely

---

## � PART 10: DEVELOPMENT STANDARDS & CODE QUALITY

### **Core Principles**

**1. KISS (Keep It Simple, Stupid)**
- Prioritize readability over cleverness
- Avoid over-engineering (defer advanced features to v2)
- Use straightforward solutions first, optimize only when profiled
- Limit function complexity (max 20 lines, break into smaller functions)

**2. Performance Optimization**
- Build with performance in mind from day one (not an afterthought)
- Always use async/await in .NET (no blocking calls)
- Implement pagination for all list endpoints (default 50, max 1000)
- Add database indexes before queries run in production
- Use lazy loading for large datasets
- Cache frequently accessed data (Redis for API responses, React Query for client)
- Profile before optimizing—measure, don't guess

**3. DRY Principle (Don't Repeat Yourself)**
- **Backend (C#):** Extract business logic into reusable services
  ```csharp
  // Bad: Logic repeated across controllers
  // Good: Create shared service
  public class TransactionCategoryService
  {
      public async Task<string> AutoCategorize(string merchantName)
      {
          // Centralized logic used by multiple endpoints
      }
  }
  ```
- **Frontend (React):** Extract logic into custom hooks
  ```typescript
  // Bad: Same logic in multiple components
  // Good: Create custom hook
  const useTransactionFilters = (filters) => {
      // Centralized filtering logic
  };
  ```
- **Constants:** Never hardcode values—centralize in config files
  ```csharp
  // Bad: Magic strings scattered in code
  // Good: Centralized constants
  public static class AppConstants
  {
      public const int MAX_PAGE_SIZE = 1000;
      public const int DEFAULT_PAGE_SIZE = 50;
  }
  ```

**4. Code Organization**
- **Backend (C#):** Clean Architecture (API → Core → Infrastructure)
- **Frontend (React):** Feature-based folder structure (`src/features/transactions/`, `src/features/categories/`)
- **Constants:** Centralized in `constants/` or `config/` directories
- **Utilities:** Reusable logic in `utils/` (shared across features)
- **Types:** Centralized in `types/` (not scattered in components)

---

### **Naming Conventions**

**Backend (C#)** - Follow Microsoft C# Coding Conventions:
```csharp
// Classes, Interfaces, Methods, Properties: PascalCase
public class TransactionRepository { }
public interface ITransactionRepository { }
public async Task<Transaction> GetTransactionAsync(string id) { }
public string TransactionDescription { get; set; }

// Private fields, local variables, parameters: camelCase
private string _connectionString;
var transactionAmount = 100.50m;
public void ProcessTransaction(string transactionId) { }

// Constants: UPPER_SNAKE_CASE (or PascalCase if related to constants class)
private const int MAX_ATTEMPTS = 3;
public static class DbConstants
{
    public const int DefaultPageSize = 50;
}

// Async methods: suffix "Async"
public async Task<List<Transaction>> GetTransactionsAsync() { }

// Boolean properties/methods: prefix "Is", "Has", "Can", "Should"
public bool IsActive { get; set; }
public bool HasChildren { get; set; }
public bool CanDelete() { }
```

**Frontend (TypeScript/React)** - Follow Airbnb/Google TypeScript Guide:
```typescript
// Components: PascalCase
const TransactionList: React.FC = () => {};

// Files: kebab-case (lowercase-with-hyphens)
// Example: transaction-list.tsx, use-transaction-filters.ts

// Functions, variables, parameters: camelCase
const calculateTotalAmount = (transactions: Transaction[]): number => {};
const transactionAmount = 100.50;

// Constants: UPPER_SNAKE_CASE (if literal) or camelCase (if exported)
const MAX_RETRY_ATTEMPTS = 3;
export const defaultPageSize = 50;

// Interfaces/Types: PascalCase with optional "I" prefix for interfaces
interface ITransaction { }
type TransactionResponse = { ... };

// React hooks: prefix "use"
const useTransactionFilters = () => {};
const useApi = () => {};

// Callbacks: prefix "handle" or "on"
const handleDelete = () => {};
const onTransactionSelect = (transaction: Transaction) => {};
```

---

### **Dependency Management & Vulnerability Scanning**

**Strategy: Zero-Vulnerability Production Policy**

1. **Upgrade Policy**
   - ✅ **Major Upgrades:** Review breaking changes, plan testing (monthly)
   - ✅ **Minor Upgrades:** Apply automatically (new features, non-breaking)
   - ✅ **Patch Upgrades:** Apply immediately (security fixes, bug fixes)
   - ✅ **Security Vulnerabilities:** Fix within 24 hours if critical, 1 week if high

2. **Tooling & Automation**
   ```bash
   # Backend (.NET)
   dotnet list package --vulnerable           # Check for vulnerabilities
   dotnet outdated                           # Check for outdated packages
   
   # Frontend (Node.js)
   npm audit                                 # Scan for vulnerabilities
   npm audit fix                             # Auto-fix vulnerabilities
   npm outdated                              # Check for outdated packages
   ```

3. **CI/CD Integration**
   - **GitHub Dependabot:** Auto-create PRs for security updates
   - **Snyk:** Real-time vulnerability scanning on commits
   - **Build Failure Policy:** Builds fail if high/critical vulnerabilities detected
   - **Pre-Deploy Checks:** Run vulnerability scan before production deployment

4. **Version Pinning**
   ```json
   // package.json (Node.js)
   // ✅ Pin exact versions in production (prevent unexpected changes)
   "dependencies": {
     "react": "19.0.0",
     "axios": "1.7.0"
   },
   
   // ✅ Allow minor/patch in devDependencies (dev tools are flexible)
   "devDependencies": {
     "typescript": "~5.7.0",
     "jest": "^29.0.0"
   }
   ```

5. **.NET Packages**
   - Use `*.csproj` to pin exact versions in production
   - Review `Directory.Packages.props` for centralized version management
   - Keep `Microsoft.*` packages aligned (same major.minor version)

6. **Vulnerability Response Plan**
   | Severity | Response Time | Action |
   |----------|---------------|--------|
   | **Critical** | < 24 hours | Patch immediately, deploy hotfix |
   | **High** | < 1 week | Plan patch, include in next release |
   | **Medium** | < 2 weeks | Queue in backlog, include in regular sprint |
   | **Low** | < 1 month | Track, upgrade opportunistically |

7. **Recommended Versions for .NET**
   - ✅ **ASP.NET Core:** 10 LTS (latest stable, long-term support)
   - ✅ **C#:** 13 (latest, concurrent with .NET 10)
   - ✅ **MongoDB.Driver:** Latest stable (check monthly)
   - ✅ **FluentValidation:** Latest stable
   - ✅ **Serilog:** Latest stable
   - ✅ **Polly:** Latest stable (resilience policies)

8. **Recommended Versions for React**
   - ✅ **React:** 19 LTS (latest, concurrent with Node.js)
   - ✅ **TypeScript:** 5.7+ (latest stable)
   - ✅ **Material-UI (MUI):** v7 LTS (Material Design 3)
   - ✅ **React Query:** Latest stable (auto-caching)
   - ✅ **Axios:** Latest stable (HTTP client)

---

### **Common Utilities Structure**

**Backend (C#) - Shared Services**
```
DigiTransac.Infrastructure/
├── Services/
│   ├── EncryptionService.cs         (Sensitive data encryption)
│   ├── PaginationService.cs         (Pagination logic)
│   ├── FilterService.cs             (Query filtering)
│   ├── ValidationService.cs         (Cross-cutting validation)
│   ├── CachingService.cs            (Redis caching wrapper)
│   └── DateTimeService.cs           (Consistent DateTime handling)
├── Interfaces/
│   └── (Corresponding interfaces)
└── Extensions/
    ├── QueryableExtensions.cs       (IQueryable extension methods)
    ├── DateTimeExtensions.cs        (DateTime helpers)
    └── StringExtensions.cs          (String manipulation)
```

**Frontend (React) - Custom Hooks & Utils**
```
src/
├── hooks/
│   ├── useApi.ts                    (Axios + error handling)
│   ├── useAuth.ts                   (Auth context, token management)
│   ├── useTransactionFilters.ts     (Transaction filtering logic)
│   ├── useDebounce.ts               (Debounce wrapper)
│   └── useLocalStorage.ts           (Persist to localStorage)
├── utils/
│   ├── formatters.ts                (Currency, date formatting)
│   ├── validators.ts                (Input validation)
│   ├── api-client.ts                (Axios instance + interceptors)
│   └── error-handlers.ts            (Consistent error handling)
└── constants/
    ├── api-endpoints.ts             (All API URLs)
    ├── app-config.ts                (App-wide settings)
    └── validation-rules.ts          (Validation regex, rules)
```

---

### **Code Reuse Patterns**

**1. Repository Pattern (Backend)**
```csharp
// Define once
public interface IRepository<T> where T : class
{
    Task<T> GetByIdAsync(string id);
    Task<IEnumerable<T>> GetAllAsync(Expression<Func<T, bool>> filter = null);
    Task AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(string id);
}

// Use everywhere
public class TransactionController
{
    private readonly IRepository<Transaction> _repository;
    
    public async Task<IActionResult> GetTransaction(string id)
    {
        var transaction = await _repository.GetByIdAsync(id);
        return Ok(transaction);
    }
}
```

**2. Custom Hooks (Frontend)**
```typescript
// Define once
export const useTransactionFilters = (transactions: Transaction[]) => {
    const [filters, setFilters] = useState({...});
    const filtered = useMemo(() => {
        return transactions.filter(/* shared logic */);
    }, [transactions, filters]);
    
    return { filtered, filters, setFilters };
};

// Use everywhere
const TransactionList = () => {
    const { data } = useTransactions();
    const { filtered } = useTransactionFilters(data || []);
    return <>{filtered.map(...)}</>;
};
```

**3. Service Layer (Backend)**
```csharp
// Shared business logic
public class CategoryAutoMatchService
{
    public async Task<string> MatchMerchantToCategory(string merchantName)
    {
        // Centralized merchant matching logic
    }
}

// Used by controllers, background jobs, APIs
public class TransactionController
{
    public async Task<IActionResult> CreateTransaction(CreateTransactionDto dto)
    {
        var categoryId = await _matchService.MatchMerchantToCategory(dto.Merchant);
        // ...
    }
}
```

---

### **Performance Checklist (Before Code Review)**

- [ ] Database queries use indexes (no N+1 queries)
- [ ] Pagination implemented (default 50, max 1000)
- [ ] Async/await used throughout (no blocking calls)
- [ ] Lazy loading for large collections
- [ ] Caching strategy in place (Redis for API, React Query for frontend)
- [ ] No hardcoded timeouts (configurable, sensible defaults)
- [ ] Bundle size optimized (frontend: < 500KB gzipped)
- [ ] API response time < 200ms (p95)
- [ ] No unnecessary re-renders (React.memo, useMemo, useCallback)
- [ ] Compression enabled (gzip on API, minified frontend)
- [ ] CDN caching headers set (static assets, API responses)

---

### **Code Review Checklist**

**Naming & Organization**
- [ ] Function names clearly describe purpose
- [ ] Variables use appropriate scope (private/public correctly)
- [ ] No magic numbers or strings (use constants)
- [ ] File organization follows agreed structure

**DRY & Reusability**
- [ ] No duplicate code (should be extracted to service/hook)
- [ ] Common logic centralized (not scattered across modules)
- [ ] Constants defined once, referenced everywhere
- [ ] Interfaces/types defined once, imported where needed

**Error Handling**
- [ ] All errors logged with context (correlation ID, user ID)
- [ ] User-friendly error messages (no stack traces)
- [ ] Proper error types returned (400, 401, 403, 404, 500)
- [ ] Graceful fallbacks for API failures

**Logging & Observability**
- [ ] Critical operations logged (auth, transactions, budgets)
- [ ] Structured logging with context (not random console.logs)
- [ ] Log levels appropriate (Debug, Info, Warning, Error, Critical)
- [ ] No sensitive data in logs (passwords, tokens, SSN)

**Type Safety**
- [ ] No `any` types (use specific types or generics)
- [ ] All function parameters typed
- [ ] Return types explicit (not inferred)
- [ ] null/undefined handled properly

**Performance**
- [ ] Database queries optimized (use indexes, pagination)
- [ ] No memory leaks (listeners removed, subscriptions unsubscribed)
- [ ] API calls are batch/cached where possible
- [ ] Frontend components don't re-render unnecessarily

**Security**
- [ ] Input validation on all endpoints
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevention (sanitize output, CSP headers)
- [ ] CSRF tokens used for state-changing operations
- [ ] No secrets in code (use Key Vault/environment variables)

---

## 📝 Notes

- **Node.js Backend:** Keep running during migration as fallback
- **MongoDB:** Shared database - be careful with schema changes
- **Git:** Commit after each phase completion
- **Testing:** Test thoroughly before moving to next phase
- **Dependencies:** Check for vulnerabilities weekly, apply updates regularly

---

## 🧪 PART 11: ITERATIVE TESTING STRATEGY

### **Core Principle**
**Add test cases incrementally with each feature completion.** Don't write all tests upfront - test each feature as it's built and ready.

### **How It Works**

**For Each Task/Feature:**
1. ✅ **Complete the feature** (code, build, deploy)
2. ✅ **Create test cases** for that feature
3. ✅ **Run tests** to verify it works
4. ✅ **Document test results** in agents.md
5. ✅ **Commit** feature + tests together
6. ✅ **Move to next task**

### **Testing Pyramid**
- **80% Unit Tests** - Test individual functions (fast)
- **15% Integration Tests** - Test endpoints with real DB (moderate)
- **5% E2E Tests** - Test complete workflows (slow)

### **Current Test Suite (Phase 1 - Authentication) ✅ ALL PASSING**

**Test File:** `test-auth-complete.ps1`
**Total Tests:** 8 | **Passed:** 8 | **Failed:** 0

**Test Cases:**
1. ✅ User Registration
2. ✅ Get Profile (Protected)
3. ✅ Token Refresh (with Rotation)
4. ✅ Login with Email
5. ✅ Login with Username
6. ✅ Logout (Revoke All Tokens)
7. ✅ Invalid Credentials (Security Test)
8. ✅ Duplicate Registration (Prevention)

**Security Validations:**
- ✅ BCrypt password hashing
- ✅ JWT token generation
- ✅ Token rotation pattern
- ✅ Duplicate prevention
- ✅ Invalid credentials rejected
- ✅ Protected endpoints

### **Future Test Cases**

**Categories (Phase 2) - Add tests after feature complete:**
- [ ] Test: Create category with hierarchy
- [ ] Test: Search categories by name
- [ ] Test: Filter by type (folder vs category)
- [ ] Test: Move category to different parent
- [ ] Test: Delete category (soft delete)
- [ ] Test: Calculate category statistics

**Accounts (Phase 2) - Add tests after feature complete:**
- [ ] Test: Create account with type (bank/credit/cash/wallet/upi)
- [ ] Test: Update account balance
- [ ] Test: Get account with transaction count
- [ ] Test: Multi-currency support

**Transactions (Phase 3) - Add tests after feature complete:**
- [ ] Test: Create transaction with category/account
- [ ] Test: Split transaction across categories
- [ ] Test: Search by date range
- [ ] Test: Filter by category/account/tags
- [ ] Test: Create recurring transaction
- [ ] Test: Calculate total by category

**Budgets (Phase 3) - Add tests after feature complete:**
- [ ] Test: Create category-based budget
- [ ] Test: Create tag-based budget
- [ ] Test: Calculate budget progress
- [ ] Test: Alert thresholds (10%, 50%, 90%, 100%)
- [ ] Test: Rollover unused budget to next month

### **Example: How We'll Add Tests for Phase 2 (Categories)**

**Step 1: Complete Categories Feature**
```csharp
// Implement Category model, repository, controller
// Build & deploy
```

**Step 2: Create Test Cases**
```bash
# Create test-categories.ps1 with 8 tests:
# 1. Create category
# 2. Get category
# 3. Update category
# 4. Search categories
# 5. Filter by type
# 6. Move to parent
# 7. Delete category
# 8. Calculate statistics
```

**Step 3: Run Tests**
```bash
.\test-categories.ps1
# Should see: ✓ 8/8 PASSING
```

**Step 4: Document in agents.md**
```
### **Test Suite (Phase 2 - Categories) ✅ ALL PASSING**
- 8 tests created
- All tests passing
- Coverage: Create, Read, Update, Delete, Search, Filter, Statistics
```

**Step 5: Commit**
```bash
git commit -m "feat: Categories feature complete with 8 tests passing"
```

**Then Move to Next Feature** 👉 Accounts

---

## 📋 PHASE 1: COMPLETE IMPLEMENTATION STATUS

### **✅ Phase 1: Authentication System - COMPLETE**

**Backend (100%):**
- ✅ User model with BCrypt (work factor 12)
- ✅ RefreshToken model with SHA256 hashing
- ✅ TokenService (JWT generation, 15min/14day)
- ✅ AuthController (5 endpoints)
- ✅ Token rotation pattern
- ✅ MongoDB with indexes
- ✅ Bearer middleware
- ✅ Error handling & validation
- ✅ Swagger API docs

**API Endpoints (Tested & Working):**
- ✅ POST /api/v1/auth/register
- ✅ POST /api/v1/auth/login
- ✅ GET /api/v1/auth/me (protected)
- ✅ POST /api/v1/auth/refresh
- ✅ POST /api/v1/auth/logout

**Testing:**
- ✅ 8/8 test cases passing
- ✅ All endpoints working
- ✅ Security tests passing
- ✅ Build successful (all 4 projects, 0 errors)

**Git:**
- ✅ Branch: `feature/dotnet-migration`
- ✅ 4 commits made
- ✅ All changes tracked

**Frontend (0%):**
- ⏳ React login/register pages
- ⏳ Auth context setup
- ⏳ Protected routes
- ⏳ Token refresh interceptor

---

**Last Updated:** January 12, 2026
**Phase 1 Status:** Backend ✅ COMPLETE | Frontend ⏳ PENDING
**Next:** Phase 1.B - React Frontend (Est. 1-2 days)
**Build:** ✅ Successful | Tests: ✅ 8/8 Passing

---

## 🎨 UI/UX Standards

- Material Design 3 (MUI v7)
- Gradients for headers (purple-blue theme)
- Smooth animations (300ms transitions)
- Responsive design (mobile-first)
- Loading skeletons
- Empty states with helpful messages
- Toast notifications for feedback
- Confirmation dialogs for destructive actions

---

**Last Updated:** January 12, 2026
**Current Phase:** Phase 1 - Authentication (Ready to Begin)
**Next Action:** Create .NET project structure and implement Auth endpoints
