# Phase 1.B: React Frontend Integration with .NET Backend

**Status:** ✅ All frontend components ready, needs .NET endpoint integration  
**Estimated Effort:** 2-3 hours  
**Priority:** HIGH - Unblocks full Phase 1 completion

---

## 📋 Integration Checklist

### **Task 1: Update AuthContext.tsx for .NET API** 🔴 PENDING
**Current Issue:** Login/Register use old Node.js endpoints (`/api/auth/login`, `/api/auth/register`)  
**Need:** Update to .NET API endpoints (`/api/v1/auth/login`, `/api/v1/auth/register`)

**Changes Required:**
```typescript
// BEFORE (Line 156):
const loginUrl = '/api/auth/login';

// AFTER:
const loginUrl = '/api/v1/auth/login';
```

**Also Update:**
- Line 212: Register endpoint from `/api/auth/register` → `/api/v1/auth/register`
- Line 96: Update error handling for .NET error format

**Expected .NET Response Format:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "fullName": "Full Name"
    }
  },
  "message": "Login successful"
}
```

**Current Response Format (Old Node.js):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

⚠️ **NOTE:** Different field locations! .NET wraps in `data` object.

---

### **Task 2: Update API Configuration** 🔴 PENDING
**File:** `frontend/src/services/config.service.ts`

**Current State:**
- Using Vite proxy for development (relative URLs)
- Trying to fetch runtime config from Node.js backend

**Action Required:**
1. Update to point to .NET backend
2. Use hardcoded baseURL for now (simplify): `http://localhost:5253` (dev)
3. Can make dynamic later via environment variables

**Updated Code:**
```typescript
class ConfigService {
  private apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5253';
  
  getApiUrl(): string {
    return this.apiUrl;
  }
  
  async fetchConfig(): Promise<void> {
    // May not need this if we hardcode for now
    // .NET backend doesn't have a config endpoint yet
  }
}
```

---

### **Task 3: Update Register Page UI** 🔴 PENDING
**File:** `frontend/src/pages/Register.tsx` (1019 lines)

**Current Fields:**
- Email ✅
- Phone ✅ (remove for v1)
- Username ✅
- Full Name ✅
- Date of Birth ✅ (remove for v1)
- Password ✅
- Currency ✅ (remove for v1)

**New Fields (v1 MVP):**
- Email ✅ (keep)
- Username ✅ (keep)
- Full Name ✅ (keep)
- Password ✅ (keep)
- Confirm Password ✅ (add)

**Changes:**
1. Remove phone number input and validation
2. Remove date of birth picker
3. Remove currency selector
4. Update RegisterData interface in AuthContext
5. Add password confirmation field

---

### **Task 4: Handle Response Format Differences** 🔴 PENDING
**Issue:** .NET wraps response data in `data` object, Node.js doesn't

**Files to Update:**
1. `AuthContext.tsx` - login() function (line 175)
2. `AuthContext.tsx` - register() function (line 216)

**Current Code (Node.js format):**
```typescript
const { token: newToken, user: userData } = data;
```

**New Code (.NET format):**
```typescript
const { token: newToken, user: userData } = data.data || data;
// Fallback to data.data for .NET, or data for Node.js
```

---

### **Task 5: Verify Error Handling** 🔴 PENDING
**Issue:** Error response format differs between backends

**.NET Error Format:**
```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid username/email or password",
  "details": {}
}
```

**Current Code Expects:**
```json
{
  "success": false,
  "message": "Invalid username/email or password"
}
```

**Update Required:**
- Update error extraction to check for `.error` field
- Map error codes to user-friendly messages

---

### **Task 6: Update axios Configuration** 🔴 PENDING
**File:** `frontend/src/services/api.ts`

**Current Setup:**
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
// Vite proxy routes /api → http://localhost:3000/api
```

**Need:**
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5253';
// Direct .NET API URL
```

---

### **Task 7: Test End-to-End** 🔴 PENDING

**Prerequisites:**
- ✅ .NET API running on `http://localhost:5253`
- ✅ MongoDB running on `localhost:27017`
- ✅ React running on `http://localhost:5173`

**Test Cases:**
1. **Register Flow:**
   - [ ] Fill registration form (email, username, password, fullName)
   - [ ] Click Register
   - [ ] Verify API call to `/api/v1/auth/register`
   - [ ] Verify token stored in localStorage
   - [ ] Verify redirect to Dashboard

2. **Login Flow:**
   - [ ] Fill login form (email/username, password)
   - [ ] Click Login
   - [ ] Verify API call to `/api/v1/auth/login`
   - [ ] Verify token stored in localStorage
   - [ ] Verify redirect to Dashboard

3. **Protected Routes:**
   - [ ] Try accessing `/dashboard` without token → redirect to `/login`
   - [ ] Login → access `/dashboard` → works

4. **Logout:**
   - [ ] Click Logout
   - [ ] Verify token cleared from localStorage
   - [ ] Verify redirect to `/login`

