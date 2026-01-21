import { getImageUrl } from './api';

// Default avatar URLs for web
const defaultAvatars = [
  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300',
  'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=300',
  'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=300',
];

/**
 * Helper function to get the correct image source for an avatar (web version)
 * Returns an object with uri property for consistency with mobile version
 */
export const getAvatarImageSource = (avatarUri: string | null | undefined) => {
  if (!avatarUri) {
    return { uri: defaultAvatars[0] };
  }
  
  // For web, convert localhost URLs to appropriate server address
  const convertedUrl = getImageUrl(avatarUri);
  return { uri: convertedUrl || avatarUri };
};

// Export default avatars for use in components
export const localAvatarSources = defaultAvatars;
export const localAvatarUris = defaultAvatars;

/**
 * Check if a URL is a local avatar (for web, we just check if it's a default avatar)
 */
export const isLocalAvatarUrl = (url: string): boolean => {
  if (!url) return false;
  return defaultAvatars.some(avatar => url.includes(avatar) || avatar.includes(url));
};

/**
 * Get the local avatar index from a URL (returns -1 if not a local avatar)
 */
export const getLocalAvatarIndex = (url: string): number => {
  if (!url) return -1;
  const index = defaultAvatars.findIndex(avatar => url.includes(avatar) || avatar.includes(url));
  return index;
};

/**
 * Get a local file URI for a bundled avatar asset (web version - returns URL directly)
 */
export const getLocalAvatarFileUri = async (avatarIndex: number): Promise<string | null> => {
  try {
    if (avatarIndex >= 0 && avatarIndex < defaultAvatars.length) {
      return defaultAvatars[avatarIndex];
    }
    return null;
  } catch (error) {
    console.error('[Avatar] Error getting local avatar file URI:', error);
    return null;
  }
};
