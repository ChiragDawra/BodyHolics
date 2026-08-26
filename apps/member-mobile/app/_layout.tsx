import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            {/* Alerts is a stack screen reached from the bell, deliberately not
                a fourth tab (CLAUDE.md rule 8). */}
            <Stack.Screen name="alerts/index" options={{ headerShown: true, title: 'Alerts' }} />
            <Stack.Screen name="payments/checkout" options={{ headerShown: true, title: 'Checkout' }} />
            <Stack.Screen name="payments/counter-qr" options={{ headerShown: true, title: 'Pay at the counter' }} />
            <Stack.Screen name="issues/index" options={{ headerShown: true, title: 'My reports' }} />
            <Stack.Screen name="issues/new" options={{ headerShown: true, title: 'Report something' }} />
          </Stack>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
