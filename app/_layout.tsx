import '../src/sync/background';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { useEffect } from 'react';
import { AppState, Platform, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { ThemeProvider, useAppTheme } from '../src/theme';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { subscribeToPushNotifications } from '../src/push/pushRegistration';

function RootLayoutNav() {
  const theme = useAppTheme();
  const { isAuthenticated, isLoading, initializationError, retryInitialization } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const hideNavigationBar = async () => {
      try {
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setVisibilityAsync('hidden');
      } catch {
        // Some Android devices restrict immersive mode; the app remains usable.
      }
    };

    void hideNavigationBar();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void hideNavigationBar();
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isLoading || initializationError) return;

    const inTabsGroup = segments[0] === '(tabs)' || segments[0] === 'concurso';
    const isPreferencias = segments[0] === 'preferencias-iniciais';

    if (!isAuthenticated && (inTabsGroup || isPreferencias)) {
      // Redirect to login or onboarding
      router.replace('/onboarding');
    } else if (isAuthenticated && ['index', 'onboarding', 'login', 'cadastro'].includes(String(segments[0]))) {
      // A remembered local session does not require a server round-trip to boot.
      router.replace('/(tabs)/inicio');
    }
  }, [isAuthenticated, isLoading, initializationError, segments]);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;
    return subscribeToPushNotifications(route => router.push(route as any));
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surfaceLowest }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (initializationError) {
    return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.colors.surfaceLowest }}>
      <Text accessibilityRole="header" style={{ fontSize: 22, color: theme.colors.primary }}>Dados salvos indisponíveis</Text>
      <Text style={{ marginVertical: 16, color: theme.colors.primary }}>{initializationError}</Text>
      <Pressable accessibilityRole="button" onPress={() => void retryInitialization()} style={{ padding: 16, backgroundColor: theme.colors.tertiaryContainer }}>
        <Text style={{ color: theme.colors.onTertiaryContainer }}>Tentar novamente</Text>
      </Pressable>
    </View>;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="cadastro" options={{ headerShown: false }} />
      <Stack.Screen name="preferencias-iniciais" options={{ headerShown: false }} />
      <Stack.Screen name="privacidade-seguranca" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="concurso/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="tenderproof" options={{ headerShown: false }} />
      <Stack.Screen name="notificacoes" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
          <StatusBar style={useStatusBarStyle()} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function useStatusBarStyle() {
  const theme = useAppTheme();
  return theme.isDark ? 'light' : 'dark';
}
