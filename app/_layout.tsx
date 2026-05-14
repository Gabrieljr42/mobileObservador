import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../src/theme';
import { StatusBar } from 'expo-status-bar';

function RootLayoutNav() {
  const theme = useAppTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inTabsGroup = segments[0] === '(tabs)' || segments[0] === 'concurso';
    const isPreferencias = segments[0] === 'preferencias-iniciais';

    if (!isAuthenticated && (inTabsGroup || isPreferencias)) {
      // Redirect to login or onboarding
      router.replace('/onboarding');
    } else if (isAuthenticated && segments[0] === 'login') {
      // If logged in and going to login, redirect to tabs (preferences check usually happens in login or here)
      router.replace('/(tabs)/inicio');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surfaceLowest }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="cadastro" options={{ headerShown: false }} />
      <Stack.Screen name="preferencias-iniciais" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="concurso/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="notificacoes" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
