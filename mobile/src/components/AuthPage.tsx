import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Gamepad2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Facebook,
} from "lucide-react-native";
import api, { API_CONFIG } from "../utils/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OTPVerification from "./OTPVerification";
import WelcomeSplash from "./WelcomeSplash";
import ForgotPasswordPage from "./ForgotPasswordPage";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

type AuthStep = 'form' | 'otp' | 'success' | 'forgot-password';

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [currentStep, setCurrentStep] = useState<AuthStep>('form');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userUsername, setUserUsername] = useState<string>('');
  const [authPurpose, setAuthPurpose] = useState<'signup' | 'login'>('signup');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    confirmPassword: "",
  });

  // Google OAuth is now handled by backend
  // Frontend se backend URL par redirect hoga
  // Backend Google OAuth flow handle karega

  const handleInputChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // Signup validation
    if (!isLogin) {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required";
      } else if (formData.username.length < 3) {
        newErrors.username = "Username must be at least 3 characters";
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    // Common validation (both login and signup)
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await api.post('/auth/signup', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      const data = response.data;

      if (data.success) {
        // Store email and purpose, then show OTP verification
        const email = formData.email.trim().toLowerCase();
        setUserEmail(email);
        setAuthPurpose('signup');
        
        // Show OTP verification screen
        setCurrentStep('otp');
      } else {
        Alert.alert("Error", data.message || "Unexpected response from server.");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      
      // Handle error response from axios interceptor
      if (error.success === false) {
        // Error from server or network
        if (error.message && error.message.includes('Network')) {
          // Network error - show detailed troubleshooting
          Alert.alert(
            "🔌 Connection Error", 
            error.message,
            [{ text: "OK" }]
          );
        } else if (error.message) {
          // Check if it's an email already taken error
          if (error.message.toLowerCase().includes('email') && error.message.toLowerCase().includes('already')) {
            setErrors({ email: 'Email is already taken' });
          } else {
          // Server error
          Alert.alert("Signup Failed", error.message);
          }
        } else if (error.errors && Array.isArray(error.errors)) {
          Alert.alert("Validation Error", error.errors.join("\n"));
        } else {
          Alert.alert("Error", "Something went wrong. Please try again.");
        }
      } else if (error.response?.data) {
        // Handle axios response error
        const errorMessage = error.response.data.message || error.response.data.error || 'Signup failed';
        if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('already')) {
          setErrors({ email: 'Email is already taken' });
        } else {
          Alert.alert("Signup Failed", errorMessage);
        }
      } else {
        // Network or other error
        let errorMessage = "Unable to connect to server. Please check:\n\n1. Server is running\n2. Correct IP address in api.ts\n3. Same WiFi network";
        
        if (error.message) {
          errorMessage = error.message;
        }
        
        Alert.alert("Connection Error", errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await api.post('/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      const data = response.data;

      if (data.success) {
        // Store email and purpose, then show OTP verification
        const email = formData.email.trim().toLowerCase();
        setUserEmail(email);
        setAuthPurpose('login');
        
        // Show OTP verification screen
        setCurrentStep('otp');
      } else {
        Alert.alert("Error", data.message || "Unexpected response from server.");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Handle error response from axios interceptor
      if (error.success === false) {
        // Error from server or network
        if (error.message && error.message.includes('Network')) {
          // Network error - show detailed troubleshooting
          Alert.alert(
            "🔌 Connection Error", 
            error.message,
            [{ text: "OK" }]
          );
        } else if (error.message) {
          // Server error (wrong credentials, etc.)
          Alert.alert("Login Failed", error.message);
        } else {
          Alert.alert("Error", "Login failed. Please try again.");
        }
      } else {
        // Network or other error
        let errorMessage = "Unable to connect to server. Please check:\n\n1. Server is running\n2. Correct IP address in api.ts\n3. Same WiFi network";
        
        if (error.message) {
          errorMessage = error.message;
        }
        
        Alert.alert("Connection Error", errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (isLogin) {
      handleLogin();
    } else {
      handleSignup();
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
    // Reset form
    setFormData({
      email: "",
      password: "",
      username: "",
      confirmPassword: "",
    });
    onAuthSuccess();
  };

  // Handle back from OTP to form
  const handleBackToForm = () => {
    setCurrentStep('form');
    setErrors({});
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    setCurrentStep('forgot-password');
  };

  // Handle back from forgot password
  const handleBackFromForgotPassword = () => {
    setCurrentStep('form');
    setErrors({});
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
    return (
      <WelcomeSplash
        username={userUsername}
        onComplete={handleSuccessComplete}
      />
    );
  }

  // Show Auth Form (default)
  return (
    <LinearGradient
      colors={["#0f172a", "#4c1d95", "#1e3a8a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ImageBackground
        source={{
          uri: "https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop",
        }}
        resizeMode="cover"
        style={styles.bgImage}
        imageStyle={{ opacity: 0.05 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo Section */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={["#9333ea", "#3b82f6", "#06b6d4"]}
                style={styles.logoCircle}
              >
                <Gamepad2 color="#fff" size={40} />
              </LinearGradient>
              <Text style={styles.title}>GamerHive</Text>
              <Text style={styles.subtitle}>
                {isLogin
                  ? "Welcome back, gamer!"
                  : "Join the ultimate gaming community"}
              </Text>
            </View>

            {/* Auth Card */}
            <View style={styles.card}>
              {/* Tab Switch */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  onPress={() => {
                    setIsLogin(true);
                    setErrors({});
                    setFormData({
                      email: "",
                      password: "",
                      username: "",
                      confirmPassword: "",
                    });
                  }}
                  style={[
                    styles.tabButton,
                    isLogin && styles.activeTabButton,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      isLogin && styles.activeTabText,
                    ]}
                  >
                    Login
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setIsLogin(false);
                    setErrors({});
                    setFormData({
                      email: "",
                      password: "",
                      username: "",
                      confirmPassword: "",
                    });
                  }}
                  style={[
                    styles.tabButton,
                    !isLogin && styles.activeTabButton,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      !isLogin && styles.activeTabText,
                    ]}
                  >
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form */}
              {!isLogin && (
                <View>
                  <View
                    style={[
                      styles.inputGroup,
                      errors.username && styles.inputGroupError,
                    ]}
                  >
                    <User color="#a78bfa" size={20} style={styles.icon} />
                    <TextInput
                      placeholder="Username"
                      placeholderTextColor="#a78bfa90"
                      value={formData.username}
                      onChangeText={(v) => handleInputChange("username", v)}
                      style={styles.input}
                      editable={!isLoading}
                    />
                  </View>
                  {errors.username && (
                    <Text style={styles.errorText}>{errors.username}</Text>
                  )}
                </View>
              )}

              <View>
                <View
                  style={[
                    styles.inputGroup,
                    errors.email && styles.inputGroupError,
                  ]}
                >
                  <Mail color="#a78bfa" size={20} style={styles.icon} />
                  <TextInput
                    placeholder="Email address"
                    placeholderTextColor="#a78bfa90"
                    value={formData.email}
                    onChangeText={(v) => handleInputChange("email", v)}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              <View>
                <View
                  style={[
                    styles.inputGroup,
                    errors.password && styles.inputGroupError,
                  ]}
                >
                  <Lock color="#a78bfa" size={20} style={styles.icon} />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#a78bfa90"
                    value={formData.password}
                    onChangeText={(v) => handleInputChange("password", v)}
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff color="#a78bfa" size={20} />
                    ) : (
                      <Eye color="#a78bfa" size={20} />
                    )}
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {!isLogin && (
                <View>
                  <View
                    style={[
                      styles.inputGroup,
                      errors.confirmPassword && styles.inputGroupError,
                    ]}
                  >
                    <Lock color="#a78bfa" size={20} style={styles.icon} />
                    <TextInput
                      placeholder="Confirm password"
                      placeholderTextColor="#a78bfa90"
                      value={formData.confirmPassword}
                      onChangeText={(v) =>
                        handleInputChange("confirmPassword", v)
                      }
                      secureTextEntry
                      style={styles.input}
                      editable={!isLoading}
                    />
                  </View>
                  {errors.confirmPassword && (
                    <Text style={styles.errorText}>
                      {errors.confirmPassword}
                    </Text>
                  )}
                </View>
              )}

              {/* Remember Me / Forgot Password (Login Only) */}
              {isLogin && (
                <View style={styles.rememberForgotContainer}>
                  <TouchableOpacity
                    onPress={() => setRememberMe(!rememberMe)}
                    style={styles.rememberMeContainer}
                    disabled={isLoading}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe && styles.checkboxChecked,
                      ]}
                    >
                      {rememberMe && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.rememberMeText}>Remember me</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    disabled={isLoading}
                  >
                    <Text style={styles.forgotPasswordText}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isLoading}
                style={isLoading && styles.submitButtonDisabled}
              >
                <LinearGradient
                  colors={
                    isLoading
                      ? ["#4c1d95", "#1e3a8a", "#0f172a"]
                      : ["#7c3aed", "#2563eb", "#06b6d4"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitButton}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.submitText}>
                        {isLogin ? "Enter GamerHive" : "Join GamerHive"}
                      </Text>
                      <ArrowRight color="#fff" size={20} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

            </View>

            {/* Footer */}
            <Text style={styles.footerText}>
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}
              <Text
                onPress={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setFormData({
                    email: "",
                    password: "",
                    username: "",
                    confirmPassword: "",
                  });
                }}
                style={styles.footerLink}
              >
                {isLogin ? "Sign up here" : "Login here"}
              </Text>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </LinearGradient>
  );
};

export default AuthPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    backgroundColor: "transparent",
    color: "#c4b5fd",
  },
  subtitle: {
    color: "#c4b5fd90",
    fontSize: 14,
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: "rgba(30,41,59,0.5)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTabButton: {
    backgroundColor: "#6d28d9",
    borderRadius: 10,
  },
  tabText: {
    color: "#a78bfa",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#fff",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,41,59,0.6)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 5,
  },
  inputGroupError: {
    borderColor: "#ef4444",
    borderWidth: 1.5,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: "#fff",
    paddingVertical: 10,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  footerText: {
    marginTop: 25,
    color: "#a78bfa80",
    textAlign: "center",
  },
  footerLink: {
    color: "#a78bfa",
    fontWeight: "600",
  },
  rememberForgotContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#a78bfa",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  rememberMeText: {
    color: "#a78bfa",
    fontSize: 14,
  },
  forgotPasswordText: {
    color: "#a78bfa",
    fontSize: 14,
    fontWeight: "500",
  },
});
