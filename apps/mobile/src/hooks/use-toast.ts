import { Alert } from 'react-native';

export const useToast = () => {
  return {
    show: (message: string, type: 'success' | 'error' | 'info', title?: string) => {
      // In a real app we would use a toast library or global context.
      // For this isolated implementation we map the required toast matrix to native alerts
      // to guarantee visual feedback matches the strict toast matrix docs.
      Alert.alert(title || type.toUpperCase(), message);
    }
  };
};
