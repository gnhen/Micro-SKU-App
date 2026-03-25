import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from '@/contexts/SettingsContext';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();
  let themePreference: 'system' | 'light' | 'dark' = 'system';

  try {
    themePreference = useSettings().themePreference;
  } catch {
    // allow usage before provider mounts
  }

  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }

  if (hasHydrated) {
    return colorScheme ?? 'light';
  }

  return 'light';
}
