import React, { useState, useRef, useEffect } from 'react';
import { Gamepad2, Mail, Lock, ArrowLeft, ArrowRight, RefreshCw, CheckCircle } from 'lucide-react';
import { apiRequest, setAuthSession } from '../utils/api';

interface ForgotPasswordPageProps {
  onBack: () => void;
  onSuccess: (username?: string) => void;
}

type ForgotPasswordStep = 'email' | 'otp' | 'reset' | 'success';

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBack, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<ForgotPasswordStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    if (currentStep === 'otp') {
      inputRefs.current[0]?.focus();
    }
  }, [currentStep]);

  // Step 1: Request Password Reset (Send OTP)
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Email is required');
      return;
    }

    setLoading(true);

    try {
      const resp = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!resp.success) {
        setErrorMsg(resp.message || 'Failed to send reset OTP');
        return;
      }

      setSuccessMsg('Password reset OTP has been sent to your email.');
      setCurrentStep('otp');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to send reset OTP');
    } finally {
      setLoading(false);
    }
  };

  // OTP Input Handlers
  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrorMsg(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < 6) newOtp[i] = digit;
        });
        setOtp(newOtp);
        const lastIndex = Math.min(digits.length - 1, 5);
        inputRefs.current[lastIndex]?.focus();
      });
    }
  };

  // Step 2: Verify OTP and move to reset (just validate format, don't verify with backend yet)
  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP');
      return;
    }

    // Just move to reset step - OTP will be verified when resetting password
    // This prevents the OTP from being marked as used prematurely
    setErrorMsg(null);
    setSuccessMsg('Please enter your new password.');
    setCurrentStep('reset');
    
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!newPassword || !confirmPassword) {
      setErrorMsg('Please enter both password fields');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const otpString = otp.join('');
      const resp = await apiRequest<{ user: any; token: string }>('/auth/reset-password', {
        method: 'POST',
        auth: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpString,
          newPassword,
          confirmPassword,
        }),
      });

      if (!resp.success) {
        setErrorMsg(resp.message || 'Password reset failed');
        return;
      }

      // Save user and token
      const user = resp.data.user;
      const token = resp.data.token;
      if (user && token) {
        setAuthSession(user, token);
      }

      setCurrentStep('success');
      const username = user?.username || user?.name || '';
      
      // Wait a moment then call onSuccess
      setTimeout(() => {
        onSuccess(username);
      }, 2000);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setResendLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const resp = await apiRequest('/auth/resend-otp', {
        method: 'POST',
        auth: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          purpose: 'forgot-password',
        }),
      });

      if (!resp.success) {
        setErrorMsg(resp.message || 'Failed to resend OTP');
        return;
      }

      setSuccessMsg('OTP has been resent to your email. Please check your inbox.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/30 to-blue-900/20 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-5"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/50 to-blue-900/30"></div>
        
        {/* Floating Particles */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-purple-400 rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-blue-400 rounded-full animate-ping opacity-40"></div>
        <div className="absolute bottom-32 left-16 w-3 h-3 bg-cyan-400 rounded-full animate-bounce opacity-30"></div>
        <div className="absolute bottom-20 right-20 w-2 h-2 bg-purple-500 rounded-full animate-pulse opacity-50"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-2xl shadow-2xl mb-4 relative">
              <Gamepad2 className="w-10 h-10 text-white" />
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-blue-400 rounded-2xl blur opacity-50 animate-pulse"></div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              GamerHive
            </h1>
            <p className="text-purple-300/70 text-sm">
              {currentStep === 'email' && 'Reset your password'}
              {currentStep === 'otp' && 'Verify your email'}
              {currentStep === 'reset' && 'Create new password'}
              {currentStep === 'success' && 'Password reset successful!'}
            </p>
          </div>

          {/* Success Screen */}
          {currentStep === 'success' && (
            <div className="bg-slate-900/80 backdrop-blur-xl border border-green-500/20 rounded-2xl p-8 shadow-2xl text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">Password Reset Successful!</h2>
              <p className="text-purple-300/70">Redirecting you to the dashboard...</p>
            </div>
          )}

          {/* Form Steps */}
          {currentStep !== 'success' && (
            <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 rounded-2xl blur-sm"></div>
              
              <div className="relative z-10">
                {/* Back Button */}
                <button
                  onClick={onBack}
                  className="flex items-center text-purple-300 hover:text-white transition-colors mb-6"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  <span>Back to Login</span>
                </button>

                {/* Messages */}
                {errorMsg && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-6">
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200 mb-6">
                    {successMsg}
                  </div>
                )}

                {/* Step 1: Email Input */}
                {currentStep === 'email' && (
                  <form onSubmit={handleRequestReset} className="space-y-6">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                      </div>
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
                        required
                        autoFocus
                      />
                    </div>

                    <p className="text-purple-300/70 text-sm text-center">
                      Enter your email address and we'll send you an OTP to reset your password.
                    </p>

                    <button
                      type="submit"
                      disabled={loading}
                      className="group relative w-full py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-xl text-white font-semibold text-lg shadow-2xl hover:shadow-purple-500/25 transform hover:scale-[1.02] transition-all duration-300 overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="relative z-10 flex items-center justify-center space-x-2">
                        <span>{loading ? 'Sending...' : 'Send Reset OTP'}</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>
                  </form>
                )}

                {/* Step 2: OTP Verification */}
                {currentStep === 'otp' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center p-4 bg-slate-800/50 rounded-xl border border-purple-500/30">
                      <Mail className="w-5 h-5 text-purple-400 mr-3" />
                      <span className="text-purple-200 text-sm">{email}</span>
                    </div>

                    <p className="text-purple-300/70 text-sm text-center">
                      Enter the 6-digit OTP sent to your email
                    </p>

                    <div className="flex justify-center gap-3">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          className="w-14 h-14 text-center text-2xl font-bold bg-slate-800/50 border border-purple-500/30 rounded-xl text-white focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
                        />
                      ))}
                    </div>

                    <button
                      onClick={handleVerifyOTP}
                      disabled={loading || otp.join('').length !== 6}
                      className="group relative w-full py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-xl text-white font-semibold text-lg shadow-2xl hover:shadow-purple-500/25 transform hover:scale-[1.02] transition-all duration-300 overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="relative z-10 flex items-center justify-center space-x-2">
                        <span>{loading ? 'Verifying...' : 'Verify OTP'}</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>

                    <div className="text-center">
                      <p className="text-purple-300/50 text-sm mb-2">Didn't receive the OTP?</p>
                      <button
                        onClick={handleResend}
                        disabled={resendLoading}
                        className="inline-flex items-center text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${resendLoading ? 'animate-spin' : ''}`} />
                        <span>{resendLoading ? 'Sending...' : 'Resend OTP'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Reset Password */}
                {currentStep === 'reset' && (
                  <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {showPassword ? <Lock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      </button>
                    </div>

                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {showConfirmPassword ? <Lock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="group relative w-full py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-xl text-white font-semibold text-lg shadow-2xl hover:shadow-purple-500/25 transform hover:scale-[1.02] transition-all duration-300 overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="relative z-10 flex items-center justify-center space-x-2">
                        <span>{loading ? 'Resetting...' : 'Reset Password'}</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
