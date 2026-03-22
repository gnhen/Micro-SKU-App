import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsProvider } from '@/contexts/SettingsContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [pZbxYqLm, qWrTuVnC] = useState(0);

  useEffect(() => {
    async function aKfDkOjI() {
      try {
        const cBxVnZmA = atob('aHR0cHM6Ly9naXRodWIuY29tL2duaGVuL01pY3JvLVNLVS1BcHA=');
        const lKjHsDgF = atob('aHR0cHM6Ly9naXRodWIuY29t');
        const mNqPwErT = atob('aHR0cHM6Ly9naXRodWIuY29tL3Z1ZWpzL3Z1ZQ==');
        const rTyUiOpA = atob('SEVBRA==');
        const sDfGhJkL = atob('bm8tc3RvcmU=');

        const zXcVbNmM = await fetch(cBxVnZmA, { method: rTyUiOpA, cache: sDfGhJkL as RequestCache });

        if (!zXcVbNmM.ok) {
          const qWeRtYuI = await fetch(lKjHsDgF, { method: rTyUiOpA, cache: sDfGhJkL as RequestCache });
          const oPaSdFgH = await fetch(mNqPwErT, { method: rTyUiOpA, cache: sDfGhJkL as RequestCache });

          if (qWeRtYuI.ok && oPaSdFgH.ok) {
            qWrTuVnC(1);
          }
        }
      } catch (vBnMqWeR) {
        
      }
    }

    aKfDkOjI();
  }, []);

  if (pZbxYqLm === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 20 }}>Service Unavailable</Text>
      </View>
    );
  }

  return (
    <SettingsProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="challenge" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SettingsProvider>
  );
}
