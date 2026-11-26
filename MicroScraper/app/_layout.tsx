import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

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
  const [availabilityMessage, setAvailabilityMessage] = useState('');

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
      } catch (availabilityError) {
        console.warn('[availability] Initial check failed:', availabilityError);
      }
    };

    const timer = setTimeout(evaluateAvailability, 2000 + Math.floor(Math.random() * 6000));

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, []);

  const retryAvailability = async () => {
    setAvailabilityMessage('Checking availability...');
    try {
      const { state } = await getRemoteState({ force: true });
      if (state !== 'gone') {
        setServiceReady(true);
      } else {
        setAvailabilityMessage('The releases page is still unavailable. Please try again later.');
      }
    } catch (error) {
      console.warn('[availability] Retry failed:', error);
      setAvailabilityMessage('Could not check availability. Please try again.');
    }
  };

  if (!serviceReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text style={{ color: '#fff', fontSize: 20 }}>Service Unavailable</Text>
        <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center' }}>
          The app could not confirm its release page is available. If this keeps happening, check for a newer version.
        </Text>
        {availabilityMessage ? (
          <Text style={{ color: '#aaa', fontSize: 13, textAlign: 'center' }}>{availabilityMessage}</Text>
        ) : null}
        <Pressable onPress={retryAvailability} style={{ backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
          <Text style={{ color: '#000', fontWeight: '700' }}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => {
          Linking.openURL('https://github.com/gnhen/Micro-SKU-App/releases').catch(() => {
            setAvailabilityMessage('Could not open the releases page on this device.');
          });
        }}>
          <Text style={{ color: '#6cf', fontSize: 14 }}>Open releases page</Text>
        </Pressable>
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
        <Stack.Screen name="tab-proxy" options={{ headerShown: false }} />
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
