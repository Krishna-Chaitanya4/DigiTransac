# DigiTransac Authentication API Documentation

## Overview

The authentication system uses JWT (JSON Web Tokens) with a dual-token strategy for security:
- **Access Token**: Short-lived (15 minutes), stored in memory (XSS-safe)
- **Refresh Token**: Long-lived (14 days), hashed and stored in MongoDB

All refresh tokens are hashed with SHA256 before storage and revoked on logout for security.

---

## API Endpoints

### Base URL
```
http://localhost:5253/api/v1
```

### 1. Register User
**POST** `/auth/register`

Creates a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "SecurePassword123",
  "fullName": "John Doe",
  "phone": "+1234567890"
}
```

**Validation Rules:**
- Email: Required, must be unique, valid email format
- Username: Required, must be unique (3-50 characters)
- Password: Required, minimum 8 characters
- FullName: Optional
- Phone: Optional

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Registration successful",
  "accessToken": "eyJhbGc...",
  "refreshToken": "abc123def456...",
  "expiresIn": 900,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "john_doe",
    "fullName": "John Doe",
    "phone": "+1234567890",
    "currency": "USD"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Email/username already exists, password too weak
- `500 Internal Server Error`: Server error

---

### 2. Login User
**POST** `/auth/login`

Authenticates a user and returns tokens.

**Request Body:**
```json
{
  "emailOrUsername": "john_doe",
  "password": "SecurePassword123"
}
```

**Validation Rules:**
- EmailOrUsername: Required
- Password: Required

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGc...",
  "refreshToken": "abc123def456...",
  "expiresIn": 900,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "john_doe",
    "fullName": "John Doe",
    "phone": "+1234567890",
    "currency": "USD"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

---

### 3. Refresh Token
**POST** `/auth/refresh`

Generates a new access token using a valid refresh token. Implements token rotation (old refresh token is revoked, new one issued).

**Request Body:**
```json
{
  "refreshToken": "abc123def456..."
}
```

**Success Response (200 OK):**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "new_refresh_token_xyz789...",
  "expiresIn": 900
}
```

**Error Responses:**
- `400 Bad Request`: Refresh token missing
- `401 Unauthorized`: Invalid, expired, or revoked refresh token
- `500 Internal Server Error`: Server error

---

### 4. Logout User
**POST** `/auth/logout`

Revokes all active refresh tokens for the user. Requires authentication.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing access token
- `500 Internal Server Error`: Server error

---

### 5. Get Current User
**GET** `/auth/me`

Retrieves the current authenticated user's profile. Requires authentication.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Success Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "username": "john_doe",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "currency": "USD"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing access token
- `500 Internal Server Error`: Server error

---

## Token Flow Diagram

```
┌─────────────────────────────────────────┐
│ 1. User Registers / Logs In             │
│ POST /auth/register or /auth/login       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. Generate Tokens                      │
│ - Access Token: 15 min (in memory)      │
│ - Refresh Token: 14 days (hashed in DB) │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. Store Tokens                         │
│ - Access: Memory (XSS-safe)             │
│ - Refresh: httpOnly cookie (CSRF-safe)  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 4. API Request with Access Token        │
│ GET /api/v1/categories                  │
│ Header: Authorization: Bearer {token}   │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
    ✅ Valid      ❌ Expired
        │             │
        │      ┌──────┴──────┐
        │      │             │
        │      ▼             ▼
        │  POST /refresh   Return 401
        │      │
        │      ▼
        │  Generate New Access Token
        │      │
        └──────┴─────► Retry Original Request
```

---

## Security Features

### 1. **Password Hashing**
- Algorithm: BCrypt
- Work Factor: 12 (adaptive hashing)
- Salted: Yes (automatic with BCrypt)

### 2. **Token Security**
- Access Token: Short-lived (15 min), stored in memory
- Refresh Token: Long-lived (14 days), hashed with SHA256
- Token Rotation: Old refresh token revoked on refresh
- Storage: Refresh token hash in MongoDB

### 3. **Revocation**
- Logout: Revokes all user refresh tokens
- Expired: Automatically removed from database
- Manual Revocation: Available for admin/security purposes

### 4. **Validation**
- Password Strength: Minimum 8 characters
- Token Expiration: Validates lifetime
- Issuer & Audience: Validates JWT claims
- Signing Key: HS256 symmetric encryption

---

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "details": {} // Optional additional details
}
```

### HTTP Status Codes
- `200 OK` - Successful request
- `400 Bad Request` - Validation error or duplicate resource
- `401 Unauthorized` - Invalid credentials or expired token
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Unhandled server error

---

## Usage Examples

### Example 1: Register and Login Flow

**Step 1: Register**
```bash
curl -X POST http://localhost:5253/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "john_doe",
    "password": "SecurePass123",
    "fullName": "John Doe"
  }'
```

**Step 2: Login**
```bash
curl -X POST http://localhost:5253/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "john_doe",
    "password": "SecurePass123"
  }'
```

**Step 3: Use Access Token**
```bash
curl -X GET http://localhost:5253/api/v1/auth/me \
  -H "Authorization: Bearer {accessToken}"
```

### Example 2: Token Refresh Flow

**Step 1: Access Token Expires**
```bash
# Original request gets 401
curl -X GET http://localhost:5253/api/v1/categories \
  -H "Authorization: Bearer {expiredToken}"
# Returns: 401 Unauthorized
```

**Step 2: Refresh Token**
```bash
curl -X POST http://localhost:5253/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "{refreshToken}"
  }'
```

**Step 3: Retry with New Token**
```bash
curl -X GET http://localhost:5253/api/v1/categories \
  -H "Authorization: Bearer {newAccessToken}"
```

---

## Database Schema

### RefreshToken Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  token: String,              // Plain token (in memory only)
  tokenHash: String,          // SHA256 hash (stored in DB)
  expiresAt: Date,            // 14 days from creation
  createdAt: Date,            // Creation timestamp
  revokedAt: Date?,           // Null if not revoked
  isRevoked: Boolean          // For quick lookup
}
```

**Indexes:**
- `tokenHash` (unique)
- `userId`
- `expiresAt` (TTL index - auto-delete)

---

## Configuration

Environment variables (in `.env` or Azure Key Vault):

```env
JWT_ISSUER=DigiTransac
JWT_AUDIENCE=DigiTransac
JWT_SIGNING_KEY=<min-32-chars-secret-key>
MONGODB_CONNECTION_STRING=mongodb://localhost:27017
MONGODB_DATABASE_NAME=DigiTransacDB
```

---

## Next Steps

1. **Implement React Auth Pages**: Login/Register UI components
2. **Setup Auth Context**: Global auth state management
3. **Create Protected Routes**: Axios interceptor for token refresh
4. **Write Unit Tests**: Password hashing, token generation
5. **Integration Tests**: Full auth flow (register → login → refresh → logout)

---

**Last Updated:** January 12, 2026
**Version:** 1.0.0
**Status:** ✅ Ready for Testing
