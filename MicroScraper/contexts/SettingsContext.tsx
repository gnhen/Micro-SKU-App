import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TabRoute = 'index' | 'list' | 'pcbuilder' | 'history' | 'explore';

export type Department =
  | 'General Sales'
  | 'Build Your Own'
  | 'Systems'
  | 'Apple'
  | 'Service'
  | 'Front End';

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
  setDepartment: (dept: Department) => void;
  setSelectedTabs: (tabs: TabRoute[]) => void;
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

  // Load persisted settings
  useEffect(() => {
    (async () => {
      try {
        const [dept, tabs] = await Promise.all([
          AsyncStorage.getItem('department'),
          AsyncStorage.getItem('selectedTabs'),
        ]);
        if (dept) setDepartmentState(dept as Department);
        if (tabs) setSelectedTabsState(JSON.parse(tabs));
      } catch (_) {}
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

  const { visibleTabs, overflowTabs, showMoreTab } = computeVisibility(selectedTabs);

  return (
    <SettingsContext.Provider
      value={{
        department,
        selectedTabs,
        visibleTabs,
        overflowTabs,
        showMoreTab,
        setDepartment,
        setSelectedTabs,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
