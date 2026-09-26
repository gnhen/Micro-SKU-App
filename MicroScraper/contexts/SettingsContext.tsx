import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dynamic app icon requires a custom dev client or production build.
// In Expo Go the native module doesn't exist, so we fall back to no-op.
let setNativeAppIcon: (name: string | null) => Promise<string | 'DEFAULT' | false> = async () => 'DEFAULT';
let getAppIcon: () => Promise<string | 'DEFAULT' | null> = async () => null;
try {
  const dynamicIcon = require('@howincodes/expo-dynamic-app-icon');
  setNativeAppIcon = dynamicIcon.setAppIcon;
  getAppIcon = dynamicIcon.getAppIcon;
} catch {
  // Expo Go / missing native module — no-op fallback
}

export type TabRoute = 'index' | 'list' | 'pcbuilder' | 'history' | 'explore';

export type Department =
  | 'General Sales'
  | 'Build Your Own'
  | 'Systems'
  | 'Apple'
  | 'Service'
  | 'Front End';

export type ThemePreference = 'system' | 'light' | 'dark' | 'xp';
export type AppIconPreference = 'default' | 'black' | 'gray' | 'green' | 'purple' | 'salmon' | 'serious' | 'teal' | 'white';

export const APP_ICON_OPTIONS: { key: AppIconPreference; label: string }[] = [
  { key: 'default',  label: 'Default' },
  { key: 'black',    label: 'Black' },
  { key: 'gray',     label: 'Gray' },
  { key: 'green',    label: 'Green' },
  { key: 'purple',   label: 'Purple' },
  { key: 'salmon',   label: 'Salmon' },
  { key: 'serious',  label: 'Serious' },
  { key: 'teal',     label: 'Teal' },
  { key: 'white',    label: 'White' },
];

export const APP_ICON_IMAGE: Record<AppIconPreference, string> = {
  default:  './assets/images/icon.png',
  black:    './assets/icons/micro-sku-black.png',
  gray:     './assets/icons/micro-sku-gray.png',
  green:    './assets/icons/micro-sku-green.png',
  purple:   './assets/icons/micro-sku-purple.png',
  salmon:   './assets/icons/micro-sku-salmon.png',
  serious:  './assets/icons/micro-sku-serious.png',
  teal:     './assets/icons/micro-sku-teal.png',
  white:    './assets/icons/micro-sku-white.png',
};

// Pre-resolved image sources for dynamic icon display (required because require()
// cannot accept a variable at runtime).
export const APP_ICON_RESOLVED: Record<AppIconPreference, number> = {
  default:  require('../assets/images/icon.png'),
  black:    require('../assets/icons/micro-sku-black.png'),
  gray:     require('../assets/icons/micro-sku-gray.png'),
  green:    require('../assets/icons/micro-sku-green.png'),
  purple:   require('../assets/icons/micro-sku-purple.png'),
  salmon:   require('../assets/icons/micro-sku-salmon.png'),
  serious:  require('../assets/icons/micro-sku-serious.png'),
  teal:     require('../assets/icons/micro-sku-teal.png'),
  white:    require('../assets/icons/micro-sku-white.png'),
};

export const DEPARTMENTS: Department[] = [
  'General Sales',
  'Build Your Own',
  'Systems',
  'Apple',
  'Service',
  'Front End',
];

export const DEPARTMENT_DEFAULTS: Record<Department, TabRoute[]> = {
  'General Sales':  ['index', 'list', 'history', 'explore'],
  'Build Your Own': ['index', 'pcbuilder', 'history', 'explore'],
  'Systems':        ['index', 'list', 'history', 'explore'],
  'Apple':          ['index', 'list', 'history', 'explore'],
  'Service':        ['index', 'list', 'history', 'explore'],
  'Front End':      ['index', 'list', 'history', 'explore'],
};

// All toggleable tab routes (Settings is always present and NOT in this list)
export const OPTIONAL_TABS: { route: TabRoute; label: string }[] = [
  { route: 'index',     label: 'Scan' },
  { route: 'list',      label: 'List' },
  { route: 'pcbuilder', label: 'PC Builder' },
  { route: 'history',   label: 'History' },
];

