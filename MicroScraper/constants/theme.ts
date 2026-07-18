/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0173DF';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    card: '#f8f9fa',
    border: '#e1e4e8',
    notification: '#ff6b6b',
    priceRed: '#C00',
    inStockGreen: '#00AA00',
    lowStockOrange: '#E07000',
    starGold: '#FFB800',
    subtleText: '#555',
    memberSavings: '#00AA00',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    card: '#1f2428',
    border: '#30363d',
    notification: '#ff6b6b',
    priceRed: '#FF6B6B',
    inStockGreen: '#4CAF50',
    lowStockOrange: '#FFA040',
    starGold: '#FFB800',
    subtleText: '#AAAAAA',
    memberSavings: '#4CAF50',
  },
  // Windows XP "Luna" theme: beige dialog chrome, title-bar blue, XP green.
  xp: {
    text: '#000000',
    background: '#ECE9D8',      // classic XP dialog face
    tint: '#0055EA',            // Luna title-bar blue
    icon: '#003C74',
    tabIconDefault: '#7F9DB9',
    tabIconSelected: '#0055EA',
    card: '#FFFFFF',
    border: '#919B9C',          // XP group-box gray
    notification: '#FF6B6B',
    priceRed: '#CC0000',
    inStockGreen: '#3B9E33',    // XP start-button green
    lowStockOrange: '#E07000',
    starGold: '#FFB800',
    subtleText: '#4E5A63',
    memberSavings: '#3B9E33',
  },
};

/** Retro font for the Windows XP theme (Trebuchet MS was XP's title-bar font). */
export const XP_FONT = Platform.select({
  ios: 'Trebuchet MS',
  android: 'monospace',
  default: 'Trebuchet MS, Tahoma, sans-serif',
});

/** XP taskbar / title-bar chrome colors. */
export const XP_CHROME = {
  taskbarBlue: '#245EDC',      // XP taskbar gradient blue
  titleBarBlue: '#0055EA',     // Luna title bar
  titleText: '#FFFFFF',
  titleSubText: '#D6E4FF',
  inactiveTabText: '#BFD4F2',
  buttonBorder: '#003C74',     // dark blue edge on Luna buttons
};

/** Blue window edge, like an XP window frame. */
export const XP_WINDOW = {
  borderWidth: 2,
  borderColor: XP_CHROME.titleBarBlue,
};

/**
 * Turns a modal-title <Text> into an XP dialog title bar that hugs the top
 * edge of its dialog box. Pass the dialog's padding and border radius.
 */
export const xpDialogTitle = (padding: number, radius: number) => ({
  fontFamily: XP_FONT,
  color: XP_CHROME.titleText,
  backgroundColor: XP_CHROME.titleBarBlue,
  textAlign: 'left' as const,
  marginTop: -padding,
  marginHorizontal: -padding,
  marginBottom: 14,
  paddingVertical: 9,
  paddingHorizontal: 14,
  borderTopLeftRadius: Math.max(0, radius - 2),
  borderTopRightRadius: Math.max(0, radius - 2),
  overflow: 'hidden' as const,
});

/** Retro emoji stand-ins for tab/row icons in XP mode. */
export const XP_TAB_EMOJI: Record<string, string> = {
  index: '🔍',
  list: '📋',
  pcbuilder: '🖥️',
  history: '🕓',
  explore: '⚙️',
  more: '📁',
};

/** Turns a screen-header <Text> into an XP window title bar. */
export const XP_TITLE_BAR = {
  fontFamily: XP_FONT,
  color: XP_CHROME.titleText,
  backgroundColor: XP_CHROME.titleBarBlue,
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderTopLeftRadius: 8,
  borderTopRightRadius: 8,
  borderBottomLeftRadius: 2,
  borderBottomRightRadius: 2,
  overflow: 'hidden' as const,
};

/**
 * Extra bottom space tab screens need on iOS, where the native (liquid glass)
 * tab bar floats over the content instead of taking layout space. Android's
 * JS tab bar occupies its own layout space, so no clearance is needed there.
 */
export const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 85 : 0;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
