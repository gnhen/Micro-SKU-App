import React from 'react';
import {
  Platform,
  processColor,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { XP_CHROME } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const glassAvailable = Platform.OS === 'ios' && isLiquidGlassAvailable();

// Windows XP "Luna" button chrome: squared-off corners and a dark blue edge.
const XP_BUTTON: ViewStyle = {
  borderRadius: 3,
  borderWidth: 1.5,
  borderColor: XP_CHROME.buttonBorder,
};

/** Returns `color` with its alpha multiplied by `alpha`, in rgba() form. */
function withAlpha(color: string, alpha: number): string {
  const processed = processColor(color);
  if (typeof processed !== 'number') return color;
  const a = ((processed >>> 24) & 0xff) / 255;
  const r = (processed >>> 16) & 0xff;
  const g = (processed >>> 8) & 0xff;
  const b = processed & 0xff;
  return `rgba(${r},${g},${b},${Math.min(1, a * alpha).toFixed(3)})`;
}

export type GlassButtonProps = TouchableOpacityProps & {
  /** Overrides the glass tint. Defaults to the style's backgroundColor. */
  glassTint?: string;
};

/**
 * Drop-in replacement for TouchableOpacity that renders a Liquid Glass
 * background on iOS 26+. The button's backgroundColor is kept underneath the
 * glass at reduced opacity so the button stays clearly colored while picking
 * up the glass sheen. On Android, web, and older iOS versions it renders a
 * plain TouchableOpacity with the exact style passed in, so the solid
 * backgroundColor fallback is preserved.
 */
export function GlassButton({ style, glassTint, children, ...rest }: GlassButtonProps) {
  const colorScheme = useColorScheme();

  // XP theme: no glass — solid Luna-style beveled buttons on every platform.
  if (colorScheme === 'xp') {
    return (
      <TouchableOpacity style={[style, XP_BUTTON]} {...rest}>
        {children}
      </TouchableOpacity>
    );
  }

  if (!glassAvailable) {
    return (
      <TouchableOpacity style={style} {...rest}>
        {children}
      </TouchableOpacity>
    );
  }

  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const tint =
    glassTint ?? (typeof flat.backgroundColor === 'string' ? flat.backgroundColor : undefined);

  return (
    <TouchableOpacity
      {...rest}
      style={[
        flat,
        {
          backgroundColor: tint ? withAlpha(tint, 0.72) : 'transparent',
          borderRadius: flat.borderRadius ?? 0,
          overflow: 'hidden',
        },
      ]}
    >
      <GlassView
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: flat.borderRadius ?? 0 }]}
        glassEffectStyle="regular"
        tintColor={tint}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
      />
      {children}
    </TouchableOpacity>
  );
}
