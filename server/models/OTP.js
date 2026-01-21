const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    index: true, // Index for faster queries
  },
  hashedOtp: {
    type: String,
    required: [true, 'Hashed OTP is required'],
  },
  purpose: {
    type: String,
    required: [true, 'Purpose is required'],
    enum: ['signup', 'login', 'forgot-password'],
    index: true, // Index for faster queries
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: { expireAfterSeconds: 0 }, // TTL index to auto-delete expired documents
  },
  isUsed: {
    type: Boolean,
    default: false,
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3, // Maximum 3 verification attempts (strict requirement)
  },
  // Temporary signup data (only for signup purpose)
  temporarySignupData: {
    type: {
      username: String,
      hashedPassword: String, // Password already hashed
      picture: String, // Profile picture URL if uploaded
    },
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update updatedAt before saving
otpSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Compound index for efficient queries
otpSchema.index({ email: 1, purpose: 1, isUsed: 1 });

// Method to check if OTP is expired
otpSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

// Method to check if OTP can be used (not expired, not used, within attempt limit)
otpSchema.methods.canBeUsed = function () {
  return !this.isExpired() && !this.isUsed && this.attempts < this.maxAttempts;
};

// Method to increment attempts
otpSchema.methods.incrementAttempts = function () {
  this.attempts += 1;
  return this.save();
};

// Method to mark as used
otpSchema.methods.markAsUsed = function () {
  this.isUsed = true;
  return this.save();
};

// Static method to clean expired OTPs (optional, TTL index handles this automatically)
otpSchema.statics.cleanExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

// Static method to invalidate previous OTPs for an email and purpose
otpSchema.statics.invalidatePrevious = async function (email, purpose) {
  return await this.updateMany(
    {
      email: email.toLowerCase(),
      purpose,
      isUsed: false,
    },
    {
      $set: { isUsed: true }, // Mark as used to invalidate
    }
  );
};

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
