import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2 } from 'lucide-react-native';

interface WelcomeSplashProps {
  onComplete: () => void;
  username?: string;
}

const { width, height } = Dimensions.get('window');

const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ onComplete, username }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Start animation sequence
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // After animation completes, wait a bit then redirect
    const timer = setTimeout(() => {
      onComplete();
    }, 2500); // Show splash for 2.5 seconds total

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={['#0f172a', '#1e1b4b', '#312e81']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim },
            ],
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#9333ea', '#3b82f6', '#06b6d4']}
            style={styles.logoCircle}
          >
            <Gamepad2 color="#fff" size={60} />
          </LinearGradient>
        </View>
        
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          Welcome to
        </Animated.Text>
        
        <Animated.Text
          style={[
            styles.brandName,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          Gamer Hive
        </Animated.Text>

        {username && (
          <Animated.Text
            style={[
              styles.username,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            {username}
          </Animated.Text>
        )}
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9333ea',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    color: '#c4b5fd',
    fontWeight: '300',
    letterSpacing: 2,
    marginBottom: 10,
  },
  brandName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 3,
    textShadowColor: 'rgba(147, 51, 234, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  username: {
    fontSize: 20,
    color: '#a78bfa',
    marginTop: 20,
    fontWeight: '500',
  },
});

export default WelcomeSplash;

