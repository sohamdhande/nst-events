import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { getPersistentDeviceId } from '../src/lib/device-id';
import * as Crypto from 'expo-crypto';

// Mock expo-secure-store
vi.mock('expo-secure-store', () => {
  let store: Record<string, string> = {};
  return {
    getItemAsync: vi.fn(async (key: string) => store[key] || null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      delete store[key];
    }),
    _resetStore: () => {
      store = {};
    }
  };
});

// Mock expo-crypto
vi.mock('expo-crypto', () => {
  return {
    randomUUID: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
  };
});

describe('getPersistentDeviceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (SecureStore as any)._resetStore();
  });

  it('generates and persists a new UUID on first launch', async () => {
    const id1 = await getPersistentDeviceId();
    expect(id1).toBeDefined();
    expect(id1).toMatch(/^mock-uuid-/);
    
    // Verify it was stored
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nst_persistent_device_id', id1);
  });

  it('returns the exact same UUID on second launch', async () => {
    const id1 = await getPersistentDeviceId();
    const id2 = await getPersistentDeviceId();
    
    expect(id1).toEqual(id2);
    // Should only call setItemAsync once (on first launch)
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it('throws an explicit error if SecureStore is completely unavailable', async () => {
    (SecureStore.getItemAsync as any).mockRejectedValueOnce(new Error('Storage broken'));
    
    await expect(getPersistentDeviceId()).rejects.toThrow('SECURE_STORE_UNAVAILABLE');
  });

  it('does not contain OS-derived values like Platform.Version', async () => {
    const id = await getPersistentDeviceId();
    expect(id).not.toContain('ios');
    expect(id).not.toContain('android');
  });
});
