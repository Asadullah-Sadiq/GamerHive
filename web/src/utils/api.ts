// Backend base URL. Keep as localhost for dev; override via VITE_API_URL if needed.
export const API_BASE_URL: string =
  (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3000';
  

export type ApiSuccess<T> = { success: true; message?: string; data: T };
export type ApiFailure = { success: false; message?: string; error?: string; errors?: any[] };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type StoredUser = {
  dateOfBirth: string;
  id: string;
  username?: string;
  name?: string;
  email?: string;
  picture?: string | null;
  coverPhoto?: string | null;
  isActive?: boolean;
  createdAt?: string;
};

export function getAuthToken(): string | null {
  try {
    // Check localStorage first (preferred)
    const localToken = localStorage.getItem('token');
    if (localToken) {
      return localToken;
    }
    
    // Fallback to sessionStorage
    const sessionToken = sessionStorage.getItem('token');
    if (sessionToken) {
      // Also save to localStorage for consistency
      try {
        localStorage.setItem('token', sessionToken);
      } catch (e) {
        // If localStorage is full, just use sessionStorage
      }
      return sessionToken;
    }
    
    return null;
  } catch {
    return null;
  }
}

export function getStoredUser(): StoredUser | null {
  try {
    // Check localStorage first (preferred)
    let raw = localStorage.getItem('user');
    
    // Fallback to sessionStorage if not in localStorage
    if (!raw) {
      raw = sessionStorage.getItem('user');
      // If found in sessionStorage, also save to localStorage for consistency
      if (raw) {
        try {
          localStorage.setItem('user', raw);
        } catch (e) {
          // If localStorage is full, just use sessionStorage
        }
      }
    }
    
    if (!raw) return null;
    
    // Handle both single and double-stringified data (OAuth callback uses double-stringify)
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
      // If it's still a string after first parse, parse again (handles double-stringify from OAuth)
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
          // If second parse fails, try to use the first parsed result
          console.warn('[getStoredUser] Second parse failed, using first result:', e);
        }
      }
    } catch (e) {
      console.error('[getStoredUser] Failed to parse user data:', e);
      return null;
    }
    
    // Ensure it's an object
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[getStoredUser] Parsed data is not an object:', typeof parsed);
      return null;
    }
    
    // Ensure it has an id field (required for authentication)
    if (!parsed.id) {
      console.warn('[getStoredUser] User data missing id field:', parsed);
      return null;
    }
    
    return parsed as StoredUser;
  } catch (error) {
    console.error('[getStoredUser] Unexpected error:', error);
    return null;
  }
}

export function setAuthSession(user: StoredUser, token: string) {
  // Save in BOTH localStorage and sessionStorage for reliability
  try {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
  } catch (e) {
    console.warn('[setAuthSession] Failed to save to localStorage:', e);
  }
  
  try {
    sessionStorage.setItem('user', JSON.stringify(user));
    sessionStorage.setItem('token', token);
  } catch (e) {
    console.warn('[setAuthSession] Failed to save to sessionStorage:', e);
  }
}

export function clearAuthSession() {
  // Clear from BOTH storages
  try {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  } catch (e) {
    console.warn('[clearAuthSession] Failed to clear localStorage:', e);
  }
  
  try {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
  } catch (e) {
    console.warn('[clearAuthSession] Failed to clear sessionStorage:', e);
  }
}

export function getImageUrl(url?: string | null): string | null {
  if (!url) return null;
  
  // Get the server base URL (without /api)
  const serverBaseUrl = API_BASE_URL.replace('/api', '');
  
  try {
    // Handle blob and data URLs
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    
    // Priority 1: If URL contains localhost, replace it with current server address
    // This is the primary use case - backend always saves with localhost
    if (url.includes('localhost')) {
      // Extract the path (everything after localhost:port)
      const urlMatch = url.match(/localhost:\d+(\/[^?#]*)/);
      if (urlMatch) {
        const path = urlMatch[1];
        const convertedUrl = `${serverBaseUrl}${path}`;
        if (import.meta.env.DEV) {
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
        if (import.meta.env.DEV) {
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
}

async function parseResponse(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await res.json();
  return await res.text();
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { auth = true, headers, body, ...rest } = init;
  const token = auth ? getAuthToken() : null;

  // Check if body is FormData - if so, don't set Content-Type header
  const isFormData = body instanceof FormData;

  const mergedHeaders: Record<string, string> = {
    ...(headers as any),
  };
  if (token) mergedHeaders.Authorization = `Bearer ${token}`;
  
  // Don't set Content-Type for FormData - browser will set it with boundary
  if (isFormData && mergedHeaders['Content-Type']) {
    delete mergedHeaders['Content-Type'];
  }

  // Server mounts routes under /api/* (see server/index.js)
  const normalizedPath =
    path.startsWith('/api/')
      ? path
      : `/api${path.startsWith('/') ? '' : '/'}${path}`;

  const res = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...rest,
    body,
    headers: mergedHeaders,
  });

  const data = await parseResponse(res);
  if (!res.ok) {
    // Normalize to ApiFailure if possible
    if (typeof data === 'object' && data && 'success' in (data as any)) return data as ApiResponse<T>;
    return { success: false, message: (data as any)?.message || `Request failed: ${res.status}` };
  }
  return data as ApiResponse<T>;
}

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

export async function submitRating(
  ratedUserId: string,
  raterUserId: string,
  rating: number
): Promise<ApiResponse<RatingData>> {
  return apiRequest<RatingData>('/user/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ratedUserId, raterUserId, rating }),
  });
}

export async function getRating(
  userId: string,
  raterUserId?: string
): Promise<ApiResponse<RatingResponse>> {
  const query = raterUserId ? `?raterUserId=${raterUserId}` : '';
  return apiRequest<RatingResponse>(`/user/rating/${userId}${query}`);
}


