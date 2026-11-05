import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '@/lib/theme';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text,
          }}
        >
          <Stack.Screen name="index" options={{ title: 'HiFadithi' }} />
          <Stack.Screen name="invite" options={{ title: 'Invite staff' }} />
          <Stack.Screen
            name="patterns"
            options={{ title: 'Shared components' }}
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
