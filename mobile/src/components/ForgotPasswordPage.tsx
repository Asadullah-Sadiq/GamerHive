import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Gamepad2,
  Mail,
  Lock,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import api from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    if (currentStep === 'otp') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [currentStep]);

  // Step 1: Request Password Reset (Send OTP)
  const handleRequestReset = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Email is required');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });

      const data = response.data;

      if (!data.success) {
        setErrorMsg(data.message || 'Failed to send reset OTP');
        return;
      }

      setSuccessMsg('Password reset OTP has been sent to your email.');
      setCurrentStep('otp');
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      const errorMessage =
        error.message ||
        error.response?.data?.message ||
        'Failed to send reset OTP';
      setErrorMsg(errorMessage);
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

  const handleKeyDown = (index: number, e: any) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
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
  const handleResetPassword = async () => {
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
      const response = await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp: otpString,
        newPassword,
        confirmPassword,
      });

      const data = response.data;

      if (!data.success) {
        setErrorMsg(data.message || 'Password reset failed');
        return;
      }

      // Save user and token
      const user = data.data.user;
      const token = data.data.token;
      if (user && token) {
        const userData = {
          ...user,
          id: user.id || user._id,
          username: user.username || user.name || '',
          email: user.email || '',
          picture: user.picture || null,
          coverPhoto: user.coverPhoto || null,
          joinedCommunities: user.joinedCommunities || [],
          isActive: user.isActive !== undefined ? user.isActive : true,
        };
        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
      }

      setCurrentStep('success');
      const username = user?.username || user?.name || '';
      
      setTimeout(() => {
        onSuccess(username);
      }, 2000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      const errorMessage =
        error.message ||
        error.response?.data?.message ||
        'Password reset failed';
      setErrorMsg(errorMessage);
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
      const response = await api.post('/auth/resend-otp', {
        email: email.trim().toLowerCase(),
        purpose: 'forgot-password',
      });

      const data = response.data;

      if (!data.success) {
        setErrorMsg(data.message || 'Failed to resend OTP');
        return;
      }

      setSuccessMsg('OTP has been resent to your email. Please check your inbox.');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      const errorMessage =
        error.message ||
        error.response?.data?.message ||
        'Failed to resend OTP';
      setErrorMsg(errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'email':
        return 'Reset your password';
      case 'otp':
        return 'Verify your email';
      case 'reset':
        return 'Create new password';
      case 'success':
        return 'Password reset successful!';
      default:
        return '';
    }
  };

  return (
    <LinearGradient
      colors={['#0f172a', '#4c1d95', '#1e3a8a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#9333ea', '#3b82f6', '#06b6d4']}
              style={styles.logoCircle}
            >
              <Gamepad2 color="#fff" size={40} />
            </LinearGradient>
            <Text style={styles.title}>GamerHive</Text>
            <Text style={styles.subtitle}>{getStepTitle()}</Text>
          </View>

          {/* Success Screen */}
          {currentStep === 'success' && (
            <View style={styles.successCard}>
              <View style={styles.successIconContainer}>
                <CheckCircle color="#22c55e" size={40} />
              </View>
              <Text style={styles.successTitle}>Password Reset Successful!</Text>
              <Text style={styles.successMessage}>Redirecting you to the dashboard...</Text>
            </View>
          )}

          {/* Form Steps */}
          {currentStep !== 'success' && (
            <View style={styles.card}>
              {/* Back Button */}
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <ArrowLeft color="#a78bfa" size={20} />
                <Text style={styles.backButtonText}>Back to Login</Text>
              </TouchableOpacity>

              {/* Messages */}
              {errorMsg && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              {successMsg && (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>{successMsg}</Text>
                </View>
              )}

              {/* Step 1: Email Input */}
              {currentStep === 'email' && (
                <View style={styles.stepContainer}>
                  <View style={styles.inputGroup}>
                    <Mail color="#a78bfa" size={20} style={styles.icon} />
                    <TextInput
                      placeholder="Enter your email address"
                      placeholderTextColor="#a78bfa90"
                      value={email}
                      onChangeText={setEmail}
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                      editable={!loading}
                    />
                  </View>

                  <Text style={styles.instructionText}>
                    Enter your email address and we'll send you an OTP to reset your password.
                  </Text>

                  <TouchableOpacity
                    onPress={handleRequestReset}
                    disabled={loading}
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  >
                    <LinearGradient
                      colors={loading ? ['#4c1d95', '#1e3a8a', '#0f172a'] : ['#7c3aed', '#2563eb', '#06b6d4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.submitButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Text style={styles.submitButtonText}>Send Reset OTP</Text>
                          <ArrowRight color="#fff" size={20} />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: OTP Verification */}
              {currentStep === 'otp' && (
                <View style={styles.stepContainer}>
                  <View style={styles.emailDisplayContainer}>
                    <Mail color="#a78bfa" size={20} />
                    <Text style={styles.emailDisplayText}>{email}</Text>
                  </View>

                  <Text style={styles.instructionText}>
                    Enter the 6-digit OTP sent to your email
                  </Text>

                  <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={(el: TextInput | null) => { inputRefs.current[index] = el; }}
                        style={styles.otpInput}
                        value={digit}
                        onChangeText={(value) => handleOtpChange(index, value)}
                        onKeyPress={(e) => handleKeyDown(index, e)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        editable={!loading}
                      />
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={handleVerifyOTP}
                    disabled={loading || otp.join('').length !== 6}
                    style={[
                      styles.submitButton,
                      (loading || otp.join('').length !== 6) && styles.submitButtonDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        loading || otp.join('').length !== 6
                          ? ['#4c1d95', '#1e3a8a', '#0f172a']
                          : ['#7c3aed', '#2563eb', '#06b6d4']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.submitButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Text style={styles.submitButtonText}>Verify OTP</Text>
                          <ArrowRight color="#fff" size={20} />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.resendContainer}>
                    <Text style={styles.resendText}>Didn't receive the OTP?</Text>
                    <TouchableOpacity
                      onPress={handleResend}
                      disabled={resendLoading}
                      style={styles.resendButton}
                    >
                      <RefreshCw
                        color="#a78bfa"
                        size={16}
                        style={resendLoading && { transform: [{ rotate: '360deg' }] }}
                      />
                      <Text style={styles.resendButtonText}>
                        {resendLoading ? 'Sending...' : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Step 3: Reset Password */}
              {currentStep === 'reset' && (
                <View style={styles.stepContainer}>
                  <View style={styles.inputGroup}>
                    <Lock color="#a78bfa" size={20} style={styles.icon} />
                    <TextInput
                      placeholder="New password"
                      placeholderTextColor="#a78bfa90"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      style={styles.input}
                      autoFocus
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff color="#a78bfa" size={20} />
                      ) : (
                        <Eye color="#a78bfa" size={20} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Lock color="#a78bfa" size={20} style={styles.icon} />
                    <TextInput
                      placeholder="Confirm new password"
                      placeholderTextColor="#a78bfa90"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      style={styles.input}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff color="#a78bfa" size={20} />
                      ) : (
                        <Eye color="#a78bfa" size={20} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleResetPassword}
                    disabled={loading}
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  >
                    <LinearGradient
                      colors={loading ? ['#4c1d95', '#1e3a8a', '#0f172a'] : ['#7c3aed', '#2563eb', '#06b6d4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.submitButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Text style={styles.submitButtonText}>Reset Password</Text>
                          <ArrowRight color="#fff" size={20} />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#c4b5fd',
    marginBottom: 5,
  },
  subtitle: {
    color: '#c4b5fd90',
    fontSize: 14,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    overflow: 'hidden',
  },
  successCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
  },
  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    color: '#c4b5fd90',
    fontSize: 14,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#a78bfa',
    marginLeft: 8,
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  successText: {
    color: '#86efac',
    fontSize: 14,
    textAlign: 'center',
  },
  stepContainer: {
    width: '100%',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 10,
  },
  instructionText: {
    color: '#c4b5fd90',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emailDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 20,
  },
  emailDisplayText: {
    color: '#c4b5fd',
    fontSize: 14,
    marginLeft: 12,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 0,
  },
  otpInput: {
    flex: 1,
    minWidth: 0,
    height: 56,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 12,
    color: '#fff',
    marginLeft: 3,
    marginRight: 3,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    color: '#a78bfa80',
    fontSize: 14,
    marginBottom: 8,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resendButtonText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ForgotPasswordPage;
