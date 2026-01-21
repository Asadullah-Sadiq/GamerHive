import axios from 'axios';
import { Platform } from 'react-native';

// API Base URL Configuration
// IMPORTANT: For Expo Go on physical device, you MUST use your computer's IP address
// Find your IP: Windows (ipconfig), Mac/Linux (ifconfig or ip addr)
// Example: http://192.168.162.167:3000/api

// ============================================
// CONFIGURATION: Change this based on your setup
// ============================================
// Set to true if using Expo Go on PHYSICAL DEVICE (requires IP address)
// Set to false if using EMULATOR/SIMULATOR (will use localhost)
// NOTE: Backend now generates URLs with localhost, so for physical devices,
// you'll need to set IS_PHYSICAL_DEVICE=false and ensure your device can access localhost
const IS_PHYSICAL_DEVICE = true; // CHANGE THIS: true for physical device, false for emulator (localhost)

// Your computer's IP address (only needed for physical device)
// Find it: Windows (ipconfig) or Mac/Linux (ifconfig)
// ⚠️ ONLY CHANGE THIS IP ADDRESS WHEN YOUR IP CHANGES
const COMPUTER_IP = '192.168.162.167'; // '192.168.162.167'; // CHANGE THIS TO YOUR COMPUTER'S IP ADDRESS

// Server port (usually 3000, change only if your server uses a different port)
const SERVER_PORT = 3000; // CHANGE THIS ONLY IF YOUR SERVER USES A DIFFERENT PORT

// Get the base URL based on environment
const getBaseURL = () => {
  if (__DEV__) {
    if (IS_PHYSICAL_DEVICE) {
      // Physical device (Expo Go) - MUST use computer's IP
      if (!COMPUTER_IP || COMPUTER_IP === '192.168.162.167') {
        console.warn('⚠️  WARNING: Using default IP. Please update COMPUTER_IP in api.ts with your actual IP address!');
      }
      return `http://${COMPUTER_IP}:${SERVER_PORT}/api`;
    } else {
      // Emulator/Simulator
      if (Platform.OS === 'android') {
        return `http://10.0.2.2:${SERVER_PORT}/api`; // Android emulator
      } else {
        return `http://localhost:${SERVER_PORT}/api`; // iOS simulator
      }
    }
  }
  return 'https://your-production-api.com/api';
};

