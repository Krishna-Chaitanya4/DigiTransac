# DigiTransac

Modern transaction management application with AI-powered categorization, budget tracking, and analytics.

## Features

- Multi-user authentication (JWT)
- Unlimited category nesting
- Budget management with alerts
- Recurring transactions
- Analytics dashboard
- PWA with offline support
- Dark mode

## Tech Stack

- **Frontend**: React 18, TypeScript, Material-UI, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: Azure DocumentDB M10 (FREE tier)
- **Security**: Azure Key Vault, Managed Identity
- **Infrastructure**: Docker, Azure Container Apps, GitHub Actions

**Cost**: ₹50/month (~$0.60/month)

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Azure account (for Key Vault & DocumentDB)

### Local Development

```bash
# 1. Clone repository
git clone <repo-url>
cd DigiTransac

# 2. Login to Azure (for Key Vault access)
az login

# 3. Setup environment
cd backend
cp .env.example .env
# Edit .env with your Azure Key Vault URL

cd ../frontend
cp .env.example .env

# 4. Run with Docker
cd ..
docker-compose up --build
```

**Access**:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Configuration

### Backend Environment Variables

```env
# Azure Key Vault (stores all secrets)
AZURE_KEY_VAULT_URL=https://digitransac-kv-3895.vault.azure.net/

# Database
MONGODB_DATABASE_NAME=DigiTransacDB

# Server
PORT=5000
NODE_ENV=development

# URLs
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

**Secrets in Key Vault**:
- `MongoDB-ConnectionString`
- `JWT-Secret`
- `Master-Encryption-Key`

### Frontend Environment Variables

```env
VITE_API_URL=http://localhost:5000/api
```

## Deployment

### CI/CD Pipeline

**Automatic deployment on PR merge to `main`**:
1. Create feature branch
2. Push changes
3. Create Pull Request
4. Merge → Auto-deploy to Azure

### GitHub Secrets Setup

Run automated script:
```powershell
.\scripts\setup-github-secrets.ps1
```

Required secrets:
- `AZURE_CREDENTIALS`
- `AZURE_KEY_VAULT_URL`
- `MONGODB_DATABASE_NAME`
- `BACKEND_URL`, `FRONTEND_URL`, `CORS_ORIGIN`

### Manual Deployment

```bash
# Build images
docker build -t <acr>.azurecr.io/digitransac-backend:latest ./backend
docker build -t <acr>.azurecr.io/digitransac-frontend:latest ./frontend

# Push to ACR
az acr login --name <acr>
docker push <acr>.azurecr.io/digitransac-backend:latest
docker push <acr>.azurecr.io/digitransac-frontend:latest
```

## Security

- **Azure Key Vault**: All secrets centralized
- **Managed Identity**: Passwordless authentication
- **JWT Authentication**: Secure user sessions
- **TLS 1.2+**: Encrypted communication
- **RBAC**: Role-based access control
- **Multi-stage Docker**: Minimal attack surface

## License

MIT

---

See [DEV-GUIDE.md](DEV-GUIDE.md) for detailed development documentation.
