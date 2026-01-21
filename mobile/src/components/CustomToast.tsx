import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ToastData {
  id: string;
  type: 'info' | 'success' | 'error';
  title: string;
  message: string;
  onPress?: () => void;
}

interface CustomToastProps {
  toast: ToastData | null;
  onHide: () => void;
}

const CustomToast: React.FC<CustomToastProps> = ({ toast, onHide }) => {
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      // Show animation with spring effect
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }),
      ]).start();

      // Glow pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Shimmer effect
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();

      // Auto hide after 5 seconds
      const timer = setTimeout(() => {
        hideToast();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [toast]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!toast) return null;

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return {
          primary: '#10B981',
          secondary: '#34D399',
          accent: '#6EE7B7',
          gradient: ['#1a1f2e', '#1e2332', '#222536'] as const,
          glow: 'rgba(16, 185, 129, 0.5)',
          borderGlow: '#34D399',
        };
      case 'error':
        return {
          primary: '#EF4444',
          secondary: '#F87171',
          accent: '#FCA5A5',
          gradient: ['#1a1f2e', '#1e2332', '#222536'] as const,
          glow: 'rgba(239, 68, 68, 0.5)',
          borderGlow: '#F87171',
        };
      default:
        return {
          primary: '#8B5CF6',
          secondary: '#A78BFA',
          accent: '#C4B5FD',
          gradient: ['#1a1f2e', '#1e2332', '#222536'] as const,
          glow: 'rgba(139, 92, 246, 0.5)',
          borderGlow: '#60A5FA',
        };
    }
  };

  const colors = getColors();

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => {
          if (toast.onPress) {
            toast.onPress();
          }
          hideToast();
        }}
        style={styles.touchable}
      >
        {/* Glow effect */}
        <Animated.View
          style={[
            styles.glow,
            {
              backgroundColor: colors.glow,
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
            },
          ]}
        />

        {/* Main toast container with dark gradient background */}
        <LinearGradient
          colors={colors.gradient as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.toast}
        >
          {/* Animated left accent line with glow */}
          <Animated.View
            style={[
              styles.leftAccent,
              {
                backgroundColor: colors.borderGlow,
                shadowColor: colors.borderGlow,
                shadowOpacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1],
                }),
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          />

          {/* Shimmer overlay */}
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslateX }],
              },
            ]}
          />

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{toast.title}</Text>
              {toast.message && (
                <Text style={[styles.message, { color: colors.accent }]} numberOfLines={2}>
                  {toast.message}
                </Text>
              )}
            </View>
          </View>

          {/* Animated glow particles */}
          <Animated.View
            style={[
              styles.glowParticle1,
              {
                backgroundColor: colors.borderGlow,
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.5],
                }),
                shadowColor: colors.borderGlow,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          />
          <Animated.View
            style={[
              styles.glowParticle2,
              {
                backgroundColor: colors.borderGlow,
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.3],
                }),
                shadowColor: colors.borderGlow,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  touchable: {
    width: Dimensions.get('window').width * 0.92,
    borderRadius: 20,
    overflow: 'visible',
  },
  glow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 30,
    zIndex: -1,
  },
  toast: {
    borderRadius: 16,
    padding: 16,
    paddingLeft: 20,
    minHeight: 70,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#222536',
  },
  leftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  content: {
    flexDirection: 'column',
    zIndex: 1,
    paddingLeft: 4,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  glowParticle1: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    top: -20,
    right: -20,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  glowParticle2: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    bottom: -15,
    left: 50,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
  },
});

export default CustomToast;

