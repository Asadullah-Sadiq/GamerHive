const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { generateOTP, hashOTP, verifyOTP, createExpirationDate } = require('../utils/otpUtils');
const { sendOTPEmail } = require('../utils/emailService');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Signup Controller
exports.signup = async (req, res) => {
  try {
    console.log('Signup request received:', { 
      username: req.body.username, 
      email: req.body.email,
      hasPassword: !!req.body.password,
      hasFile: !!req.file
    });

    // Handle multer errors (file upload errors)
    if (req.fileError) {
      return res.status(400).json({
        success: false,
        message: req.fileError.message || 'File upload error',
      });
    }

    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      console.log('Validation failed: Missing fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if user already exists (by email)
    const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is already taken',
      });
    }

    // Username uniqueness is not required - multiple users can have the same username

    // Handle profile picture upload
    let pictureUrl = null;
    if (req.file) {
      // File is saved in uploads folder, create URL for access - always use localhost
      const port = process.env.PORT || 3000;
      pictureUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
      console.log('Profile picture uploaded:', pictureUrl);
    }

    // Admin email - same as in frontend
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    
    // Create new user with isVerified = false
    const user = new User({
      username,
      email,
      password,
      picture: pictureUrl, // Save picture URL if uploaded
      isAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase(), // Set admin flag if admin email
      isVerified: false, // Email verification required via OTP
    });

    // Save user to database
    console.log('Saving user to database...');
    await user.save();
    console.log('User saved successfully:', user._id);

    // Generate 6-digit OTP
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    const expiresAt = createExpirationDate(5); // 5 minutes expiration

    // Invalidate any previous signup OTPs for this email
    await OTP.invalidatePrevious(email.toLowerCase(), 'signup');

    // Save OTP to database
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      hashedOtp,
      purpose: 'signup',
      expiresAt,
      isUsed: false,
    });
    await otpRecord.save();
    console.log('OTP saved for signup:', email);

    // Send OTP via email
    try {
      await sendOTPEmail(email, otp, 'signup');
      console.log('OTP email sent successfully to:', email);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Don't fail the signup if email fails, but log the error
      // In production, you might want to handle this differently
    }

    // Emit real-time event for new user registration (for admin dashboard)
    try {
      const io = req.app ? req.app.get('io') : null;
      if (io) {
        io.emit('new_user_registered', {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.name,
            picture: user.picture,
            isAdmin: user.isAdmin || false,
            isActive: user.isActive !== undefined ? user.isActive : true,
            isVerified: user.isVerified || false,
            createdAt: user.createdAt,
            friendsCount: 0,
          },
        });
        console.log(`📡 Emitted new_user_registered event for user ${user._id}`);
      }
    } catch (socketError) {
      console.error('Error emitting new user registration:', socketError);
      // Don't fail the request if socket emit fails
    }

    // Return success response (no token yet - user must verify OTP first)
    console.log('Signup successful for user:', username);
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for OTP verification.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          picture: user.picture,
          isVerified: false,
          createdAt: user.createdAt,
        },
        // No token - user must verify OTP first
      },
    });
  } catch (error) {
    console.error('Signup error:', error);

    // Handle multer/file upload errors
    if (error.name === 'MulterError') {
      return res.status(400).json({
        success: false,
        message: error.message || 'File upload error',
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    // Handle duplicate key error (only for email, username duplicates are allowed)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      // Only return error if it's email duplication (username duplicates are allowed)
      if (field === 'email') {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken',
        });
      }
      // For username duplicates: This means the database still has a unique index
      // Run the migration script: node server/scripts/removeUsernameIndex.js
      console.warn(`Duplicate key error for ${field} - database still has unique index`);
      if (field === 'username') {
        console.error('ACTION REQUIRED: Run "node server/scripts/removeUsernameIndex.js" to remove the username unique index');
        return res.status(400).json({
          success: false,
          message: 'Username already exists. Please run the database migration script to allow duplicate usernames.',
        });
      }
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Login Controller
exports.login = async (req, res) => {
  try {
    console.log('Login request received:', { 
      email: req.body.email,
      hasPassword: !!req.body.password 
    });

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      console.log('Validation failed: Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email and include password (since it's select: false by default)
    // Normalize email to lowercase for consistent lookup (emails are stored in lowercase)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      console.log('Login failed: User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      console.log('Login failed: Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Admin email - same as in frontend
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    
    // Ensure admin flag is set for admin email user
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && !user.isAdmin) {
      user.isAdmin = true;
      await user.save();
      console.log('Admin flag set for admin email user:', user.email);
    }

    // Check if account was deactivated before reactivating
    const wasDeactivated = !user.isActive;
    
    // If account was deactivated, reactivate it on login
    if (wasDeactivated) {
      user.isActive = true;
      await user.save();
      console.log('Account reactivated on login:', user.username);
    }

    // Generate 6-digit OTP for login
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    const expiresAt = createExpirationDate(5); // 5 minutes expiration

    // Invalidate any previous login OTPs for this email
    await OTP.invalidatePrevious(email.toLowerCase(), 'login');

    // Save OTP to database
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      hashedOtp,
      purpose: 'login',
      expiresAt,
      isUsed: false,
    });
    await otpRecord.save();
    console.log('OTP saved for login:', email);

    // Send OTP via email
    try {
      await sendOTPEmail(email, otp, 'login');
      console.log('OTP email sent successfully to:', email);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    // Return success response (no token yet - user must verify OTP first)
    const loginMessage = wasDeactivated 
      ? 'Account reactivated. Please check your email for OTP verification.' 
      : 'Please check your email for OTP verification.';
    
    console.log('Login OTP sent for user:', user.username);
    res.status(200).json({
      success: true,
      message: loginMessage,
      data: {
        email: user.email,
        // No token - user must verify OTP first
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    // Generic error
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Verify OTP Controller
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;

    // Validation
    if (!email || !otp || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and purpose are required',
      });
    }

    if (!['signup', 'login', 'forgot-password'].includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: 'Purpose must be either "signup", "login", or "forgot-password"',
      });
    }

    // Find the most recent unused OTP for this email and purpose
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose,
      isUsed: false,
    }).sort({ createdAt: -1 }); // Get the most recent one

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
    }

    // Check if OTP is expired
    if (otpRecord.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Check if OTP can be used (within attempt limit)
    if (!otpRecord.canBeUsed()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has exceeded maximum attempts or is already used.',
      });
    }

    // Verify OTP
    const isOtpValid = await verifyOTP(otp, otpRecord.hashedOtp);

    if (!isOtpValid) {
      // Increment attempts
      await otpRecord.incrementAttempts();
      
      const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts > 0 ? `You have ${remainingAttempts} attempt(s) remaining.` : 'No attempts remaining. Please request a new OTP.'}`,
      });
    }

    // Handle based on purpose
    if (purpose === 'forgot-password') {
      // For forgot-password, DON'T mark as used yet - it will be used when resetting password
      // Just verify and return success
      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully. You can now reset your password.',
      });
    }
    
    // For signup and login, mark OTP as used after verification
    await otpRecord.markAsUsed();

    // Handle based on purpose
    if (purpose === 'signup') {
      // Find user and mark as verified
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified',
        });
      }

      // Mark user as verified
      user.isVerified = true;
      await user.save();
      console.log('User email verified:', user.email);

      // Generate JWT token
      const token = generateToken(user._id);

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            picture: user.picture,
            isVerified: true,
            createdAt: user.createdAt,
          },
          token,
        },
      });
    } else if (purpose === 'login') {
      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.',
        });
      }

      // Admin email - same as in frontend
      const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
      
      // Ensure admin flag is set for admin email user
      if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && !user.isAdmin) {
        user.isAdmin = true;
        await user.save();
        console.log('Admin flag set for admin email user:', user.email);
      }

      // Generate JWT token
      const token = generateToken(user._id);

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully. Login successful.',
        data: {
          user: {
            id: user._id,
            username: user.username,
            name: user.name,
            email: user.email,
            picture: user.picture,
            coverPhoto: user.coverPhoto,
            joinedCommunities: user.joinedCommunities || [],
            isActive: user.isActive,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
          },
          token,
        },
      });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Resend OTP Controller
exports.resendOTP = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    // Validation
    if (!email || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email and purpose are required',
      });
    }

    if (!['signup', 'login', 'forgot-password'].includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: 'Purpose must be either "signup", "login", or "forgot-password"',
      });
    }

    // For signup (strict OTP-first): Check if there's a pending signup OTP with temp data
    if (purpose === 'signup') {
      const existingSignupOTP = await OTP.findOne({
        email: email.toLowerCase(),
        purpose: 'signup',
        isUsed: false,
      }).sort({ createdAt: -1 });

      // If no pending signup OTP exists, user needs to request signup OTP first
      if (!existingSignupOTP || !existingSignupOTP.temporarySignupData) {
        return res.status(400).json({
          success: false,
          message: 'No pending signup request found. Please request signup OTP first.',
        });
      }

      // Check if user already exists (race condition)
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists. Please login instead.',
        });
      }
    }

    // Check if user exists (for login and forgot-password purposes)
    if (purpose === 'login' || purpose === 'forgot-password') {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
    }

    // Invalidate previous OTPs
    await OTP.invalidatePrevious(email.toLowerCase(), purpose);

    // For signup: Preserve temporary signup data
    let temporarySignupData = null;
    if (purpose === 'signup') {
      const existingSignupOTP = await OTP.findOne({
        email: email.toLowerCase(),
        purpose: 'signup',
      }).sort({ createdAt: -1 });
      
      if (existingSignupOTP && existingSignupOTP.temporarySignupData) {
        temporarySignupData = existingSignupOTP.temporarySignupData;
      }
    }

    // Generate new OTP
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    const expiresAt = createExpirationDate(5); // 5 minutes expiration

    // Save new OTP to database (with temp data for signup)
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      hashedOtp,
      purpose,
      expiresAt,
      isUsed: false,
      attempts: 0,
      maxAttempts: 3, // Strict: 3 attempts max
      temporarySignupData: temporarySignupData, // Preserve for signup
    });
    await otpRecord.save();
    console.log('[Resend OTP] New OTP saved for resend:', email);

    // Send OTP via email
    try {
      await sendOTPEmail(email, otp, purpose);
      console.log('Resend OTP email sent successfully to:', email);
    } catch (emailError) {
      console.error('Failed to send resend OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP has been resent to your email. Please check your inbox.',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Forgot Password - Request OTP
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset OTP.',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    const expiresAt = createExpirationDate(5); // 5 minutes expiration

    // Invalidate any previous forgot-password OTPs for this email
    await OTP.invalidatePrevious(email.toLowerCase(), 'forgot-password');

    // Save OTP to database
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      hashedOtp,
      purpose: 'forgot-password',
      expiresAt,
      isUsed: false,
    });
    await otpRecord.save();
    console.log('OTP saved for forgot password:', email);

    // Send OTP via email
    try {
      await sendOTPEmail(email, otp, 'forgot-password');
      console.log('Forgot password OTP email sent successfully to:', email);
    } catch (emailError) {
      console.error('Failed to send forgot password OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP has been sent to your email.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Reset Password (after OTP verification)
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    // Validation
    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, new password, and confirm password are required',
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Check password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify OTP - find the most recent unused OTP for this email and purpose
    // Since we don't verify OTP separately for forgot-password, it should be unused
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'forgot-password',
      isUsed: false, // OTP should not be used yet
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new password reset.',
      });
    }

    // Check if OTP is expired
    if (otpRecord.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new password reset.',
      });
    }

    // Verify OTP
    const isOtpValid = await verifyOTP(otp, otpRecord.hashedOtp);

    if (!isOtpValid) {
      // Increment attempts
      await otpRecord.incrementAttempts();
      const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts > 0 ? `You have ${remainingAttempts} attempt(s) remaining.` : 'No attempts remaining. Please request a new password reset.'}`,
      });
    }

    // Mark OTP as used after successful verification
    otpRecord.isUsed = true;
    otpRecord.updatedAt = new Date();
    await otpRecord.save();

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();
    console.log('Password reset successful for user:', user.email);

    // Generate JWT token for automatic login after password reset
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You have been logged in.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          picture: user.picture,
          coverPhoto: user.coverPhoto,
          joinedCommunities: user.joinedCommunities || [],
          isActive: user.isActive,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Auth0 OAuth functionality removed - OAuth login disabled

