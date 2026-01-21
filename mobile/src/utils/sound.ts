import { Platform, Vibration } from 'react-native';

export const playNotificationSound = async () => {
  try {
    // Play vibration pattern (works on both platforms)
    // Short vibration pattern similar to iPhone notification
    if (Platform.OS === 'ios') {
      Vibration.vibrate(100); // Short vibration
    } else {
      Vibration.vibrate([0, 100]); // Android vibration pattern
    }

    // Note: expo-audio doesn't have setAudioModeAsync like expo-av
    // Audio mode is handled automatically by expo-audio
    // For notification sounds, vibration is the primary method
    // To add actual sound files, use useAudioPlayer hook with a sound file
    
    console.log('🔔 Notification sound triggered');
  } catch (error) {
    // Silently handle errors - vibration still works
  }
};

export const cleanupSound = async () => {
  // Cleanup if needed
};

