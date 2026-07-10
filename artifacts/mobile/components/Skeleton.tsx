import React, { useEffect } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Reusable pulsing placeholder block for loading states. Colored from the
 * theme's neutral surface tokens (never a hardcoded gray) so it matches
 * light/dark mode automatically.
 */
export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  const colors = useColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.muted,
          borderColor: colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
