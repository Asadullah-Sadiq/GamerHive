const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { 
  signup, 
  login,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  // Strict OTP-first endpoints
  requestSignupOTP,
  verifySignupOTP,
  requestLoginOTP,
  verifyLoginOTP,
} = require('../controllers/authController');

// Middleware to conditionally apply multer only for multipart/form-data
const optionalUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    // Apply multer middleware for form-data
    return upload.single('picture')(req, res, next);
  } else {
    // Skip multer for JSON requests
    return next();
  }
};

// Signup route with optional profile picture upload
// Handles both JSON (web) and multipart/form-data (mobile with file)
router.post('/signup', optionalUpload, signup);

// Login route
router.post('/login', login);

// OTP verification route
router.post('/verify-otp', verifyOTP);

// Resend OTP route
router.post('/resend-otp', resendOTP);

// Forgot Password routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// ============================================================================
// STRICT OTP-FIRST AUTHENTICATION ROUTES
// These routes enforce OTP verification BEFORE user creation (signup) 
// or JWT issuance (login)
// ============================================================================

// Signup Flow (OTP First)
router.post('/request-signup-otp', optionalUpload, requestSignupOTP);
router.post('/verify-signup-otp', verifySignupOTP);

// Login Flow (OTP First)
router.post('/request-login-otp', requestLoginOTP);
router.post('/verify-login-otp', verifyLoginOTP);

module.exports = router;

