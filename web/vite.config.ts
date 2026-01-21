import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react', 'react-native', '@react-native-async-storage/async-storage', 'expo-notifications', 'expo-asset', 'expo-file-system'],
    include: ['socket.io-client'],
  },
  resolve: {
    alias: {
      // Prevent react-native from being processed
      'react-native$': 'react',
    },
  },
});
