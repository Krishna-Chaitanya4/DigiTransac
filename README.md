# DigiTransac

A modern, full-stack transaction management application built with React, Node.js, and Azure Cosmos DB.

## 🚀 Features

- **Multi-user Support**: Secure authentication with JWT
- **Unlimited Category Nesting**: Organize expenses in folder-like hierarchies
- **Budget Management**: Set budgets at any folder level with alerts
- **Recurring Expenses**: Support for daily, weekly, monthly, yearly, and custom patterns
- **Analytics Dashboard**: Beautiful drill-down visualizations
- **Export Data**: CSV and PDF export capabilities
- **Dark Mode**: Eye-friendly theme switching
- **Responsive Design**: Perfect on desktop, tablet, and mobile
- **🆕 Offline Support**: Work without internet - changes sync automatically
- **🆕 PWA Install**: Install as native app on mobile and desktop
- **🆕 Background Sync**: Automatic sync when connection restored

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Material-UI (MUI) for beautiful components
- Vite for fast development
- React Router for navigation
- Recharts for data visualization
- Formik & Yup for form validation

**Backend:**
- Node.js with Express
- TypeScript
- Azure Cosmos DB (MongoDB API)
- JWT Authentication
- Helmet for security

**Infrastructure:**
- Docker & Docker Compose
- Azure Container Registry
- Azure Container Apps
- GitHub Actions for CI/CD

### Cost Optimization
- **Monthly Cost**: ~$5-7/month
- Azure Cosmos DB Free Tier (25GB, 1000 RU/s)
- Azure Container Apps (Consumption plan - scales to zero)
- Azure Container Registry Basic ($5/month)

## 📁 Project Structure

```
DigiTransac/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── cosmosdb.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── errorHandler.ts
│   │   ├── models/
│   │   │   └── types.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── user.routes.ts
│   │   │   ├── category.routes.ts
│   │   │   ├── expense.routes.ts
│   │   │   ├── budget.routes.ts
│   │   │   └── analytics.routes.ts
│   │   └── server.ts
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   └── Loading.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Expenses.tsx
│   │   │   ├── Categories.tsx
│   │   │   ├── Budgets.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── Profile.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
├── docs/
├── docker-compose.yml
└── README.md
```

## 🚦 Getting Started

### Prerequisites

- Node.js 20+ 
- Docker & Docker Compose
- Azure Account (for Cosmos DB)
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd DigiTransac
   ```

2. **Setup Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your Azure Cosmos DB credentials
   npm install
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

4. **Using Docker Compose**
   ```bash
   # From project root
   docker-compose up --build
   ```

   Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Environment Variables

**Backend (.env)**
```env
PORT=5000
NODE_ENV=development
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your-cosmos-key
COSMOS_DATABASE_NAME=DigiTransacDB
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:5000/api
```

## 🐳 Docker Deployment

### Build Images

```bash
# Build backend
docker build -t your-acr.azurecr.io/expense-tracker-backend:latest ./backend

# Build frontend
docker build -t your-acr.azurecr.io/expense-tracker-frontend:latest ./frontend
```

### Push to Azure Container Registry

```bash
# Login to ACR
az acr login --name your-acr

# Push images
docker push your-acr.azurecr.io/expense-tracker-backend:latest
docker push your-acr.azurecr.io/expense-tracker-frontend:latest
```

## 📊 Database Schema

### Collections

1. **users**: User accounts and profiles
2. **categories**: Hierarchical folder/category structure
3. **expenses**: All expense records
4. **budgets**: Budget definitions and thresholds

### Key Models

```typescript
interface Category {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;  // null for root folders
  isFolder: boolean;         // false for leaf categories only
  icon?: string;
  color?: string;
  path: string[];            // Full path for drill-down
}

interface Expense {
  id: string;
  userId: string;
  categoryId: string;        // Must be a leaf category
  amount: number;
  description: string;
  date: Date;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
}

interface Budget {
  id: string;
  userId: string;
  categoryId: string;        // Can be folder or category
  amount: number;
  period: 'monthly' | 'yearly' | 'custom';
  alertThreshold: number;    // Percentage (e.g., 80%)
}
```

## 🔒 Security

- JWT-based authentication
- Helmet.js for HTTP headers security
- CORS protection
- Password hashing with bcrypt
- Input validation with Joi
- SQL injection prevention (Cosmos DB parameterized queries)

## 🎨 UI/UX Features

- Modern Material Design
- Smooth animations and transitions
- Dark/Light mode toggle
- Responsive layout (mobile-first)
- Beautiful data visualizations
- Drag-and-drop category management
- Real-time budget alerts

## 📈 Future Enhancements

- Receipt upload and OCR
- Multi-currency support
- Shared budgets (family/team)
- Mobile app (React Native)
- AI-powered expense categorization
- Bank account integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 👤 Author

Built with ❤️ by a Microsoft Software Engineer

## 🆘 Support

For issues or questions, please open an issue on GitHub.
