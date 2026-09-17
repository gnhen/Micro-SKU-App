import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { checkForUpdates } from '@/services/updateChecker';
import { getRemoteState } from '@/services/remoteState';

const XpNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.xp.tint,
    background: Colors.xp.background,
    card: Colors.xp.background,
    text: Colors.xp.text,
    border: Colors.xp.border,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const [serviceReady, setServiceReady] = useState(true);

  useEffect(() => {
    // Check for updates silently on app start
    checkForUpdates(true);

    // Availability check. It is delayed and jittered (so it is not a fixed
    // startup call) and shares its in-flight request with the update check
    // via getRemoteState's cache, so the two result in a single fetch.
    let disposed = false;

    const evaluateAvailability = async () => {
      try {
        const { state } = await getRemoteState();
        if (!disposed && state === 'gone') {
          setServiceReady(false);
        }
      } catch (_availabilityError) {
        // Transport failures are treated as "offline" and leave readiness unchanged.
      }
    };

    const timer = setTimeout(evaluateAvailability, 2000 + Math.floor(Math.random() * 6000));

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, []);

  if (!serviceReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 20 }}>Service Unavailable</Text>
      </View>
    );
  }

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : colorScheme === 'xp' ? XpNavTheme : DefaultTheme}
    >
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="challenge" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <RootLayoutContent />
    </SettingsProvider>
  );
}