interface SettingsContextValue {
  department: Department;
  selectedTabs: TabRoute[];
  /** Visible tabs in the bottom bar (max 4). When selectedTabs > 4, 'explore' is hidden and 'more' is appended. */
  visibleTabs: (TabRoute | 'more')[];
  /** Tabs that appear in the More screen (overflow). */
  overflowTabs: TabRoute[];
  showMoreTab: boolean;
  plansEnabled: boolean;
  themePreference: ThemePreference;
  appIcon: AppIconPreference;
  setDepartment: (dept: Department) => void;
  setSelectedTabs: (tabs: TabRoute[]) => void;
  setPlansEnabled: (val: boolean) => void;
  setThemePreference: (val: ThemePreference) => void;
  setAppIcon: (val: AppIconPreference) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

function computeVisibility(tabs: TabRoute[]): {
  visibleTabs: (TabRoute | 'more')[];
  overflowTabs: TabRoute[];
  showMoreTab: boolean;
} {
  if (tabs.length <= 4) {
    return { visibleTabs: tabs, overflowTabs: [], showMoreTab: false };
  }

  // > 4 tabs: show first 3 non-explore tabs in bar + More; explore always goes to overflow
  const nonExplore = tabs.filter(t => t !== 'explore');
  const visibleNonExplore = nonExplore.slice(0, 3);
  const overflowNonExplore = nonExplore.slice(3);

  const visibleTabs: (TabRoute | 'more')[] = [...visibleNonExplore, 'more'];
  const overflowTabs: TabRoute[] = [...overflowNonExplore, 'explore'];

  return { visibleTabs, overflowTabs, showMoreTab: true };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [department, setDepartmentState] = useState<Department>('General Sales');
  const [selectedTabs, setSelectedTabsState] = useState<TabRoute[]>(
    DEPARTMENT_DEFAULTS['General Sales']
  );
  const [plansEnabled, setPlansEnabledState] = useState(false);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [appIcon, setAppIconState] = useState<AppIconPreference>('default');

  // Gate children until persisted settings load — prevents the tab/department
  // flash that occurs when defaults render before AsyncStorage resolves.
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load persisted settings
  useEffect(() => {
    (async () => {
      try {
        const [dept, tabs, plans, theme, icon] = await Promise.all([
          AsyncStorage.getItem('department'),
          AsyncStorage.getItem('selectedTabs'),
          AsyncStorage.getItem('plansEnabled'),
          AsyncStorage.getItem('themePreference'),
          AsyncStorage.getItem('appIcon'),
        ]);
        if (dept) setDepartmentState(dept as Department);
        if (tabs) setSelectedTabsState(JSON.parse(tabs));
        if (plans !== null) setPlansEnabledState(JSON.parse(plans));
        if (theme === 'system' || theme === 'light' || theme === 'dark' || theme === 'xp') {
          setThemePreferenceState(theme);
        }
        if (icon && APP_ICON_OPTIONS.find(o => o.key === icon)) {
          setAppIconState(icon as AppIconPreference);
        }
      } catch (_) {}
      finally {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  const setDepartment = (dept: Department) => {
    Alert.alert(
      `Switch to ${dept}?`,
      'Do you want to reset tabs to this department\'s defaults, or keep your current tab selection?',
      [
        {
          text: 'Keep Current Tabs',
          onPress: async () => {
            setDepartmentState(dept);
            await AsyncStorage.setItem('department', dept);
          },
        },
        {
          text: 'Reset to Defaults',
          style: 'default',
          onPress: async () => {
            const defaults = DEPARTMENT_DEFAULTS[dept];
            setDepartmentState(dept);
            setSelectedTabsState(defaults);
            await Promise.all([
              AsyncStorage.setItem('department', dept),
              AsyncStorage.setItem('selectedTabs', JSON.stringify(defaults)),
            ]);
          },
        },
      ]
    );
  };

  const setSelectedTabs = async (tabs: TabRoute[]) => {
    // Always ensure 'explore' (Settings) is present — it cannot be removed
    const normalized: TabRoute[] = tabs.includes('explore') ? tabs : [...tabs, 'explore'];
    setSelectedTabsState(normalized);
    await AsyncStorage.setItem('selectedTabs', JSON.stringify(normalized));
  };

  const setPlansEnabled = async (val: boolean) => {
    setPlansEnabledState(val);
    await AsyncStorage.setItem('plansEnabled', JSON.stringify(val));
  };

  const setThemePreference = async (val: ThemePreference) => {
    setThemePreferenceState(val);
    await AsyncStorage.setItem('themePreference', val);
  };

  const setAppIcon = async (val: AppIconPreference) => {
    setAppIconState(val);
    await AsyncStorage.setItem('appIcon', val);
    // Actually change the launcher icon on the device
    try {
      const iconKey = val === 'default' ? null : val;
      await setNativeAppIcon(iconKey);
    } catch (err) {
      console.warn('[SettingsContext] Failed to change app icon:', err);
    }
  };

  const { visibleTabs, overflowTabs, showMoreTab } = computeVisibility(selectedTabs);

  // Don't render children until settings load — prevents tab/department flash.
  if (!settingsLoaded) return null;

  return (
    <SettingsContext.Provider
      value={{
        department,
        selectedTabs,
        visibleTabs,
        overflowTabs,
        showMoreTab,
        plansEnabled,
        themePreference,
        appIcon,
        setDepartment,
        setSelectedTabs,
        setPlansEnabled,
        setThemePreference,
        setAppIcon,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