// ============================================================================
// STRICT OTP-FIRST AUTHENTICATION ENDPOINTS
// These endpoints enforce OTP verification BEFORE user creation (signup) 
// or JWT issuance (login)
// ============================================================================

/**
 * Request Signup OTP
 * Validates signup credentials but DOES NOT create user until OTP is verified
 * POST /auth/request-signup-otp
 */
exports.requestSignupOTP = async (req, res) => {
  try {
    console.log('[Strict OTP] Signup OTP request received:', { 
      username: req.body.username, 
      email: req.body.email,
      hasPassword: !!req.body.password,
      hasFile: !!req.file
    });

    // Handle multer errors
    if (req.fileError) {
      return res.status(400).json({
        success: false,
        message: req.fileError.message || 'File upload error',
      });
    }

    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if user already exists (by email) - CRITICAL: Don't create user yet
    const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    // Handle profile picture upload
    let pictureUrl = null;
    if (req.file) {
      const port = process.env.PORT || 3000;
      pictureUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
      console.log('Profile picture uploaded:', pictureUrl);
    }

    // Hash password BEFORE storing in temporary data
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Admin email check
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    // Generate 6-digit OTP
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    const expiresAt = createExpirationDate(5); // 5 minutes expiration

    // Invalidate any previous signup OTPs for this email
    await OTP.invalidatePrevious(email.toLowerCase(), 'signup');

    // Save OTP with temporary signup data (NO USER CREATED YET)
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      hashedOtp,
      purpose: 'signup',
      expiresAt,
      isUsed: false,
      attempts: 0,
      maxAttempts: 3, // Strict: 3 attempts max
      temporarySignupData: {
        username,
        hashedPassword, // Already hashed
        picture: pictureUrl,
        isAdmin, // Store admin flag
      },
    });
    await otpRecord.save();
    console.log('[Strict OTP] OTP saved with temporary signup data for:', email);

    // Send OTP via email
    try {
      await sendOTPEmail(email, otp, 'signup');
      console.log('[Strict OTP] OTP email sent successfully to:', email);
    } catch (emailError) {
      console.error('[Strict OTP] Failed to send OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    // Return success - NO USER CREATED, NO TOKEN ISSUED
    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete signup.',
      data: {
        email: email.toLowerCase(),
        // No user data, no token - user must verify OTP first
      },
    });
  } catch (error) {
    console.error('[Strict OTP] Signup OTP request error:', error);

    // Handle multer/file upload errors
    if (error.name === 'MulterError') {
      return res.status(400).json({
        success: false,
        message: error.message || 'File upload error',
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Verify Signup OTP and Create User
 * ONLY creates user after OTP verification succeeds
 * POST /auth/verify-signup-otp
 */
exports.verifySignupOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    // Find the most recent unused signup OTP for this email
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'signup',
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
    }

    // Check if OTP is expired
    if (otpRecord.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Check if OTP can be used (within attempt limit)
    if (!otpRecord.canBeUsed()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has exceeded maximum attempts or is already used.',
      });
    }

    // Verify OTP
    const isOtpValid = await verifyOTP(otp, otpRecord.hashedOtp);

    if (!isOtpValid) {
      // Increment attempts
      await otpRecord.incrementAttempts();
      
      const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts > 0 ? `You have ${remainingAttempts} attempt(s) remaining.` : 'No attempts remaining. Please request a new OTP.'}`,
      });
    }

    // Check if user already exists (race condition protection)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      // Mark OTP as used even though user exists (prevent reuse)
      await otpRecord.markAsUsed();
      return res.status(400).json({
        success: false,
        message: 'User already exists. Please login instead.',
      });
    }

    // CRITICAL: Only NOW create the user after OTP verification
    if (!otpRecord.temporarySignupData) {
      return res.status(400).json({
        success: false,
        message: 'Signup data not found. Please request a new OTP.',
      });
    }

    const { username, hashedPassword, picture, isAdmin } = otpRecord.temporarySignupData;

    // Create user with verified status
    // Note: Password is already hashed in temporarySignupData
    // We'll use a flag to skip password hashing in pre-save hook
    const user = new User({
      username,
      email: email.toLowerCase(),
      picture: picture || null,
      isAdmin: isAdmin || false,
      isVerified: true, // Mark as verified since OTP was verified
    });

    // Set password directly (already hashed) - mark to skip hashing
    user.password = hashedPassword;
    user._skipPasswordHash = true; // Flag to skip password hashing in pre-save hook

    // Save user to database
    await user.save();
    console.log('[Strict OTP] User created after OTP verification:', user._id);

    // Mark OTP as used
    await otpRecord.markAsUsed();

    // Generate JWT token
    const token = generateToken(user._id);

    // Emit real-time event for new user registration
    try {
      const io = req.app ? req.app.get('io') : null;
      if (io) {
        io.emit('new_user_registered', {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.name,
            picture: user.picture,
            isAdmin: user.isAdmin || false,
            isActive: user.isActive !== undefined ? user.isActive : true,
            isVerified: true,
            createdAt: user.createdAt,
            friendsCount: 0,
          },
        });
        console.log(`📡 Emitted new_user_registered event for user ${user._id}`);
      }
    } catch (socketError) {
      console.error('Error emitting new user registration:', socketError);
    }

    // Return success with token
    res.status(201).json({
      success: true,
      message: 'Account created and verified successfully!',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          picture: user.picture,
          isVerified: true,
          isAdmin: user.isAdmin || false,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('[Strict OTP] Verify signup OTP error:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === 'email') {
        return res.status(400).json({
          success: false,
          message: 'Email is already registered',
        });
      }
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Request Login OTP
 * Validates credentials but DOES NOT issue JWT until OTP is verified
 * POST /auth/request-login-otp
 */
exports.requestLoginOTP = async (req, res) => {
  try {
    console.log('[Strict OTP] Login OTP request received:', { 
      email: req.body.email,
      hasPassword: !!req.body.password 
    });

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email and include password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      // But we still need to send OTP to prevent timing attacks
      // So we'll generate OTP but it won't work (user doesn't exist)
      console.log('[Strict OTP] Login failed: User not found');
      
      // Still generate OTP to prevent user enumeration
      const otp = generateOTP();
      const hashedOtp = await hashOTP(otp);
      const expiresAt = createExpirationDate(5);
      
      await OTP.invalidatePrevious(email.toLowerCase(), 'login');
      
      const otpRecord = new OTP({
        email: email.toLowerCase(),
        hashedOtp,
        purpose: 'login',
        expiresAt,
        isUsed: false,
        attempts: 0,
        maxAttempts: 3,
      });
      await otpRecord.save();
      
      // Send OTP email (even though user doesn't exist - prevents enumeration)
      try {
        await sendOTPEmail(email, otp, 'login');
      } catch (emailError) {
        console.error('[Strict OTP] Failed to send OTP email:', emailError);
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      console.log('[Strict OTP] Login failed: Invalid password');
      
      // Still generate OTP to prevent timing attacks
      const otp = generateOTP();
      const hashedOtp = await hashOTP(otp);
      const expiresAt = createExpirationDate(5);
      
      await OTP.invalidatePrevious(email.toLowerCase(), 'login');
      
      const otpRecord = new OTP({
        email: email.toLowerCase(),
        hashedOtp,
        purpose: 'login',
        expiresAt,
        isUsed: false,
        attempts: 0,
        maxAttempts: 3,
      });
      await otpRecord.save();
      
      // Send OTP email (even though password is wrong - prevents enumeration)
      try {
        await sendOTPEmail(email, otp, 'login');
      } catch (emailError) {
        console.error('[Strict OTP] Failed to send OTP email:', emailError);
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Admin email check
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && !user.isAdmin) {
      user.isAdmin = true;
      await user.save();
      console.log('[Strict OTP] Admin flag set for admin email user:', user.email);
    }

    // Reactivate account if deactivated
    const wasDeactivated = !user.isActive;
    if (wasDeactivated) {
      user.isActive = true;
      await user.save();
      console.log('[Strict OTP] Account reactivated on login:', user.username);
    }

    // Generate 6-digit OTP for login
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);
    const expiresAt = createExpirationDate(5); // 5 minutes expiration

    // Invalidate any previous login OTPs for this email
    await OTP.invalidatePrevious(email.toLowerCase(), 'login');

    // Save OTP to database (NO JWT ISSUED YET)
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      hashedOtp,
      purpose: 'login',
      expiresAt,
      isUsed: false,
      attempts: 0,
      maxAttempts: 3, // Strict: 3 attempts max
    });
    await otpRecord.save();
    console.log('[Strict OTP] OTP saved for login:', email);

    // Send OTP via email
    try {
      await sendOTPEmail(email, otp, 'login');
      console.log('[Strict OTP] OTP email sent successfully to:', email);
    } catch (emailError) {
      console.error('[Strict OTP] Failed to send OTP email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    // Return success - NO JWT TOKEN ISSUED YET
    const loginMessage = wasDeactivated 
      ? 'Account reactivated. Please check your email for OTP verification.' 
      : 'Please check your email for OTP verification.';
    
    res.status(200).json({
      success: true,
      message: loginMessage,
      data: {
        email: user.email,
        // No token - user must verify OTP first
      },
    });
  } catch (error) {
    console.error('[Strict OTP] Login OTP request error:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Verify Login OTP and Issue JWT
 * ONLY issues JWT after OTP verification succeeds
 * POST /auth/verify-login-otp
 */
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    // Find the most recent unused login OTP for this email
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: 'login',
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
    }

    // Check if OTP is expired
    if (otpRecord.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Check if OTP can be used (within attempt limit)
    if (!otpRecord.canBeUsed()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has exceeded maximum attempts or is already used.',
      });
    }

    // Verify OTP
    const isOtpValid = await verifyOTP(otp, otpRecord.hashedOtp);

    if (!isOtpValid) {
      // Increment attempts
      await otpRecord.incrementAttempts();
      
      const remainingAttempts = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts > 0 ? `You have ${remainingAttempts} attempt(s) remaining.` : 'No attempts remaining. Please request a new OTP.'}`,
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Mark OTP as used even though user doesn't exist
      await otpRecord.markAsUsed();
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Mark OTP as used
    await otpRecord.markAsUsed();

    // CRITICAL: Only NOW generate JWT token after OTP verification
    const token = generateToken(user._id);

    console.log('[Strict OTP] Login successful after OTP verification for user:', user.username);

    // Return success with token
    res.status(200).json({
      success: true,
      message: 'Login successful!',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          picture: user.picture,
          isAdmin: user.isAdmin || false,
          isVerified: user.isVerified || false,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('[Strict OTP] Verify login OTP error:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
