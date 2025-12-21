import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DigiTransac API',
      version: '1.1.0',
      description:
        'A comprehensive transaction management API with budget tracking, analytics, and Gmail integration',
      contact: {
        name: 'API Support',
        email: 'support@digitransac.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development server',
      },
      {
        url: 'https://digitransac-api.azurewebsites.net/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message',
            },
            statusCode: {
              type: 'integer',
              description: 'HTTP status code',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            name: {
              type: 'string',
              description: 'User full name',
            },
            currency: {
              type: 'string',
              description: 'Preferred currency code (e.g., USD, EUR)',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
            },
            userId: {
              type: 'string',
            },
            accountId: {
              type: 'string',
            },
            amount: {
              type: 'number',
              format: 'double',
            },
            description: {
              type: 'string',
            },
            date: {
              type: 'string',
              format: 'date-time',
            },
            categoryId: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: ['income', 'expense', 'transfer'],
            },
            reviewStatus: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
          },
        },
        Category: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
            },
            userId: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
            parentId: {
              type: 'string',
              nullable: true,
            },
            icon: {
              type: 'string',
            },
            color: {
              type: 'string',
            },
          },
        },
        Budget: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
            },
            userId: {
              type: 'string',
            },
            categoryId: {
              type: 'string',
            },
            amount: {
              type: 'number',
            },
            period: {
              type: 'string',
              enum: ['monthly', 'yearly', 'quarterly'],
            },
            alertThreshold: {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication endpoints',
      },
      {
        name: 'Users',
        description: 'User management',
      },
      {
        name: 'Transactions',
        description: 'Transaction management',
      },
      {
        name: 'Categories',
        description: 'Category management with nested hierarchies',
      },
      {
        name: 'Budgets',
        description: 'Budget tracking and alerts',
      },
      {
        name: 'Analytics',
        description: 'Financial analytics and reports',
      },
      {
        name: 'Accounts',
        description: 'Account management',
      },
      {
        name: 'Gmail',
        description: 'Gmail integration for transaction parsing',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/server.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application) {
  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'DigiTransac API Docs',
    })
  );

  // Swagger JSON
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
