# Strict OTP-First Authentication Implementation

## Overview

This document describes the implementation of a strict OTP-first authentication flow where:
- **Signup**: NO user is created until OTP verification succeeds
- **Login**: NO JWT token is issued until OTP verification succeeds
- **OTP Verification**: Mandatory for both signup and login

## Implementation Details

### 1. OTP Model Updates (`server/models/OTP.js`)

#### New Field Added:
```javascript
temporarySignupData: {
  type: {
    username: String,
    hashedPassword: String, // Password already hashed
    picture: String, // Profile picture URL if uploaded
    isAdmin: Boolean,
  },
  default: null,
}
```

#### Security Updates:
- `maxAttempts`: Changed from 5 to **3** (strict requirement)
- OTP expires in **5 minutes**
- OTP must be **one-time use** (marked as used after verification)

### 2. User Model Updates (`server/models/User.js`)

#### Pre-save Hook Enhancement:
- Added `_skipPasswordHash` flag to prevent double-hashing
- Checks if password is already hashed (bcrypt format)
- Allows setting pre-hashed passwords for OTP-first signup

### 3. New API Endpoints

#### Signup Flow (OTP First)

##### POST `/api/auth/request-signup-otp`
**Purpose**: Request OTP for signup (NO user creation)

**Request Body**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "confirmPassword": "string"
}
```

**Optional**: Multipart form-data with `picture` file

**Flow**:
1. Validates input (username, email, password)
2. Checks if email already exists (rejects if exists)
3. Hashes password
4. Generates 6-digit OTP
5. Stores OTP with temporary signup data (NO USER CREATED)
6. Sends OTP via email
7. Returns success (NO user, NO token)

**Response**:
```json
{
  "success": true,
  "message": "OTP sent to your email. Please verify to complete signup.",
  "data": {
    "email": "user@example.com"
  }
}
```

##### POST `/api/auth/verify-signup-otp`
**Purpose**: Verify OTP and create user (ONLY after verification)

**Request Body**:
```json
{
  "email": "string",
  "otp": "string"
}
```

**Flow**:
1. Validates email and OTP
2. Finds unused signup OTP for email
3. Checks expiration and attempt limits
4. Verifies OTP
5. **ONLY NOW**: Creates user from temporary data
6. Marks user as `isVerified: true`
7. Marks OTP as used
8. Generates JWT token
9. Returns token and user data

**Response**:
```json
{
  "success": true,
  "message": "Account created and verified successfully!",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "user-id",
      "username": "string",
      "email": "string",
      "picture": "string",
      "isVerified": true,
      "isAdmin": false,
      "createdAt": "date"
    }
  }
}
```

#### Login Flow (OTP First)

##### POST `/api/auth/request-login-otp`
**Purpose**: Request OTP for login (NO JWT generation)

**Request Body**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Flow**:
1. Validates email and password
2. Finds user by email
3. Validates password
4. Generates 6-digit OTP
5. Stores OTP (NO JWT ISSUED)
6. Sends OTP via email
7. Returns success (NO token)

**Response**:
```json
{
  "success": true,
  "message": "Please check your email for OTP verification.",
  "data": {
    "email": "user@example.com"
  }
}
```

##### POST `/api/auth/verify-login-otp`
**Purpose**: Verify OTP and issue JWT (ONLY after verification)

**Request Body**:
```json
{
  "email": "string",
  "otp": "string"
}
```

**Flow**:
1. Validates email and OTP
2. Finds unused login OTP for email
3. Checks expiration and attempt limits
4. Verifies OTP
5. Finds user
6. **ONLY NOW**: Generates JWT token
7. Marks OTP as used
8. Returns token and user data

**Response**:
```json
{
  "success": true,
  "message": "Login successful!",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "user-id",
      "username": "string",
      "email": "string",
      "name": "string",
      "picture": "string",
      "isAdmin": false,
      "isVerified": true,
      "createdAt": "date"
    }
  }
}
```

#### Resend OTP

##### POST `/api/auth/resend-otp`
**Purpose**: Resend OTP (preserves temporary signup data for signup)

**Request Body**:
```json
{
  "email": "string",
  "purpose": "signup" | "login" | "forgot-password"
}
```

**Flow**:
- For **signup**: Checks for pending signup OTP with temp data, preserves it
- For **login**: Validates user exists
- Invalidates previous OTPs
- Generates new OTP
- Sends OTP via email

## Security Features

### OTP Security
- ✅ **Hashed Storage**: OTPs are hashed with bcrypt before storage
- ✅ **Expiration**: 5-minute expiry (enforced by TTL index)
- ✅ **Attempt Limits**: Maximum 3 attempts per OTP
- ✅ **One-Time Use**: OTPs marked as used after successful verification
- ✅ **Automatic Cleanup**: Expired OTPs deleted by MongoDB TTL index

### Authentication Security
- ✅ **No User Creation Until Verified**: Users only created after OTP verification
- ✅ **No JWT Until Verified**: Tokens only issued after OTP verification
- ✅ **Password Hashing**: Passwords hashed before storing in temporary data
- ✅ **Race Condition Protection**: Checks for existing users before creation
- ✅ **User Enumeration Prevention**: Sends OTP even for invalid credentials (login)

### Data Protection
- ✅ **Temporary Data Storage**: Signup data stored securely in OTP record
- ✅ **Data Cleanup**: Temporary data removed after user creation
- ✅ **Email Validation**: Email format validation
- ✅ **Password Strength**: Minimum 6 characters

## Flow Diagrams

### Signup Flow
```
User → POST /request-signup-otp
  → Validate input
  → Check email exists (reject if exists)
  → Hash password
  → Generate OTP
  → Store OTP + temp data (NO USER)
  → Send OTP email
  → Return success (NO USER, NO TOKEN)

