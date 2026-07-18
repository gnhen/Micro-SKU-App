import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from '@/contexts/SettingsContext';

export type AppColorScheme = 'light' | 'dark' | 'xp';

export function useColorScheme(): AppColorScheme {
	const systemScheme = useRNColorScheme() ?? 'light';

	try {
		const { themePreference } = useSettings();
		if (themePreference === 'light' || themePreference === 'dark' || themePreference === 'xp') {
			return themePreference;
		}
	} catch {
		// allow usage before provider mounts
	}

	return systemScheme;
}
