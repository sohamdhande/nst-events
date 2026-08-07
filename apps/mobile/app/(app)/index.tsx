import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';

export default function AppHomeScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Welcome to NST Events</Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
        Browse events, manage registrations, and stay connected with your clubs.
      </Text>
    </View>
  );
}
