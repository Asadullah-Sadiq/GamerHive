# Email OTP Authentication System - Setup Guide

## Overview
This system implements a professional Email OTP (One-Time Password) authentication system for signup and login. Users must verify their email via OTP before accessing their accounts.

## Features
- ✅ 6-digit OTP generation
- ✅ Secure OTP hashing using bcrypt
- ✅ 5-minute OTP expiration
- ✅ One-time use OTPs
- ✅ Maximum 5 verification attempts per OTP
- ✅ Automatic cleanup of expired OTPs (TTL index)
- ✅ Professional HTML email templates
- ✅ Resend OTP functionality

## Installation

### 1. Install Required Dependencies
```bash
npm install nodemailer
```

### 2. Environment Variables
Add the following variables to your `.env` file:

```env
# Email Service Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Existing JWT Configuration (should already exist)
JWT_SECRET=your-jwt-secret
JWT_EXPIRE=7d
```

### 3. Gmail Setup (if using Gmail)
1. Enable 2-Step Verification on your Google account
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this app password as `SMTP_PASS` (not your regular password)

### 4. Alternative Email Services
You can use other SMTP services:
- **SendGrid**: `smtp.sendgrid.net` (port 587)
- **AWS SES**: Use AWS SES SMTP credentials
- **Mailgun**: Use Mailgun SMTP settings
- **Outlook**: `smtp-mail.outlook.com` (port 587)

## API Endpoints

### 1. Signup with OTP
**POST** `/api/auth/signup`

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please check your email for OTP verification.",
  "data": {
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "isVerified": false
    }
  }
}
```

**Note:** No JWT token is returned. User must verify OTP first.

---

### 2. Login with OTP
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Please check your email for OTP verification.",
  "data": {
    "email": "john@example.com"
  }
}
```

**Note:** No JWT token is returned. User must verify OTP first.

---

### 3. Verify OTP
**POST** `/api/auth/verify-otp`

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456",
  "purpose": "signup" // or "login"
}
```

**Response (Signup):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "isVerified": true
    },
    "token": "jwt_token_here"
  }
}
```

**Response (Login):**
```json
{
  "success": true,
  "message": "OTP verified successfully. Login successful.",
  "data": {
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "token": "jwt_token_here"
  }
}
```

---

### 4. Resend OTP
**POST** `/api/auth/resend-otp`

**Request Body:**
```json
{
  "email": "john@example.com",
  "purpose": "signup" // or "login"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP has been resent to your email. Please check your inbox."
}
```

## Database Models

### User Model Updates
- Added `isVerified` field (Boolean, default: false)
- Users must verify email before account activation

### OTP Model
- `email`: User's email address
- `hashedOtp`: Bcrypt hashed OTP
- `purpose`: "signup" or "login"
- `expiresAt`: OTP expiration timestamp (5 minutes)
- `isUsed`: Whether OTP has been used
- `attempts`: Number of verification attempts
- `maxAttempts`: Maximum attempts allowed (default: 5)

## Security Features

1. **OTP Hashing**: OTPs are hashed using bcrypt before storage
2. **Expiration**: OTPs expire after 5 minutes
3. **One-Time Use**: Each OTP can only be used once
4. **Attempt Limiting**: Maximum 5 verification attempts per OTP
5. **Auto Cleanup**: Expired OTPs are automatically deleted via TTL index
6. **Previous OTP Invalidation**: New OTPs invalidate previous ones

## Flow Diagrams

### Signup Flow
```
1. User submits signup form
2. User created with isVerified=false
3. OTP generated and sent via email
4. User enters OTP
5. OTP verified → isVerified=true
6. JWT token issued
```

### Login Flow
```
1. User submits login form (email + password)
2. Credentials validated
3. OTP generated and sent via email
4. User enters OTP
5. OTP verified → JWT token issued
```

## Error Handling

### Common Error Responses

**Invalid OTP:**
```json
{
  "success": false,
  "message": "Invalid OTP. You have 4 attempt(s) remaining."
}
```

**Expired OTP:**
```json
{
  "success": false,
  "message": "OTP has expired. Please request a new one."
}
```

**Max Attempts Exceeded:**
```json
{
  "success": false,
  "message": "OTP has exceeded maximum attempts or is already used."
}
```

## Testing

### Test Email Service Configuration
You can verify your email configuration by running:
```javascript
const { verifyEmailConfig } = require('./utils/emailService');
verifyEmailConfig().then(isValid => {
  console.log('Email config valid:', isValid);
});
```

## Production Considerations

1. **Email Service**: Use a production email service (SendGrid, AWS SES, etc.)
2. **Rate Limiting**: Implement rate limiting on OTP endpoints
3. **Monitoring**: Monitor OTP generation and verification rates
4. **Logging**: Log all OTP-related activities for security auditing
5. **Email Templates**: Customize email templates for your brand

## Troubleshooting

### Email Not Sending
1. Check SMTP credentials in `.env`
2. Verify email service configuration
3. Check firewall/network restrictions
4. For Gmail: Ensure app password is used (not regular password)

### OTP Not Working
1. Check MongoDB connection
2. Verify OTP model is properly registered
3. Check expiration time (5 minutes)
4. Verify OTP hasn't been used already

## Notes

- Existing authentication logic is preserved and extended
- OTP system is integrated cleanly without breaking existing functionality
- All OTPs are automatically cleaned up after expiration (TTL index)
- Previous OTPs are invalidated when new ones are generated