// Log the base URL for debugging
const BASE_URL = getBaseURL();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('[API Config] Base URL:', BASE_URL);
console.log('[API Config] Platform:', Platform.OS);
console.log('[API Config] Device Type:', IS_PHYSICAL_DEVICE ? 'Physical Device' : 'Emulator/Simulator');
if (IS_PHYSICAL_DEVICE) {
  console.log('[API Config] Computer IP:', COMPUTER_IP);
  console.log('⚠️  Make sure this IP matches your computer\'s IP address!');
}
console.log('[API Config] If network fails, check:');
console.log(`  1. Server running on port ${SERVER_PORT}`);
console.log('  2. Using correct IP for physical device');
console.log('  3. Phone and computer on same WiFi');
console.log(`  4. Firewall allows port ${SERVER_PORT}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Create axios instance with default configuration
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 seconds timeout (increased for network delays on mobile)
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // For Expo Go and physical devices - allow all status codes to be handled manually
  validateStatus: function (status) {
    return status >= 200 && status < 600; // Don't throw for any status, handle manually
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Skip logging for notification requests to reduce console clutter
    const isNotificationRequest = config.url?.includes('/notification');
    if (!isNotificationRequest) {
      const fullUrl = `${config.baseURL}${config.url}`;
      console.log(`[API Request] ${config.method?.toUpperCase()} ${fullUrl}`);
      console.log(`[API Request] Data:`, config.data);
    }
    // Add token if available
    // const token = await AsyncStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Skip logging for notification responses to reduce console clutter
    const isNotificationRequest = response.config?.url?.includes('/notification');
    if (!isNotificationRequest) {
      console.log(`[API Response] ${response.status} ${response.config.url}`);
      if (response.data) {
        console.log(`[API Response] Data:`, response.data);
      }
    }
    return response;
  },
  (error) => {
    // Check if this is a notification request - silently handle ALL errors for notifications
    const isNotificationRequest = error.config?.url?.includes('/notification');
    
    // Only log errors for non-notification requests - completely silence notification errors
    if (!isNotificationRequest) {
      // More detailed error logging for non-notification requests
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        request: error.request ? 'Request made but no response' : 'No request made',
        url: error.config?.url,
        baseURL: error.config?.baseURL,
      };
      console.error('[API Response Error]', errorDetails);
    }
    
    if (error.response) {
      // Server responded with error status (4xx, 5xx)
      const serverError = error.response.data || {
        success: false,
        message: error.response.statusText || 'Server error',
      };
      return Promise.reject(serverError);
    } else if (error.request) {
      // Request was made but no response received (network error)
      // For notification requests, silently reject without detailed error message
      if (isNotificationRequest) {
        return Promise.reject({
          success: false,
          message: 'Network error',
          code: error.code || 'ERR_NETWORK',
        });
      }
      
      // For other requests, provide detailed error message
      const healthUrl = BASE_URL.replace('/api', '/api/health');
      const errorMessage = `Network connection failed.\n\nTroubleshooting Steps:\n1. ✅ Check if server is running on port ${SERVER_PORT}\n2. ✅ Verify IP address: ${COMPUTER_IP}\n3. ✅ Ensure phone and computer are on same WiFi network\n4. ✅ Test in browser: ${healthUrl}\n5. ✅ Check Windows Firewall allows port ${SERVER_PORT}\n\nCurrent API URL: ${BASE_URL}\n\nTo fix:\n- Find your IP: ipconfig (Windows)\n- Update COMPUTER_IP in api.ts (line 19)`;
      
      return Promise.reject({
        success: false,
        message: errorMessage,
        code: error.code || 'ERR_NETWORK',
        details: 'No response from server. Check if server is running and accessible.',
      });
    } else {
      // Something else happened (configuration error, etc.)
      return Promise.reject({
        success: false,
        message: error.message || 'An unexpected error occurred',
        code: error.code || 'UNKNOWN_ERROR',
      });
    }
  }
);

// Test connection to server
export const testConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const healthUrl = BASE_URL.replace('/api', '/api/health');
    console.log('[Connection Test] Testing:', healthUrl);
    
    const response = await axios.get(healthUrl, {
      timeout: 10000,
      validateStatus: () => true, // Accept any status
    });
    
    if (response.status === 200) {
      console.log('[Connection Test] ✅ Success! Server is reachable.');
      return {
        success: true,
        message: 'Server connection successful!',
      };
    } else {
      console.log('[Connection Test] ⚠️ Server responded but with status:', response.status);
      return {
        success: false,
        message: `Server responded with status ${response.status}`,
      };
    }
  } catch (error: any) {
    console.error('[Connection Test] ❌ Failed:', error.message);
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
    };
  }
};

// Export configuration for use in other files (like AuthPage)
export const API_CONFIG = {
  COMPUTER_IP,
  SERVER_PORT,
  IS_PHYSICAL_DEVICE,
  BASE_URL,
};

// Export function to get base URL without /api suffix (for direct fetch calls)
export const getBaseURLWithoutApi = () => {
  return BASE_URL.replace('/api', '');
};

/**
 * Converts localhost URLs to the actual server URL based on current API configuration.
 * The backend always stores URLs with localhost (e.g., http://localhost:3000/uploads/file.jpg),
 * and this function converts them to the current server IP address dynamically.
 * This allows the app to work on different networks without updating the database.
 * 
 * Also handles old IP-based URLs for backward compatibility by converting them to current server.
 * 
 * Usage: <Image source={{ uri: getImageUrl(user.picture) || 'default-image-url' }} />
 */
export const getImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  // Get the server base URL (without /api)
  const serverBaseUrl = BASE_URL.replace('/api', '');
  
  try {
    // Priority 1: If URL contains localhost, replace it with current server address
    // This is the primary use case - backend always saves with localhost
    if (url.includes('localhost')) {
      // Extract the path (everything after localhost:port)
      const urlMatch = url.match(/localhost:\d+(\/[^?#]*)/);
      if (urlMatch) {
        const path = urlMatch[1];
        const convertedUrl = `${serverBaseUrl}${path}`;
        if (__DEV__) {
          console.log(`[getImageUrl] Converting localhost: ${url} -> ${convertedUrl}`);
        }
        return convertedUrl;
      }
    }
    
    // Priority 2: If URL contains /uploads/ but uses an old IP address, convert to current server
    // This handles backward compatibility for old URLs in the database
    if (url.includes('/uploads/')) {
      // Check if it's an IP-based URL (old format)
      const ipMatch = url.match(/http:\/\/(\d+\.\d+\.\d+\.\d+):\d+(\/uploads\/[^?#]*)/);
      if (ipMatch) {
        // Extract the path
        const path = ipMatch[2];
        const convertedUrl = `${serverBaseUrl}${path}`;
        if (__DEV__) {
          console.log(`[getImageUrl] Converting old IP URL: ${url} -> ${convertedUrl}`);
        }
        return convertedUrl;
      }
      
      // If it's a relative path starting with /uploads/
      if (url.startsWith('/uploads/')) {
        return `${serverBaseUrl}${url}`;
      }
      
      // If it's a full URL with /uploads/ but not localhost or IP (external URL)
      // Extract just the path and use current server
      const pathMatch = url.match(/\/uploads\/[^?#]*/);
      if (pathMatch) {
        const path = pathMatch[0];
        return `${serverBaseUrl}${path}`;
      }
    }
    
    // Priority 3: If URL is external (not pointing to our server), return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // If it doesn't contain /uploads/, it's an external URL - return as-is
      if (!url.includes('/uploads/')) {
        return url;
      }
    }
    
    // For relative paths, construct the full URL
    if (url.startsWith('/')) {
      return `${serverBaseUrl}${url}`;
    }
    
    // Return as-is if we can't determine how to convert it
    return url;
  } catch (error) {
    // If anything goes wrong, return the original URL
    console.error('[getImageUrl] Error converting URL:', error, 'Original URL:', url);
    return url;
  }
};

// Rating API functions
export type RatingData = {
  rating: {
    id: string;
    ratedUserId: string;
    raterUserId: string;
    rating: number;
    createdAt: string;
    updatedAt: string;
  };
  averageRating: number;
  totalRatings: number;
};

export type RatingResponse = {
  averageRating: number;
  totalRatings: number;
  userRating: {
    id: string;
    rating: number;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export const submitRating = async (
  ratedUserId: string,
  raterUserId: string,
  rating: number
): Promise<any> => {
  try {
    const response = await api.post('/user/rating', {
      ratedUserId,
      raterUserId,
      rating,
    });
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error;
  }
};

export const getRating = async (
  userId: string,
  raterUserId?: string
): Promise<any> => {
  try {
    const params = raterUserId ? { params: { raterUserId } } : {};
    const response = await api.get(`/user/rating/${userId}`, params);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error;
  }
};

export default api;


