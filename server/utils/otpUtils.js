const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP string
 */
const generateOTP = () => {
  // Generate random number between 100000 and 999999
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  return otp;
};

/**
 * Hash OTP using bcrypt
 * @param {string} otp - Plain text OTP
 * @returns {Promise<string>} Hashed OTP
 */
const hashOTP = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(otp, salt);
  return hashedOtp;
};

/**
 * Verify OTP against hashed OTP
 * @param {string} otp - Plain text OTP to verify
 * @param {string} hashedOtp - Hashed OTP from database
 * @returns {Promise<boolean>} True if OTP matches
 */
const verifyOTP = async (otp, hashedOtp) => {
  try {
    return await bcrypt.compare(otp, hashedOtp);
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return false;
  }
};

/**
 * Create expiration date (default: 5 minutes from now)
 * @param {number} minutes - Minutes until expiration (default: 5)
 * @returns {Date} Expiration date
 */
const createExpirationDate = (minutes = 5) => {
  const expirationDate = new Date();
  expirationDate.setMinutes(expirationDate.getMinutes() + minutes);
  return expirationDate;
};

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP,
  createExpirationDate,
};
