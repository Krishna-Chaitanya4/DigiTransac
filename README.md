# DigiTransac - Digital Transaction Tracker

A full-stack web application for tracking digital transactions.

## Tech Stack

- **Backend:** ASP.NET Core 8 Web API (C#), MongoDB, JWT Authentication
- **Frontend:** React + TypeScript, Vite, Tailwind CSS
- **Database:** MongoDB (local for dev, Azure Cosmos DB for production)

## Project Structure

```
DigiTransac/
├── api/                    # ASP.NET Core Web API
│   ├── Endpoints/          # Minimal API endpoints
│   ├── Models/             # Domain models and DTOs
│   ├── Repositories/       # Data access layer
│   ├── Services/           # Business logic
│   ├── Settings/           # Configuration classes
│   └── Program.cs          # Application entry point
├── web/                    # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── context/        # React context providers
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service functions
│   │   └── types/          # TypeScript types
│   └── ...
└── README.md
```

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/try/download/community) (local instance for development)

## Getting Started

### 1. Start MongoDB

Make sure MongoDB is running locally on the default port (27017).

```bash
# Windows (if installed as service, it should already be running)
# Or start manually:
mongod
```

### 2. Run the API

```bash
cd api
dotnet restore
dotnet run
```

The API will be available at `http://localhost:5000`. Swagger UI is available at `http://localhost:5000/swagger`.

### 3. Run the Frontend

```bash
cd web
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## API Endpoints

### Authentication

| Method | Endpoint          | Description                |
|--------|-------------------|----------------------------|
| POST   | /api/auth/register | Register a new user       |
| POST   | /api/auth/login    | Login and get JWT token   |
| GET    | /api/auth/me       | Get current user (auth required) |

### Health Check

| Method | Endpoint     | Description        |
|--------|--------------|-------------------|
| GET    | /api/health  | API health check  |

## Environment Configuration

### API (api/appsettings.json)

```json
{
  "MongoDb": {
    "ConnectionString": "mongodb://localhost:27017",
    "DatabaseName": "DigiTransac"
  },
  "Jwt": {
    "Key": "YOUR_SECRET_KEY_MIN_32_CHARS",
    "Issuer": "DigiTransac",
    "Audience": "DigiTransac",
    "ExpireMinutes": 60
  }
}
```

### Production (Azure)

For Azure deployment:
1. Use Azure Cosmos DB with MongoDB API
2. Store connection strings in Azure Key Vault or App Configuration
3. Update JWT secret for production

## Features

- [x] User registration and login
- [x] JWT authentication
- [x] Protected routes
- [ ] Transaction CRUD operations (coming soon)
- [ ] Dashboard with transaction summary
- [ ] Categories and filtering
- [ ] Export/Import functionality

## License

MIT
