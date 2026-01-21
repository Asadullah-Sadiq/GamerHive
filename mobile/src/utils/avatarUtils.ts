import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { getImageUrl } from './api';

// Local avatar images from utils/avatar folder
const localAvatar1Source = require('./avatar/cartoon-woman-wearing-glasses.jpg');
const localAvatar2Source = require('./avatar/cartoon-woman-wearing-glasses (1).jpg');
const localAvatar3Source = require('./avatar/3d-fantasy-scene.jpg');

// Map avatar index to require source for upload
const localAvatarIndexToSource: { [key: number]: any } = {
  0: localAvatar1Source,
  1: localAvatar2Source,
  2: localAvatar3Source,
};

// Cache for resolved URIs (resolved lazily when needed)
const resolvedUriCache: { [key: number]: string | null } = {};

// Helper function to safely resolve asset source using expo-asset
// This avoids the Image.resolveAssetSource issue by using expo-asset instead
const resolveAssetSource = async (source: any): Promise<string | null> => {
  try {
    // Use expo-asset to resolve the asset
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    return asset.localUri || asset.uri || null;
  } catch (error) {
    console.error('Error resolving asset source:', error);
    return null;
  }
};

// Get URI for a local avatar (lazy resolution)
const getLocalAvatarUri = async (index: number): Promise<string | null> => {
  if (resolvedUriCache[index] !== undefined) {
    return resolvedUriCache[index];
  }
  
  const source = localAvatarIndexToSource[index];
  if (!source) {
    resolvedUriCache[index] = null;
    return null;
  }
  
  const uri = await resolveAssetSource(source);
  resolvedUriCache[index] = uri;
  return uri;
};

// Synchronous version that returns a placeholder (for immediate use)
// The actual URI will be resolved when needed
const getLocalAvatarUriSync = (index: number): string => {
  // Return a unique identifier that can be matched later
  return `local-avatar-${index}`;
};

// Map local avatar identifiers to their require() sources
const localAvatarIdentifierToSource: { [key: string]: any } = {
  'local-avatar-0': localAvatar1Source,
  'local-avatar-1': localAvatar2Source,
  'local-avatar-2': localAvatar3Source,
};

/**
 * Helper function to get the correct image source for an avatar
 * If it's a local asset URI, return the require() source; otherwise return { uri: ... }
 * This fixes the issue where local avatars stored as Metro server URIs fail to load
 * when the device can't connect to the Metro bundler.
 */
export const getAvatarImageSource = (avatarUri: string | null | undefined) => {
  if (!avatarUri) return null;
  
  // Check if this is a local avatar identifier
  if (localAvatarIdentifierToSource[avatarUri]) {
    return localAvatarIdentifierToSource[avatarUri];
  }
  
  // Check if this is a Metro bundler asset URI (contains /assets/ or unstable_path)
  // This handles the case where local avatars are stored as Metro server URIs
  const isMetroAssetUri = avatarUri.includes('/assets/') || avatarUri.includes('unstable_path');
  
  if (isMetroAssetUri) {
    // Decode the URI to check for file names
    const decodedUri = decodeURIComponent(avatarUri);
    
    // Check if the URI contains the avatar file names (for cases where the URI format might differ)
    // This handles cases where the URI might be encoded or formatted differently
    if (decodedUri.includes('cartoon-woman-wearing-glasses.jpg') || avatarUri.includes('cartoon-woman-wearing-glasses')) {
      if (decodedUri.includes('(1)') || decodedUri.includes('%281%29') || 
          avatarUri.includes('(1)') || avatarUri.includes('%281%29') ||
          decodedUri.includes('cartoon-woman-wearing-glasses%20%281%29')) {
        return localAvatar2Source;
      }
      return localAvatar1Source;
    }
    
    if (decodedUri.includes('3d-fantasy-scene.jpg') || avatarUri.includes('3d-fantasy-scene')) {
      return localAvatar3Source;
    }
  }
  
  // For remote URLs, convert localhost to appropriate server address
  // Use getImageUrl to convert localhost URLs to the correct server address based on API config
  const convertedUrl = getImageUrl(avatarUri);
  return { uri: convertedUrl || avatarUri };
};

