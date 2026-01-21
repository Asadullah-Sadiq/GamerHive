const nodemailer = require('nodemailer');

/**
 * Create Nodemailer transporter
 * Uses environment variables for configuration
 */
const createTransporter = () => {
  // For development, you can use Gmail or other SMTP services
  // For production, use services like SendGrid, AWS SES, etc.
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER, // Your email
      pass: process.env.SMTP_PASS, // Your email password or app password
    },
  });

  return transporter;
};

/**
 * Send OTP email
 * @param {string} email - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} purpose - 'signup' or 'login'
 * @returns {Promise<Object>} Email send result
 */
const sendOTPEmail = async (email, otp, purpose = 'signup') => {
  try {
    const transporter = createTransporter();

    const purposeText = purpose === 'signup' 
      ? 'sign up' 
      : purpose === 'login' 
        ? 'log in' 
        : 'reset your password';
    const subject = purpose === 'signup' 
      ? 'Verify Your Email - GamerHive' 
      : purpose === 'login'
        ? 'Your Login OTP - GamerHive'
        : 'Password Reset OTP - GamerHive';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">GamerHive</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">${subject}</h2>
            <p style="font-size: 16px;">Hello,</p>
            <p style="font-size: 16px;">
              Use the following OTP code to ${purposeText} to your GamerHive account:
            </p>
            <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                ${otp}
              </h1>
            </div>
            <p style="font-size: 14px; color: #666;">
              This OTP will expire in <strong>5 minutes</strong>.
            </p>
            <p style="font-size: 14px; color: #666;">
              If you didn't request this OTP, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} GamerHive. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
GamerHive - ${subject}

Hello,

Use the following OTP code to ${purposeText} to your GamerHive account:

${otp}

This OTP will expire in 5 minutes.

If you didn't request this OTP, please ignore this email.

© ${new Date().getFullYear()} GamerHive. All rights reserved.
    `;

    const mailOptions = {
      from: `"GamerHive" <${process.env.SMTP_USER}>`,
      to: email,
      subject: subject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

/**
 * Verify email service configuration
 * @returns {Promise<boolean>} True if configuration is valid
 */
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('Email service configuration is valid');
    return true;
  } catch (error) {
    console.error('Email service configuration error:', error);
    return false;
  }
};

module.exports = {
  sendOTPEmail,
  verifyEmailConfig,
  createTransporter,
};
