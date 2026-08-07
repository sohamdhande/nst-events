import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Modal as RNModal } from 'react-native';

export const Button = ({ title, onPress, disabled, loading, variant = 'primary', accessibilityLabel, accessibilityRole = 'button' }: any) => (
  <TouchableOpacity 
    onPress={onPress} 
    disabled={disabled || loading}
    accessibilityLabel={accessibilityLabel || title}
    accessibilityRole={accessibilityRole}
    accessibilityState={{ disabled: disabled || loading, busy: loading }}
    className={`p-4 rounded-md flex-row justify-center items-center ${disabled ? 'bg-gray-300' : variant === 'danger' ? 'bg-danger' : 'bg-primary'}`}
  >
    {loading ? <Spinner color="white" /> : <Text className="text-white font-bold">{title}</Text>}
  </TouchableOpacity>
);

export const IconButton = ({ icon, onPress }: any) => (
  <TouchableOpacity onPress={onPress} className="p-2 rounded-full bg-surface">
    <Text>{icon}</Text>
  </TouchableOpacity>
);

export const Card = ({ children }: { children: React.ReactNode }) => (
  <View className="p-4 bg-white rounded-lg shadow-sm mb-4">
    {children}
  </View>
);

export const Input = ({ value, onChangeText, placeholder, secureTextEntry }: any) => (
  <TextInput
    className="border border-gray-300 p-4 rounded-md mb-4 bg-surface"
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    secureTextEntry={secureTextEntry}
  />
);

export const Spinner = ({ color = '#0F172A', size = 'small' }: any) => (
  <ActivityIndicator color={color} size={size} accessibilityRole="progressbar" accessibilityLabel="Loading" />
);

export const Skeleton = ({ height = 20, width = '100%', rounded = 'md' }: any) => (
  <View style={{ height, width }} className={`bg-gray-200 rounded-${rounded} mb-2 opacity-50`} />
);

export const Divider = () => <View className="h-[1px] bg-gray-200 my-4 w-full" />;

export const Badge = ({ text, variant = 'primary' }: any) => (
  <View className={`px-2 py-1 rounded-full ${variant === 'success' ? 'bg-success' : 'bg-primary'}`}>
    <Text className="text-white text-xs">{text}</Text>
  </View>
);

export const Chip = ({ text, onPress, selected }: any) => (
  <TouchableOpacity onPress={onPress} className={`px-4 py-2 rounded-full border ${selected ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
    <Text className={selected ? 'text-white' : 'text-gray-700'}>{text}</Text>
  </TouchableOpacity>
);

export const Avatar = ({ initials, size = 40 }: any) => (
  <View style={{ width: size, height: size, borderRadius: size/2 }} className="bg-secondary justify-center items-center">
    <Text className="text-white font-bold">{initials}</Text>
  </View>
);

export const EmptyState = ({ title, message, icon }: any) => (
  <View className="flex-1 justify-center items-center p-8">
    <Text className="text-4xl mb-4">{icon}</Text>
    <Text className="text-xl font-bold text-primary mb-2 text-center">{title}</Text>
    <Text className="text-gray-500 text-center">{message}</Text>
  </View>
);

export const Banner = ({ message, type = 'info' }: any) => (
  <View className={`w-full p-4 ${type === 'error' ? 'bg-danger' : 'bg-secondary'}`}>
    <Text className="text-white text-center font-bold">{message}</Text>
  </View>
);

export const Modal = ({ visible, onClose, title, children }: any) => (
  <RNModal visible={visible} transparent animationType="slide">
    <View className="flex-1 bg-black/50 justify-center items-center p-4">
      <View className="w-full bg-white rounded-lg p-6">
        <Text className="text-xl font-bold mb-4">{title}</Text>
        {children}
        <Button title="Close" onPress={onClose} variant="secondary" />
      </View>
    </View>
  </RNModal>
);

export const BottomSheet = ({ visible, onClose, children }: any) => (
  <RNModal visible={visible} transparent animationType="slide">
    <View className="flex-1 bg-black/50 justify-end">
      <View className="w-full bg-white rounded-t-xl p-6 min-h-[300px]">
        {children}
        <Button title="Dismiss" onPress={onClose} />
      </View>
    </View>
  </RNModal>
);

export const Dialog = Modal; // Alias for now

export const LoadingOverlay = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  return (
    <View className="absolute inset-0 bg-black/30 justify-center items-center z-50">
      <Spinner size="large" color="white" />
    </View>
  );
};

export const Toast = ({ message, visible }: any) => {
  if (!visible) return null;
  return (
    <View className="absolute bottom-10 self-center bg-gray-800 px-6 py-3 rounded-full shadow-lg z-50">
      <Text className="text-white">{message}</Text>
    </View>
  );
};