// Export local avatar sources for use in components that need them
export const localAvatarSources = [
  localAvatar1Source,
  localAvatar2Source,
  localAvatar3Source,
];

// Export local avatar URIs for use in avatar options (synchronous identifiers)
export const localAvatarUris = [
  getLocalAvatarUriSync(0),
  getLocalAvatarUriSync(1),
  getLocalAvatarUriSync(2),
];

/**
 * Check if a URL is a local avatar (Metro bundler URI or asset URI)
 */
export const isLocalAvatarUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Check if it's one of our known local avatar identifiers
  const identifiers = localAvatarUris;
  if (identifiers.includes(url)) return true;
  
  // Check if it's a Metro bundler URI
  if (url.includes('/assets/') || url.includes('unstable_path')) {
    const decodedUrl = decodeURIComponent(url);
    return decodedUrl.includes('cartoon-woman-wearing-glasses') || 
           decodedUrl.includes('3d-fantasy-scene');
  }
  
  return false;
};

/**
 * Get the local avatar index from a URL (returns -1 if not a local avatar)
 */
export const getLocalAvatarIndex = (url: string): number => {
  if (!url) return -1;
  
  // Check direct match first (identifier format)
  const identifiers = localAvatarUris;
  const directIndex = identifiers.indexOf(url);
  if (directIndex !== -1) return directIndex;
  
  // Check by filename pattern
  const decodedUrl = decodeURIComponent(url);
  
  if (decodedUrl.includes('cartoon-woman-wearing-glasses')) {
    if (decodedUrl.includes('(1)') || decodedUrl.includes('%281%29')) {
      return 1;
    }
    return 0;
  }
  
  if (decodedUrl.includes('3d-fantasy-scene')) {
    return 2;
  }
  
  return -1;
};

/**
 * Get a local file URI for a bundled avatar asset that can be used for upload
 * This downloads the asset to a local cache directory if needed
 */
export const getLocalAvatarFileUri = async (avatarIndex: number): Promise<string | null> => {
  try {
    console.log('[Avatar] Getting local file URI for index:', avatarIndex);
    
    const source = localAvatarIndexToSource[avatarIndex];
    if (!source) {
      console.error('[Avatar] Invalid avatar index:', avatarIndex);
      return null;
    }
    
    // Load the asset using expo-asset
    console.log('[Avatar] Loading asset from module...');
    const asset = Asset.fromModule(source);
    
    // Download the asset to local storage
    console.log('[Avatar] Downloading asset...');
    await asset.downloadAsync();
    console.log('[Avatar] Asset downloaded. localUri:', asset.localUri, 'uri:', asset.uri);
    
    // The asset should now have a localUri
    if (asset.localUri) {
      console.log('[Avatar] ✅ Using localUri:', asset.localUri);
      return asset.localUri;
    }
    
    // Fallback: If no localUri, try to copy from uri to cache
    if (asset.uri) {
      console.log('[Avatar] No localUri, trying to copy from uri to cache...');
      const cacheDir = FileSystem.Paths.cache?.uri || FileSystem.Paths.document?.uri;
      if (!cacheDir) {
        console.warn('[Avatar] No cache/document directory available from expo-file-system Paths.');
        return asset.uri;
      }
      const filename = `avatar_${avatarIndex}_${Date.now()}.jpg`;
      const normalizedDir = cacheDir.endsWith('/') ? cacheDir : `${cacheDir}/`;
      const destUri = `${normalizedDir}${filename}`;
      
      try {
        await FileSystem.downloadAsync(asset.uri, destUri);
        console.log('[Avatar] ✅ Avatar copied to cache:', destUri);
        return destUri;
      } catch (downloadError) {
        console.error('[Avatar] Failed to download to cache:', downloadError);
        // Return the uri anyway - it might work
        return asset.uri;
      }
    }
    
    console.error('[Avatar] ❌ Could not get local URI for avatar');
    return null;
  } catch (error) {
    console.error('[Avatar] ❌ Error getting local avatar file URI:', error);
    return null;
  }
};
