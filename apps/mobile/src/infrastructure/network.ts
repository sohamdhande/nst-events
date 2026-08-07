import { useState, useEffect } from 'react';

// Lightweight network status hook.
// For production, install @react-native-community/netinfo and replace
// with NetInfo.addEventListener for real connectivity detection.
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Default to online. Real implementation would use NetInfo.addEventListener
    // to track actual connectivity changes.
    setIsOnline(true);
  }, []);

  return { isOnline };
};
