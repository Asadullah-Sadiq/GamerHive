import React, { useState, useRef, useEffect } from 'react';
import { Gamepad2, Mail, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { apiRequest, setAuthSession } from '../utils/api';

interface OTPVerificationProps {
  email: string;
  purpose: 'signup' | 'login';
  onBack: () => void;
  onSuccess: (username?: string) => void;
}

const OTPVerification: React.FC<OTPVerificationProps> = ({ email, purpose, onBack, onSuccess }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrorMsg(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < 6) newOtp[i] = digit;
        });
        setOtp(newOtp);
        // Focus the last filled input or the last input
        const lastIndex = Math.min(digits.length - 1, 5);
        inputRefs.current[lastIndex]?.focus();
      });
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const resp = await apiRequest<{ user: any; token: string }>('/auth/verify-otp', {
        method: 'POST',
        auth: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: otpString,
          purpose,
        }),
      });

      if (!resp.success) {
        setErrorMsg(resp.message || 'OTP verification failed');
        // Clear OTP on error
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Save user and token
      const user = resp.data.user;
      const token = resp.data.token;
      if (user && token) {
        setAuthSession(user, token);
      }

      // Get username from user object
      const username = user?.username || user?.name || '';

      // Immediately transition to success splash with username
      onSuccess(username);
    } catch (e: any) {
      setErrorMsg(e?.message || 'OTP verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

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
          email,
          purpose,
        }),
      });

      if (!resp.success) {
        setErrorMsg(resp.message || 'Failed to resend OTP');
        return;
      }

      setSuccessMsg('OTP has been resent to your email. Please check your inbox.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      // Clear success message after 3 seconds
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
              Verify your email to continue
            </p>
          </div>

          {/* OTP Verification Form */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 rounded-2xl blur-sm"></div>
            
            <div className="relative z-10">
              {/* Back Button */}
              <button
                onClick={onBack}
                className="flex items-center text-purple-300 hover:text-white transition-colors mb-6"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                <span>Back</span>
              </button>

              {/* Email Display */}
              <div className="flex items-center justify-center mb-6 p-4 bg-slate-800/50 rounded-xl border border-purple-500/30">
                <Mail className="w-5 h-5 text-purple-400 mr-3" />
                <span className="text-purple-200 text-sm">{email}</span>
              </div>

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

              {/* Instructions */}
              <p className="text-purple-300/70 text-sm text-center mb-6">
                Enter the 6-digit OTP sent to your email
              </p>

              {/* OTP Input Fields */}
              <div className="flex justify-center gap-3 mb-6">
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

              {/* Verify Button */}
              <button
                onClick={handleVerify}
                disabled={loading || otp.join('').length !== 6}
                className="group relative w-full py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-xl text-white font-semibold text-lg shadow-2xl hover:shadow-purple-500/25 transform hover:scale-[1.02] transition-all duration-300 overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed mb-4"
              >
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  <span>{loading ? 'Verifying...' : 'Verify OTP'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>

              {/* Resend OTP */}
              <div className="text-center">
                <p className="text-purple-300/50 text-sm mb-2">
                  Didn't receive the OTP?
                </p>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;
