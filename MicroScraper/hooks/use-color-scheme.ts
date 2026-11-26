import { useColorScheme as useRNColorScheme } from 'react-native';
import { useOptionalSettings } from '@/contexts/SettingsContext';

export type AppColorScheme = 'light' | 'dark' | 'xp';

export function useColorScheme(): AppColorScheme {
	const systemScheme: 'light' | 'dark' = useRNColorScheme() === 'dark' ? 'dark' : 'light';
	const settings = useOptionalSettings();
	const themePreference = settings?.themePreference;
	if (themePreference === 'light' || themePreference === 'dark' || themePreference === 'xp') {
		return themePreference;
	}

	return systemScheme;
}
