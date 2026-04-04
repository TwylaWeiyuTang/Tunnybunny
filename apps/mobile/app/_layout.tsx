import '@walletconnect/react-native-compat';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [appKitReady, setAppKitReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Lazy-init AppKit on native platforms only
      import('@/services/walletconnect/appkit').then(({ getAppKit }) => {
        getAppKit();
        setAppKitReady(true);
      });
    }
  }, []);

  const content = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="group/create"
          options={{ title: 'Create Group', presentation: 'modal' }}
        />
        <Stack.Screen
          name="group/[id]"
          options={{ title: 'Group' }}
        />
        <Stack.Screen
          name="group/add-expense"
          options={{ title: 'Add Expense', presentation: 'modal' }}
        />
        <Stack.Screen
          name="settle/[id]"
          options={{ title: 'Settle Up', presentation: 'modal' }}
        />
        <Stack.Screen
          name="settle/token-select"
          options={{ title: 'Select Token' }}
        />
        <Stack.Screen
          name="settle/confirm"
          options={{ title: 'Confirm Payment' }}
        />
        <Stack.Screen
          name="settle/request"
          options={{ title: 'Request Payment', presentation: 'modal' }}
        />
        <Stack.Screen
          name="settle/scan"
          options={{ title: 'Scan to Pay', headerTransparent: true, headerTintColor: '#fff' }}
        />
      </Stack>
    </ThemeProvider>
  );

  // On native, wait for AppKit before rendering (hooks like useAccount
  // require AppKitProvider to be in the tree)
  if (Platform.OS !== 'web') {
    if (!appKitReady) return null;

    const { AppKitProvider, AppKit } = require('@reown/appkit-react-native');
    const { getAppKit } = require('@/services/walletconnect/appkit');
    return (
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppKitProvider instance={getAppKit()}>
            {content}
            <AppKit />
          </AppKitProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  // Web: render without AppKit wrapper
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {content}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
