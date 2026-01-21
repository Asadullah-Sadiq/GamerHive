import React, { useState } from 'react';
import { Gamepad2, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { apiRequest, getStoredUser } from '../utils/api';
import OTPVerification from './OTPVerification';
import WelcomeSplash from './WelcomeSplash';
import ForgotPasswordPage from './ForgotPasswordPage';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

type AuthStep = 'form' | 'otp' | 'success' | 'forgot-password';

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<AuthStep>('form');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userUsername, setUserUsername] = useState<string>('');
  const [authPurpose, setAuthPurpose] = useState<'signup' | 'login'>('signup');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    confirmPassword: ''
  });


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      setLoading(true);
      if (!formData.email.trim() || !formData.password.trim()) {
        setErrorMsg('Email and password are required.');
        return;
      }

      if (!isLogin) {
        if (!formData.username.trim()) {
          setErrorMsg('Username is required.');
          return;
        }
        if (!formData.confirmPassword.trim()) {
          setErrorMsg('Confirm password is required.');
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setErrorMsg('Passwords do not match.');
          return;
        }
      }

      const path = isLogin ? '/auth/login' : '/auth/signup';
      const body = isLogin
        ? { email: formData.email.trim(), password: formData.password }
        : {
            username: formData.username.trim(),
            email: formData.email.trim(),
            password: formData.password,
            confirmPassword: formData.confirmPassword,
          };

      const resp = await apiRequest(path, {
        method: 'POST',
        auth: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.success) {
        setErrorMsg(resp.message || 'Authentication failed');
        return;
      }

      // For OTP flow, we don't get token immediately
      // Store email and purpose, then show OTP verification
      const email = formData.email.trim().toLowerCase();
      setUserEmail(email);
      setAuthPurpose(isLogin ? 'login' : 'signup');
      
      // Show OTP verification screen
      setCurrentStep('otp');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification success
  const handleOTPSuccess = (username?: string) => {
    if (username) {
      setUserUsername(username);
    }
    setCurrentStep('success');
  };

  // Handle success splash complete
  const handleSuccessComplete = () => {
    onAuthSuccess();
  };

  // Handle back from OTP to form
  const handleBackToForm = () => {
    setCurrentStep('form');
    setErrorMsg(null);
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    setCurrentStep('forgot-password');
  };

  // Handle back from forgot password
  const handleBackFromForgotPassword = () => {
    setCurrentStep('form');
    setErrorMsg(null);
  };

  // Show Forgot Password screen
  if (currentStep === 'forgot-password') {
    return (
      <ForgotPasswordPage
        onBack={handleBackFromForgotPassword}
        onSuccess={handleOTPSuccess}
      />
    );
  }

  // Show OTP Verification screen
  if (currentStep === 'otp') {
    return (
      <OTPVerification
        email={userEmail}
        purpose={authPurpose}
        onBack={handleBackToForm}
        onSuccess={handleOTPSuccess}
      />
    );
  }

  // Show Welcome Splash screen
  if (currentStep === 'success') {
    // Use username from OTP verification, or fallback to stored user
    const username = userUsername || getStoredUser()?.username || getStoredUser()?.name || '';
    
    return (
      <WelcomeSplash
        username={username}
        onComplete={handleSuccessComplete}
      />
    );
  }

  // Show Auth Form (default)
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
        
        {/* Geometric Shapes */}
        <div className="absolute top-1/4 left-10 w-32 h-32 border border-purple-500/20 rotate-45 animate-spin-slow opacity-20"></div>
        <div className="absolute bottom-1/4 right-10 w-24 h-24 border border-blue-500/20 rotate-12 animate-pulse opacity-30"></div>
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
              {isLogin ? 'Welcome back, gamer!' : 'Join the ultimate gaming community'}
            </p>
          </div>

          {/* Auth Form */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            {/* Glowing Border Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 rounded-2xl blur-sm"></div>
            
            <div className="relative z-10">
              {/* Tab Switcher */}
              <div className="flex bg-slate-800/50 rounded-xl p-1 mb-8">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                    isLogin
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'text-purple-300 hover:text-white'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                    !isLogin
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'text-purple-300 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMsg && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMsg}
                  </div>
                )}
                {/* Username (Sign Up Only) */}
                {!isLogin && (
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                    </div>
                    <input
                      type="text"
                      name="username"
                      placeholder="Username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
                      required={!isLogin}
                    />
                  </div>
                )}

                {/* Email */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
                    required
                  />
                </div>

                {/* Password */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Confirm Password (Sign Up Only) */}
                {!isLogin && (
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                    </div>
                    <input
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
                      required={!isLogin}
                    />
                  </div>
                )}

                {/* Remember Me / Forgot Password */}
                {isLogin && (
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center space-x-2 text-purple-300">
                      <input
                        type="checkbox"
                        className="w-4 h-4 bg-slate-800 border border-purple-500/30 rounded focus:ring-purple-400 focus:ring-2"
                      />
                      <span>Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-xl text-white font-semibold text-lg shadow-2xl hover:shadow-purple-500/25 transform hover:scale-[1.02] transition-all duration-300 overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 flex items-center justify-center space-x-2">
                    <span>{loading ? 'Please wait…' : (isLogin ? 'Enter GamerHive' : 'Join GamerHive')}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-cyan-400 blur opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                </button>

              </form>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 text-purple-300/50 text-sm">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                {isLogin ? 'Sign up here' : 'Login here'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;