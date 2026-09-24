/**
 * Dynamic proxy route that renders whichever tab screen component is requested.
 * Used by the More screen on iOS to navigate to overflow tabs that are hidden
 * from NativeTabs (hidden tabs are completely unreachable on native tab bars).
 */
import { useLocalSearchParams } from 'expo-router';
import IndexScreen from './(tabs)/index';
import ListScreen from './(tabs)/list';
import PcBuilderScreen from './(tabs)/pcbuilder';
import HistoryScreen from './(tabs)/history';
import ExploreScreen from './(tabs)/explore';

const SCREENS: Record<string, React.ComponentType> = {
  index: IndexScreen,
  list: ListScreen,
  pcbuilder: PcBuilderScreen,
  history: HistoryScreen,
  explore: ExploreScreen,
};

export default function TabProxyScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const Screen = name ? SCREENS[name] : null;
  return Screen ? <Screen /> : null;
}