5. **Error Scenarios:**
   - [ ] Register with duplicate email → shows error
   - [ ] Register with weak password → shows error
   - [ ] Login with wrong password → shows error
   - [ ] API down → shows helpful error message

---

## 🔧 Implementation Steps

### **Step 1: Update AuthContext.tsx**
**File:** `frontend/src/context/AuthContext.tsx`

**Exact Changes:**

1. **Update login endpoint (line 156):**
   ```typescript
   // OLD:
   const loginUrl = '/api/auth/login';
   
   // NEW:
   const loginUrl = '/api/v1/auth/login';
   ```

2. **Update response parsing (line 175):**
   ```typescript
   // OLD:
   const { token: newToken, user: userData } = data;
   
   // NEW:
   // Handle both .NET format (with data wrapper) and Node.js format
   const responseData = data.data || data;
   const { token: newToken, user: userData } = responseData;
   ```

3. **Update register endpoint (line 212):**
   ```typescript
   // OLD:
   const response = await axios.post<AuthResponse>('/api/auth/register', data);
   
   // NEW:
   const response = await axios.post<AuthResponse>('/api/v1/auth/register', data);
   ```

4. **Update register response parsing (line 217):**
   ```typescript
   // OLD:
   const { token: newToken, user: userData } = response.data;
   
   // NEW:
   const responseData = response.data.data || response.data;
   const { token: newToken, user: userData } = responseData;
   ```

---

### **Step 2: Update Register Page**
**File:** `frontend/src/pages/Register.tsx`

Remove fields:
- Phone number input section
- Date of birth picker
- Currency selector

Simplify to:
- Email
- Username  
- Full Name
- Password
- Confirm Password

---

### **Step 3: Update API Configuration**
**File:** `frontend/src/services/api.ts`

```typescript
// OLD:
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// NEW:
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5253';
```

---

### **Step 4: Update AuthContext User Interface**
Remove optional fields from User interface:

```typescript
// OLD:
interface User {
  id: string;
  email?: string;
  phone?: string;
  username: string;
  fullName: string;
  dateOfBirth?: string;
  currency: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

// NEW:
interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
}
```

Update RegisterData interface:

```typescript
// OLD:
interface RegisterData {
  email?: string;
  phone?: string;
  username: string;
  fullName: string;
  dateOfBirth?: string;
  password: string;
  currency: string;
}

// NEW:
interface RegisterData {
  email: string;
  username: string;
  fullName: string;
  password: string;
}
```

---

### **Step 5: Update Vite Proxy**
**File:** `frontend/vite.config.ts`

**Remove old proxy** (if using Node.js API):
```typescript
// OLD proxy config:
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  }
}

// NEW: No proxy needed - direct to .NET API
// Remove proxy entirely
```

---

### **Step 6: Test Integration**

**Start Services:**
```bash
# Terminal 1: Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Terminal 2: Start .NET API
cd e:\personal\DigiTransac\DigiTransac.Net\src\DigiTransac.API
dotnet run

# Terminal 3: Start React
cd e:\personal\DigiTransac\frontend
npm run dev
```

**Test Cases:**
```bash
# Open browser to http://localhost:5173

# Test 1: Register
- Click "Register" link
- Fill in: email@example.com, testuser, John Doe, password, confirm password
- Click Register
- Should see: "Creating account..." → Success → Redirect to Dashboard

# Test 2: Logout
- Click Profile → Logout
- Should redirect to Login page

# Test 3: Login  
- Enter email@example.com and password
- Click Login
- Should see: "Signing in..." → Success → Redirect to Dashboard

# Test 4: Protected Route
- Manually clear localStorage: localStorage.removeItem('auth-token')
- Try accessing http://localhost:5173/dashboard
- Should redirect to http://localhost:5173/login
```

---

## ✅ Completion Criteria

Phase 1.B is **complete** when:

- ✅ Login endpoint updated to `/api/v1/auth/login`
- ✅ Register endpoint updated to `/api/v1/auth/register`
- ✅ Response parsing handles .NET format (with `data` wrapper)
- ✅ Register page simplified (email, username, fullName, password only)
- ✅ All 6 test cases pass without errors
- ✅ Token persisted in localStorage
- ✅ Protected routes work correctly
- ✅ Logout clears token and redirects

---

## 📊 Testing Progress Tracker

| Test | Status | Result |
|------|--------|--------|
| Register flow | ⏳ Not started | - |
| Login flow | ⏳ Not started | - |
| Protected routes | ⏳ Not started | - |
| Logout flow | ⏳ Not started | - |
| Error handling | ⏳ Not started | - |
| End-to-end flow | ⏳ Not started | - |

---

## 🎯 Next Actions

**After completing above:**
1. Verify all auth flows work
2. Update agents.md with Phase 1.B completion
3. Commit changes
4. Start Phase 2 (Categories)

---

**Last Updated:** January 12, 2026  
**Phase 1.B Target Completion:** January 13, 2026  
**Estimated Time to Complete:** 2-3 hours

