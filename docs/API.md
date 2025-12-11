# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Auth Endpoints

### Register
**POST** `/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "currency": "USD"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "currency": "USD"
  }
}
```

### Login
**POST** `/auth/login`

Authenticate a user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

## Categories

### Get All Categories
**GET** `/categories`

Retrieve all folders and categories in a tree structure.

**Response:**
```json
[
  {
    "id": "cat-1",
    "name": "Personal",
    "parentId": null,
    "isFolder": true,
    "children": [
      {
        "id": "cat-2",
        "name": "Housing",
        "parentId": "cat-1",
        "isFolder": true,
        "children": [
          {
            "id": "cat-3",
            "name": "Rent",
            "parentId": "cat-2",
            "isFolder": false
          }
        ]
      }
    ]
  }
]
```

### Create Category/Folder
**POST** `/categories`

**Request Body:**
```json
{
  "name": "Groceries",
  "parentId": "parent-folder-id",
  "isFolder": false,
  "icon": "shopping_cart",
  "color": "#4caf50"
}
```

### Update Category/Folder
**PUT** `/categories/:id`

### Delete Category/Folder
**DELETE** `/categories/:id`

### Move Category/Folder
**POST** `/categories/:id/move`

**Request Body:**
```json
{
  "newParentId": "new-parent-id"
}
```

---

## Expenses

### Get All Expenses
**GET** `/expenses?startDate=2024-01-01&endDate=2024-12-31&categoryId=cat-id`

Query parameters:
- `startDate` (optional): Filter by date range
- `endDate` (optional): Filter by date range
- `categoryId` (optional): Filter by category
- `page` (optional): Pagination
- `limit` (optional): Items per page

### Create Expense
**POST** `/expenses`

**Request Body:**
```json
{
  "categoryId": "category-id",
  "amount": 150.50,
  "description": "Weekly groceries",
  "date": "2024-12-11T10:00:00Z",
  "isRecurring": true,
  "recurrencePattern": {
    "frequency": "weekly",
    "interval": 1,
    "endDate": "2025-12-31T00:00:00Z"
  },
  "tags": ["food", "weekly"],
  "notes": "Bought from Costco"
}
```

### Update Expense
**PUT** `/expenses/:id`

### Delete Expense
**DELETE** `/expenses/:id`

---

## Budgets

### Get All Budgets
**GET** `/budgets`

**Response:**
```json
[
  {
    "id": "budget-1",
    "categoryId": "cat-1",
    "amount": 2000,
    "period": "monthly",
    "startDate": "2024-01-01",
    "alertThreshold": 80,
    "currentSpending": 1650,
    "percentageUsed": 82.5
  }
]
```

### Create Budget
**POST** `/budgets`

**Request Body:**
```json
{
  "categoryId": "category-id",
  "amount": 2000,
  "period": "monthly",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "alertThreshold": 80
}
```

### Get Budget Alerts
**GET** `/budgets/alerts`

Returns budgets that have exceeded the alert threshold.

---

## Analytics

### Get Summary
**GET** `/analytics/summary?startDate=2024-01-01&endDate=2024-12-31`

**Response:**
```json
{
  "totalExpenses": 12500.50,
  "expenseCount": 145,
  "averageExpense": 86.21,
  "topCategories": [
    {
      "categoryId": "cat-1",
      "categoryName": "Housing",
      "amount": 4500,
      "percentage": 36
    }
  ],
  "monthlyTrend": [
    {
      "month": "2024-01",
      "amount": 1200
    }
  ]
}
```

### Get Category Analytics
**GET** `/analytics/category/:categoryId?startDate=2024-01-01&endDate=2024-12-31`

Drill-down analytics for a specific category/folder (includes children).

### Export Data
**GET** `/analytics/export?format=csv&startDate=2024-01-01&endDate=2024-12-31`

Query parameters:
- `format`: `csv` or `pdf`
- `startDate`: Start date for export
- `endDate`: End date for export

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