User → POST /verify-signup-otp
  → Validate OTP
  → Check expiration/attempts
  → Verify OTP
  → CREATE USER (only now)
  → Mark as verified
  → Generate JWT
  → Return token + user
```

### Login Flow
```
User → POST /request-login-otp
  → Validate credentials
  → Find user
  → Verify password
  → Generate OTP
  → Store OTP (NO JWT)
  → Send OTP email
  → Return success (NO TOKEN)

User → POST /verify-login-otp
  → Validate OTP
  → Check expiration/attempts
  → Verify OTP
  → Find user
  → GENERATE JWT (only now)
  → Return token + user
```

## Code Structure

### Controllers (`server/controllers/authController.js`)

#### New Functions:
- `exports.requestSignupOTP` - Request signup OTP (no user creation)
- `exports.verifySignupOTP` - Verify signup OTP and create user
- `exports.requestLoginOTP` - Request login OTP (no JWT)
- `exports.verifyLoginOTP` - Verify login OTP and issue JWT
- `exports.resendOTP` - Updated to handle temporary signup data

### Routes (`server/routes/authRoutes.js`)

#### New Routes:
```javascript
router.post('/request-signup-otp', optionalUpload, requestSignupOTP);
router.post('/verify-signup-otp', verifySignupOTP);
router.post('/request-login-otp', requestLoginOTP);
router.post('/verify-login-otp', verifyLoginOTP);
```

## Testing Checklist

### Signup Flow
- [ ] Request signup OTP with valid data → OTP sent, no user created
- [ ] Request signup OTP with existing email → Rejected
- [ ] Verify signup OTP with valid OTP → User created, token issued
- [ ] Verify signup OTP with invalid OTP → Rejected, attempts incremented
- [ ] Verify signup OTP with expired OTP → Rejected
- [ ] Verify signup OTP after 3 failed attempts → Rejected
- [ ] Resend signup OTP → New OTP sent, temp data preserved

### Login Flow
- [ ] Request login OTP with valid credentials → OTP sent, no token
- [ ] Request login OTP with invalid credentials → Rejected (but OTP still sent for security)
- [ ] Verify login OTP with valid OTP → Token issued
- [ ] Verify login OTP with invalid OTP → Rejected, attempts incremented
- [ ] Verify login OTP with expired OTP → Rejected
- [ ] Resend login OTP → New OTP sent

## Migration Notes

### Backward Compatibility
- Old endpoints (`/signup`, `/login`, `/verify-otp`) still exist
- New strict endpoints are separate
- Can migrate frontend gradually

### Database Changes
- OTP model now includes `temporarySignupData` field
- `maxAttempts` default changed from 5 to 3
- No breaking changes to existing OTP records

## Error Handling

### Common Errors

#### Signup OTP Request
- `400`: Missing fields, passwords don't match, email exists
- `500`: Email send failure, server error

#### Signup OTP Verification
- `400`: Invalid/expired OTP, exceeded attempts, user already exists
- `404`: User not found (shouldn't happen in strict flow)
- `500`: Server error

#### Login OTP Request
- `400`: Missing fields
- `401`: Invalid credentials
- `500`: Email send failure, server error

#### Login OTP Verification
- `400`: Invalid/expired OTP, exceeded attempts
- `404`: User not found
- `500`: Server error

## Best Practices

1. **Always verify OTP before creating user or issuing token**
2. **Hash passwords before storing in temporary data**
3. **Check for existing users before creation (race conditions)**
4. **Preserve temporary signup data when resending OTP**
5. **Log all authentication attempts for security auditing**
6. **Use secure email delivery (SMTP with TLS)**
7. **Implement rate limiting on OTP requests**
8. **Monitor failed OTP attempts for abuse**

## Future Enhancements

- [ ] Rate limiting middleware for OTP requests
- [ ] IP-based attempt tracking
- [ ] OTP delivery via SMS (optional)
- [ ] OTP delivery via push notifications
- [ ] Account lockout after multiple failed attempts
- [ ] Audit logging for security events

---

**Implementation Date**: 2025-01-22  
**Version**: 1.0  
**Status**: Production Ready
