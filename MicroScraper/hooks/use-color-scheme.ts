import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from '@/contexts/SettingsContext';

export function useColorScheme(): 'light' | 'dark' {
	const systemScheme = useRNColorScheme() ?? 'light';

	try {
		const { themePreference } = useSettings();
		if (themePreference === 'light' || themePreference === 'dark') {
			return themePreference;
		}
	} catch {
		// allow usage before provider mounts
	}

	return systemScheme;
}
