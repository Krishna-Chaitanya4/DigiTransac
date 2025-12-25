# Developer Quick Reference

## 🚀 Quick Start

### First Time Setup
```bash
# Clone and install
git clone <repo>
cd DigiTransac

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev

# Frontend (in new terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables Required
```env
# Backend (.env)
COSMOS_ENDPOINT=<your-cosmos-endpoint>
COSMOS_KEY=<your-key>
COSMOS_DATABASE_NAME=DigiTransacDB
JWT_SECRET=<min-32-chars-secret>
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

## 🛠️ Common Tasks

### Running Tests
```bash
# Backend
cd backend
npm test
npm run test:watch
npm run test:coverage

# Frontend
cd frontend
npm test
```

### Code Quality
```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

### Building
```bash
# Backend
npm run build
npm start

# Frontend
npm run build
npm run preview
```

### Docker
```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 📚 Key Files & Directories

### Backend Structure
```
backend/src/
├── config/          # Database and Swagger configuration
├── constants/       # Application constants (NEW!)
├── jobs/            # Cron jobs
├── middleware/      # Express middleware
├── models/          # TypeScript types
├── routes/          # API routes
│   └── v1/         # Versioned API routes (NEW!)
├── services/        # Business logic
├── utils/           # Utility functions
└── server.ts        # Entry point
```

### Frontend Structure
```
frontend/src/
├── components/      # Reusable React components
├── context/         # React Context providers
├── hooks/           # Custom React hooks
├── pages/           # Page components
├── services/        # API service layer
├── utils/           # Utility functions
│   ├── environment.ts   # Environment detection (NEW!)
│   ├── axiosConfig.ts   # Axios setup (NEW!)
│   └── ...
└── App.tsx          # Root component
```

## 🔧 Important Utilities

### Environment Detection (Frontend)
```typescript
import { isDevelopmentEnvironment, getBackendUrl } from '@/utils/environment';

const isDev = isDevelopmentEnvironment();
const apiUrl = getBackendUrl();
```

### Logging (Backend)
```typescript
import { logger } from './utils/logger';

// Instead of console.log
logger.info('Message');
logger.error({ error }, 'Error occurred');
logger.debug({ data }, 'Debug info');
```

### Constants (Backend)
```typescript
import { HTTP_STATUS, ERROR_MESSAGES, VALIDATION_CONFIG } from './constants';

res.status(HTTP_STATUS.BAD_REQUEST).json({
  error: ERROR_MESSAGES.REQUIRED_FIELD
});

if (amount > VALIDATION_CONFIG.MAX_AMOUNT) {
  throw new AppError('Amount too high', HTTP_STATUS.BAD_REQUEST);
}
```

### Error Handling (Backend)
```typescript
import { AppError } from './middleware/errorHandler';

// Operational errors
throw new AppError('Not found', 404);

// Errors are automatically logged and formatted
```

## 🌐 API Endpoints

### Current Versioning
```
/api/v1/auth          # Authentication
/api/v1/users         # User management
/api/v1/transactions  # Transactions
/api/v1/categories    # Categories
/api/v1/budgets       # Budgets
/api/v1/accounts      # Accounts
/api/v1/tags          # Tags
/api/v1/analytics     # Analytics
/api/v1/email         # Email parsing
/api/v1/gmail         # Gmail integration
/api/v1/sms           # SMS parsing

# Legacy routes (redirects to v1)
/api/auth → /api/v1/auth (308 redirect)
# ... other legacy routes
```

### Making API Calls (Frontend)
```typescript
// Axios is pre-configured with:
// - Automatic auth token injection
// - Dynamic base URL
// - Retry logic
// - Error handling

import axios from 'axios';

// Just use relative URLs
const response = await axios.get('/api/v1/transactions');

// Or full URLs work too
const response = await axios.get('http://localhost:5000/api/v1/transactions');
```

## 🐛 Debugging

### Check Health
```bash
curl http://localhost:5000/ping        # Liveness
curl http://localhost:5000/health      # Readiness
```

### View Logs
```typescript
// Backend logs are in JSON format (pino)
// Use pino-pretty for development:
npm run dev  # Already configured with pino-pretty

// Production logs
docker-compose logs backend
```

### Common Issues

#### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

#### Database Connection Failed
1. Check Cosmos DB Emulator is running (for local dev)
2. Verify COSMOS_ENDPOINT and COSMOS_KEY in .env
3. Check network connectivity

#### CORS Issues
1. Verify CORS_ORIGIN in backend .env matches frontend URL
2. Check browser console for actual origin
3. Ensure credentials: 'include' in frontend requests

## 📦 Package Management

### Adding Dependencies
```bash
# Backend
cd backend
npm install <package>
npm install -D <dev-package>

# Frontend
cd frontend
npm install <package>
npm install -D <dev-package>
```

### Updating Dependencies
```bash
# Check for updates
npm outdated

# Update all
npm update

# Update specific package
npm update <package>
```

## 🔒 Security Best Practices

### ✅ DO
- Use `logger` instead of `console.log`
- Validate all user input
- Use constants for error messages
- Set proper TypeScript types
- Use environment variables for secrets
- Implement proper error handling

### ❌ DON'T
- Commit `.env` files
- Use `as any` type casts
- Expose stack traces in production
- Log sensitive data (tokens, passwords)
- Use magic numbers/strings
- Bypass authentication middleware

## 🧪 Testing Patterns

### Backend Tests
```typescript
import request from 'supertest';
import app from '../server';

describe('GET /api/v1/transactions', () => {
  it('should require authentication', async () => {
    const response = await request(app)
      .get('/api/v1/transactions')
      .expect(401);
    
    expect(response.body.error).toBe('Authentication token required');
  });
});
```

### Frontend Tests
```typescript
import { render, screen } from '@testing-library/react';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('renders dashboard heading', () => {
    render(<Dashboard />);
    expect(screen.getByRole('heading')).toHaveTextContent('Dashboard');
  });
});
```

## 🚢 Deployment

### Production Checklist
- [ ] All environment variables set
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] Database backups configured
- [ ] Monitoring setup (logs, errors, performance)
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Rate limiting active
- [ ] Health checks working
- [ ] Docker images built and pushed
- [ ] Secrets in Azure Key Vault

### Quick Deploy
```bash
# Build images
docker build -t digitransac-backend:latest ./backend
docker build -t digitransac-frontend:latest ./frontend

# Push to registry
docker push <registry>/digitransac-backend:latest
docker push <registry>/digitransac-frontend:latest

# Deploy (Azure Container Apps)
az containerapp update --name backend --image <registry>/digitransac-backend:latest
az containerapp update --name frontend --image <registry>/digitransac-frontend:latest
```

## 📞 Getting Help

### Resources
- [Main README](README.md) - Project overview
- [Improvements](IMPROVEMENTS.md) - Recent enhancements
- [API Documentation](http://localhost:5000/api-docs) - Swagger docs (dev mode)
- [Changelog](CHANGELOG.md) - Version history

### Debug Mode
```bash
# Backend with debug logging
DEBUG=* npm run dev

# Frontend with verbose output
npm run dev -- --debug
```

---

**Last Updated**: December 23, 2025  
**For**: DigiTransac v1.1.0
