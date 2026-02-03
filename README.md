# DigiTransac - Personal Finance Tracker

<p align="center">
  <img src="docs/images/logo.png" alt="DigiTransac Logo" width="200" />
</p>

A full-stack personal finance management application with AI-powered insights, real-time chat, interactive spending maps, and comprehensive budget tracking.

[![.NET](https://img.shields.io/badge/.NET-9.0-512BD4)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-3.6-47A248)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ✨ Features

### Core Features
- 💰 **Transaction Management** - Full CRUD with categories, labels, tags, and notes
- 💳 **Multi-Account Support** - Bank accounts, credit cards, cash, investments
- 🔄 **Account Transfers** - Transfer money between accounts with automatic reconciliation
- 📅 **Recurring Transactions** - Set up automatic recurring income/expenses
- 👥 **P2P Transactions** - Send and receive money from other users
- 🏷️ **Labels & Tags** - Organize transactions with custom labels and tags
- 💱 **Multi-Currency** - Real-time exchange rates with automatic conversion

### Analytics & Insights
- 📊 **Spending Analytics** - Visual breakdowns by category, time period, account
- 📈 **Budget Tracking** - Set monthly/weekly budgets with progress tracking
- 🗺️ **Spending Map** - Interactive map showing where you spend money
  - Category-based color coding
  - Marker clustering for dense areas
  - Heatmap visualization mode
  - Location insights ("You spent ₹X near home")
  - Trip grouping by geographic region

### Communication
- 💬 **Real-time Chat** - WhatsApp-style messaging interface
  - Personal transaction journal (chat with yourself)
  - P2P messaging with other users
  - Transaction cards embedded in chat
  - Mobile-responsive sliding panel design
- 🔔 **Notifications** - Real-time updates via SignalR

### Security
- 🔐 **JWT Authentication** - Secure token-based authentication
- 📱 **Two-Factor Authentication** - TOTP-based 2FA support
- 🔒 **AES-256 Encryption** - Envelope encryption for sensitive data
- ⚡ **Rate Limiting** - Per-user rate limiting for API protection

## 🛠️ Tech Stack

### Backend (./api)
| Technology | Purpose |
|------------|---------|
| **.NET 9** | Web API framework with Minimal APIs |
| **MongoDB 3.6** | NoSQL database with async driver |
| **MediatR** | Domain events and CQRS patterns |
| **FluentValidation** | Request validation |
| **SignalR** | Real-time communication |
| **Serilog** | Structured logging |
| **OpenTelemetry** | Distributed tracing |
| **Polly** | Resilience and transient fault handling |

### Frontend (./web)
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework with TypeScript |
| **Vite 7** | Build tool and dev server |
| **TanStack Query** | Server state management |
| **Tailwind CSS 4** | Utility-first styling |
| **React Router 7** | Client-side routing |
| **Leaflet** | Interactive maps |
| **SignalR Client** | Real-time updates |

### Testing
| Technology | Purpose |
|------------|---------|
| **xUnit** | Backend test framework |
| **TestContainers** | MongoDB integration tests |
| **Vitest** | Frontend unit tests |
| **Playwright** | End-to-end testing |
| **Storybook** | Component development |

## 📁 Project Structure

```
DigiTransac/
├── api/                          # .NET 9 Web API
│   ├── Common/                   # Shared utilities (Result pattern)
│   ├── Endpoints/                # Minimal API endpoints
│   │   ├── AccountEndpoints.cs
│   │   ├── AuthEndpoints.cs
│   │   ├── BudgetEndpoints.cs
│   │   ├── ConversationEndpoints.cs
│   │   ├── CurrencyEndpoints.cs
│   │   ├── LabelEndpoints.cs
│   │   ├── TagEndpoints.cs
│   │   ├── TransactionEndpoints.cs
│   │   └── TwoFactorEndpoints.cs
│   ├── EventHandlers/            # MediatR event handlers
│   ├── Events/                   # Domain events
│   ├── Extensions/               # DI and configuration extensions
│   ├── Hubs/                     # SignalR hubs
│   ├── Models/                   # Domain models and DTOs
│   ├── Repositories/             # Data access layer
│   ├── Services/                 # Business logic
│   │   ├── Caching/              # Memory cache service
│   │   ├── Transactions/         # Transaction service facade
│   │   └── UnitOfWork/           # MongoDB transaction support
│   ├── Settings/                 # Configuration classes
│   └── Validators/               # FluentValidation validators
├── web/                          # React frontend
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   │   ├── account/          # Account-related components
│   │   │   ├── budget/           # Budget forms and cards
│   │   │   ├── chat/             # Chat/messaging components
│   │   │   ├── map/              # Spending map components
│   │   │   └── transaction/      # Transaction forms and cards
│   │   ├── context/              # React context providers
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # Query client, utilities
│   │   ├── pages/                # Page components
│   │   │   ├── AccountsPage.tsx
│   │   │   ├── BudgetsPage.tsx
│   │   │   ├── ChatsPage.tsx
│   │   │   ├── InsightsPage.tsx
│   │   │   ├── LabelsPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── SpendingMapPage.tsx
│   │   │   └── TransactionsPage.tsx
│   │   ├── services/             # API client functions
│   │   └── types/                # TypeScript types
│   └── public/                   # Static assets
├── tests/                        # Backend tests
│   ├── Integration/              # Integration tests
│   └── Services/                 # Unit tests
├── docs/                         # Documentation
└── docker-compose.yml            # Docker orchestration
```

## 🚀 Getting Started

### Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 20+](https://nodejs.org/)
- [MongoDB 7.0+](https://www.mongodb.com/try/download/community)
- [Docker](https://www.docker.com/) (optional, for containerized setup)

### Option 1: Local Development

#### 1. Start MongoDB

```bash
# Using Docker (recommended)
docker run -d -p 27017:27017 --name mongodb mongo:7

# Or start local MongoDB service
mongod
```

#### 2. Run the API

```bash
cd api
cp appsettings.Development.example.json appsettings.Development.json
# Edit appsettings.Development.json with your settings
dotnet restore
dotnet run
```

The API will be available at:
- API: `http://localhost:5000`
- Swagger UI: `http://localhost:5000/swagger`

#### 3. Run the Frontend

```bash
cd web
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Option 2: Docker Compose

```bash
# Development mode with hot reload
docker-compose -f docker-compose.dev.yml up

# Production mode
docker-compose up -d
```

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register a new user |
| POST | `/api/v1/auth/login` | Login and get JWT token |
| GET | `/api/v1/auth/me` | Get current user profile |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password with token |

### Two-Factor Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/2fa/setup` | Initialize 2FA setup |
| POST | `/api/v1/2fa/verify` | Verify 2FA code |
| POST | `/api/v1/2fa/disable` | Disable 2FA |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/transactions` | List transactions (with filters) |
| POST | `/api/v1/transactions` | Create a transaction |
| GET | `/api/v1/transactions/{id}` | Get transaction by ID |
| PUT | `/api/v1/transactions/{id}` | Update a transaction |
| DELETE | `/api/v1/transactions/{id}` | Delete a transaction |
| POST | `/api/v1/transactions/transfer` | Create account transfer |
| POST | `/api/v1/transactions/recurring` | Create recurring transaction |
| GET | `/api/v1/transactions/analytics` | Get spending analytics |
| GET | `/api/v1/transactions/export` | Export transactions (CSV/JSON) |

### Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/accounts` | List all accounts |
| POST | `/api/v1/accounts` | Create an account |
| GET | `/api/v1/accounts/{id}` | Get account by ID |
| PUT | `/api/v1/accounts/{id}` | Update an account |
| DELETE | `/api/v1/accounts/{id}` | Delete an account |
| GET | `/api/v1/accounts/{id}/balance` | Get account balance |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/budgets` | List all budgets |
| POST | `/api/v1/budgets` | Create a budget |
| GET | `/api/v1/budgets/{id}` | Get budget by ID |
| PUT | `/api/v1/budgets/{id}` | Update a budget |
| DELETE | `/api/v1/budgets/{id}` | Delete a budget |

### Conversations (Chat)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/conversations` | List conversations |
| GET | `/api/v1/conversations/{userId}` | Get conversation with user |
| POST | `/api/v1/conversations/message` | Send a message |
| GET | `/api/v1/conversations/location-insights` | Get location-based insights |

### Labels & Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/labels` | List all labels |
| POST | `/api/v1/labels` | Create a label |
| GET | `/api/v1/tags` | List all tags |
| POST | `/api/v1/tags` | Create a tag |

### Currency
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/currencies` | List supported currencies |
| GET | `/api/v1/currencies/rates` | Get exchange rates |
| GET | `/api/v1/currencies/convert` | Convert between currencies |

## 🧪 Testing

### Backend Tests

```bash
cd tests

# Run all tests
dotnet test

# Run unit tests only
dotnet test --filter "Category!=Integration"

# Run integration tests (requires Docker)
dotnet test --filter "Category=Integration"

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"
```

### Frontend Tests

```bash
cd web

# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Storybook

```bash
cd web
npm run storybook
```

## 🔧 Configuration

### API Configuration (appsettings.json)

```json
{
  "MongoDb": {
    "ConnectionString": "mongodb://localhost:27017",
    "DatabaseName": "digitransac"
  },
  "Jwt": {
    "Key": "YOUR_SECRET_KEY_MIN_32_CHARS",
    "Issuer": "DigiTransac",
    "Audience": "DigiTransac",
    "ExpireMinutes": 60
  },
  "Encryption": {
    "MasterKey": "YOUR_AES_256_MASTER_KEY"
  },
  "RateLimiting": {
    "PermitLimit": 100,
    "WindowSeconds": 60
  }
}
```

### Frontend Configuration

The frontend uses Vite's proxy configuration to forward API requests. See `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true
    }
  }
}
```

## 📱 Mobile Responsiveness

DigiTransac is fully responsive with mobile-first design:

- **Chat Interface**: WhatsApp-style sliding panels on mobile
- **Navigation**: Bottom navigation on mobile, sidebar on desktop
- **Spending Map**: Touch-friendly gestures and controls
- **Forms**: Optimized input layouts for mobile keyboards

## 🏗️ Architecture

### Design Patterns

1. **Facade Pattern** - `TransactionServiceFacade` provides unified API
2. **Unit of Work** - MongoDB transaction management with fallback
3. **Result Pattern** - Type-safe error handling without exceptions
4. **Domain Events** - MediatR-based decoupled notifications
5. **Repository Pattern** - Data access abstraction

### Service Architecture

```
TransactionServiceFacade (implements ITransactionService)
├── TransactionCoreService     - CRUD operations
├── TransferService            - Account transfers
├── RecurringTransactionService - Scheduled transactions
├── TransactionAnalyticsService - Analytics and reporting
├── TransactionExportService   - CSV/JSON export
├── TransactionBatchService    - Bulk operations
├── TransactionMapperService   - DTO mapping with encryption
└── P2PTransactionService      - Peer-to-peer transactions
```

## 🚀 Deployment

### Production Checklist

- [ ] Update JWT secret key
- [ ] Configure MongoDB connection string
- [ ] Set up encryption master key
- [ ] Configure CORS origins
- [ ] Enable HTTPS
- [ ] Set up rate limiting
- [ ] Configure OpenTelemetry exporter
- [ ] Set up health check endpoints

### Azure Deployment

For Azure deployment:
1. Use Azure Cosmos DB with MongoDB API
2. Store secrets in Azure Key Vault
3. Deploy API to Azure App Service
4. Deploy frontend to Azure Static Web Apps
5. Configure Application Insights for monitoring

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support, please open an issue in the GitHub repository or contact the maintainers.

---

Made with ❤️ by the DigiTransac team
