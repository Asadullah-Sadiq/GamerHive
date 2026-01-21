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
  ArrowLeft,
  ArrowRight,
  RefreshCw,
} from 'lucide-react-native';
import api from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OTPVerificationProps {
  email: string;
  purpose: 'signup' | 'login';
  onBack: () => void;
  onSuccess: (username?: string) => void;
}

const OTPVerification: React.FC<OTPVerificationProps> = ({
  email,
  purpose,
  onBack,
  onSuccess,
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
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

  const handleKeyDown = (index: number, e: any) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
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
      const response = await api.post('/auth/verify-otp', {
        email,
        otp: otpString,
        purpose,
      });

      const data = response.data;

      if (!data.success) {
        setErrorMsg(data.message || 'OTP verification failed');
        setOtp(['', '', '', '', '', '']);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
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

      // Get username from user object
      const username = user?.username || user?.name || '';

      // Immediately transition to success splash with username
      onSuccess(username);
    } catch (error: any) {
      console.error('OTP verification error:', error);
      const errorMessage =
        error.message ||
        error.response?.data?.message ||
        'OTP verification failed';
      setErrorMsg(errorMessage);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await api.post('/auth/resend-otp', {
        email,
        purpose,
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

      // Clear success message after 3 seconds
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
            <Text style={styles.subtitle}>Verify your email to continue</Text>
          </View>

          {/* OTP Verification Form */}
          <View style={styles.card}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
            >
              <ArrowLeft color="#a78bfa" size={20} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            {/* Email Display */}
            <View style={styles.emailContainer}>
              <Mail color="#a78bfa" size={20} />
              <Text style={styles.emailText}>{email}</Text>
            </View>

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

            {/* Instructions */}
            <Text style={styles.instructions}>
              Enter the 6-digit OTP sent to your email
            </Text>

            {/* OTP Input Fields */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  style={[
                    styles.otpInput,
                    index === 0 && styles.otpInputFirst,
                    index === 5 && styles.otpInputLast,
                    errorMsg && styles.otpInputError,
                  ]}
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

            {/* Verify Button */}
            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading || otp.join('').length !== 6}
              style={[
                styles.verifyButton,
                (loading || otp.join('').length !== 6) &&
                  styles.verifyButtonDisabled,
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
                style={styles.verifyButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.verifyButtonText}>Verify OTP</Text>
                    <ArrowRight color="#fff" size={20} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend OTP */}
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
    paddingHorizontal: 16,
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
    maxWidth: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    overflow: 'hidden',
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
  emailContainer: {
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
  emailText: {
    color: '#c4b5fd',
    fontSize: 14,
    marginLeft: 12,
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
  instructions: {
    color: '#c4b5fd90',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
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
  otpInputFirst: {
    marginLeft: 0,
  },
  otpInputLast: {
    marginRight: 0,
  },
  otpInputError: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  verifyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  verifyButtonText: {
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

export default OTPVerification;
