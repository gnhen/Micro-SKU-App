import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useOptionalSettings } from '@/contexts/SettingsContext';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const colorScheme = useRNColorScheme();
  const themePreference = useOptionalSettings()?.themePreference ?? 'system';

  if (themePreference === 'light' || themePreference === 'dark' || themePreference === 'xp') {
    return themePreference;
  }

  if (hasHydrated) {
    return colorScheme ?? 'light';
  }

  return 'light';
}
