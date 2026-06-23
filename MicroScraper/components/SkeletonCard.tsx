import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

// Each segment in the shimmer "glow" — together they form a soft gradient bell curve.
// Opacities approximate: 0 → 0.25 → 0.6 → 1.0 → 0.6 → 0.25 → 0
const GRADIENT_SEGMENTS = [
  { width: 20, opacity: 0.00 },
  { width: 28, opacity: 0.18 },
  { width: 36, opacity: 0.50 },
  { width: 52, opacity: 1.00 },
  { width: 36, opacity: 0.50 },
  { width: 28, opacity: 0.18 },
  { width: 20, opacity: 0.00 },
] as const;
// Total shimmer width = 220px

function SkeletonBox({
  shimmer,
  width,
  height,
  style,
}: {
  shimmer: Animated.Value;
  width: number | string;
  height: number;
  style?: object;
}) {
  const isDark = useColorScheme() === 'dark';
  // base: a neutral gray that reads as "unloaded content"
  const baseColor  = isDark ? '#252b33' : '#d6d6d6';
  // peak highlight opacity — subtle on dark, a bit stronger on light
  const peakAlpha  = isDark ? 0.10 : 0.55;

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-260, 680],
  });

  return (
    <View
      style={[
        { width, height, borderRadius: 6, backgroundColor: baseColor, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          flexDirection: 'row',
          transform: [{ translateX }],
        }}
      >
        {GRADIENT_SEGMENTS.map((seg, i) => (
          <View
            key={i}
            style={{
              width: seg.width,
              height: '100%',
              backgroundColor: `rgba(255,255,255,${(seg.opacity * peakAlpha).toFixed(3)})`,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

export default function SkeletonCard({ loadingStatus }: { loadingStatus?: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const b = { shimmer };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Image strip */}
      <SkeletonBox {...b} width="100%" height={185} style={{ borderRadius: 8, marginBottom: 14 }} />

      {/* Price + stock row */}
      <View style={styles.row}>
        <SkeletonBox {...b} width={110} height={30} />
        <SkeletonBox {...b} width={95} height={20} />
      </View>

      {/* Product name */}
      <SkeletonBox {...b} width="88%" height={20} style={{ marginTop: 14 }} />
      <SkeletonBox {...b} width="66%" height={15} style={{ marginTop: 8 }} />

      {/* Location / SKU / MFR */}
      <SkeletonBox {...b} width="58%" height={13} style={{ marginTop: 16 }} />
      <SkeletonBox {...b} width="50%" height={13} style={{ marginTop: 7 }} />
      <SkeletonBox {...b} width="44%" height={13} style={{ marginTop: 7 }} />
      <SkeletonBox {...b} width="36%" height={13} style={{ marginTop: 7 }} />

      {/* Rating */}
      <SkeletonBox {...b} width={125} height={13} style={{ marginTop: 12 }} />

      {/* Buttons */}
      <View style={[styles.row, { marginTop: 20 }]}>
        <SkeletonBox {...b} width="48%" height={46} style={{ borderRadius: 10 }} />
        <SkeletonBox {...b} width="48%" height={46} style={{ borderRadius: 10 }} />
      </View>
      <SkeletonBox {...b} width="100%" height={50} style={{ borderRadius: 10, marginTop: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
});
