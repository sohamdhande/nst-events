import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'nst_persistent_device_id';

/**
 * Gets a persistent, cryptographically random device ID.
 * If one does not exist, it generates a new UUID, saves it to SecureStore, and returns it.
 * This guarantees the exact same UUID is used for the lifetime of the app installation.
 */
export async function getPersistentDeviceId(): Promise<string> {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    // If SecureStore throws, do NOT silently fall back to a non-unique value.
    // Rethrow so the caller knows the storage mechanism is unavailable.
    console.error('Failed to access SecureStore for device ID:', error);
    throw new Error('SECURE_STORE_UNAVAILABLE');
  }
}
