import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { Button } from '../../src/ui/primitives';

export default function AuthScreen() {
  const router = useRouter();
  const { isLoggedIn } = useAuthStore();

  // OAuth redirect is handled by the backend — this screen is the entry point
  // that initiates the Google OAuth flow via deep link
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>NST Events</Text>
      <Text style={{ fontSize: 14, color: '#666', marginBottom: 32, textAlign: 'center' }}>
        Sign in with your university account to continue
      </Text>
      <Button title="Sign in with Google" onPress={() => {}} />
    </View>
  );
}
