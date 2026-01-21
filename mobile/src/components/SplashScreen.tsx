import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2 } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Premium animated splash screen with water-ripple logo animation
 * 
 * Animation flow:
 * 1. Logo fades in with subtle scale animation (0-800ms)
 * 2. Ripple waves expand from logo center (800-2000ms)
 * 3. Logo pulses gently (continuous)
 * 4. Fade out and navigate (2500-3000ms)
 */
const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  // Logo animations
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const logoRotation = useSharedValue(0);

  // Ripple animations (3 concentric ripples)
  const ripple1 = useSharedValue(0);
  const ripple1Opacity = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const ripple2Opacity = useSharedValue(0);
  const ripple3 = useSharedValue(0);
  const ripple3Opacity = useSharedValue(0);

  // Container fade out
  const containerOpacity = useSharedValue(1);

  // Logo pulse animation (continuous)
  const logoPulse = useSharedValue(1);

  useEffect(() => {
    const startAnimation = () => {
      // Phase 1: Logo fade-in with scale (0-800ms)
      logoOpacity.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });

      logoScale.value = withSpring(1, {
        damping: 12,
        stiffness: 100,
      });

      // Subtle rotation on appear (start from -5 degrees)
      logoRotation.value = -5;
      logoRotation.value = withSpring(0, {
        damping: 15,
        stiffness: 80,
      });

      // Continuous gentle pulse (looping)
      logoPulse.value = withRepeat(
        withSequence(
          withTiming(1.05, {
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        true
      );

      // Phase 2: Ripple waves (800-2000ms)
      // First ripple
      ripple1Opacity.value = withSequence(
        withDelay(800, withTiming(0.6, { duration: 200 })),
        withTiming(0, { duration: 800 })
      );
      ripple1.value = withDelay(
        800,
        withTiming(1, {
          duration: 1000,
          easing: Easing.out(Easing.ease),
        })
      );

      // Second ripple
      ripple2Opacity.value = withSequence(
        withDelay(1100, withTiming(0.5, { duration: 200 })),
        withTiming(0, { duration: 800 })
      );
      ripple2.value = withDelay(
        1100,
        withTiming(1, {
          duration: 1000,
          easing: Easing.out(Easing.ease),
        })
      );

      // Third ripple
      ripple3Opacity.value = withSequence(
        withDelay(1400, withTiming(0.4, { duration: 200 })),
        withTiming(0, { duration: 800 })
      );
      ripple3.value = withDelay(
        1400,
        withTiming(1, {
          duration: 1000,
          easing: Easing.out(Easing.ease),
        })
      );

      // Phase 3: Fade out and complete (2500-3000ms)
      containerOpacity.value = withDelay(
        2500,
        withTiming(0, {
          duration: 500,
          easing: Easing.in(Easing.ease),
        }, () => {
          runOnJS(onComplete)();
        })
      );
    };

    startAnimation();
  }, [onComplete]);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => {
    const scale = logoScale.value * logoPulse.value;
    return {
      opacity: logoOpacity.value,
      transform: [
        { scale },
        { rotate: `${logoRotation.value}deg` },
      ],
    };
  });

  // Ripple styles
  const ripple1Style = useAnimatedStyle(() => {
    const scale = interpolate(ripple1.value, [0, 1], [1, 3]);
    return {
      opacity: ripple1Opacity.value,
      transform: [{ scale }],
    };
  });

  const ripple2Style = useAnimatedStyle(() => {
    const scale = interpolate(ripple2.value, [0, 1], [1, 3.5]);
    return {
      opacity: ripple2Opacity.value,
      transform: [{ scale }],
    };
  });

  const ripple3Style = useAnimatedStyle(() => {
    const scale = interpolate(ripple3.value, [0, 1], [1, 4]);
    return {
      opacity: ripple3Opacity.value,
      transform: [{ scale }],
    };
  });

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Gradient Background */}
        <LinearGradient
          colors={['#000000', '#0a0a1a', '#1a0a2e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

      {/* Ripple Waves */}
      <View style={styles.rippleContainer}>
        {/* First Ripple */}
        <Animated.View style={[styles.ripple, ripple1Style]}>
          <View style={styles.rippleCircle} />
        </Animated.View>

        {/* Second Ripple */}
        <Animated.View style={[styles.ripple, ripple2Style]}>
          <View style={styles.rippleCircle} />
        </Animated.View>

        {/* Third Ripple */}
        <Animated.View style={[styles.ripple, ripple3Style]}>
          <View style={styles.rippleCircle} />
        </Animated.View>
      </View>

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        {/* Logo Glow */}
        <View style={styles.logoGlow} />
        <View style={styles.logoGlowInner} />
        
        {/* Logo Icon */}
        <Gamepad2 
          size={80} 
          color="#A78BFA" 
          strokeWidth={2.5}
        />
      </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#A78BFA',
    backgroundColor: 'transparent',
  },
  logoContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#A78BFA',
    opacity: 0.2,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  logoGlowInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
});

export default SplashScreen;
