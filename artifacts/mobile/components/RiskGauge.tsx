import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface RiskGaugeProps {
  score: number;
  size?: number;
  showLabel?: boolean;
}

export function RiskGauge({ score, size = 140, showLabel = true }: RiskGaugeProps) {
  const colors = useColors();
  const animatedScore = useSharedValue(0);

  useEffect(() => {
    animatedScore.value = withTiming(score, { duration: 900 });
  }, [score]);

  // Fire one restrained warning-level pulse the moment risk first reads as
  // "High" — never repeats on subsequent renders at the same level, in
  // keeping with the app's calm, non-alarming design philosophy.
  useEffect(() => {
    if (score > 65 && Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [score > 65]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedScore.value, [0, 100], [0.3, 1]),
  }));

  const getRiskColor = (s: number) => {
    if (s <= 35) return colors.riskLow;
    if (s <= 65) return colors.riskModerate;
    return colors.riskHigh;
  };

  const getRiskLabel = (s: number) => {
    if (s <= 35) return "Low Risk";
    if (s <= 65) return "Moderate";
    return "High Risk";
  };

  const getRiskDesc = (s: number) => {
    if (s <= 35) return "You're doing well";
    if (s <= 65) return "Take extra care";
    return "Seek support";
  };

  const riskColor = getRiskColor(score);
  const strokeWidth = size * 0.08;

  return (
    <View
      style={[styles.container, { width: size, height: size * 0.6 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Risk gauge: ${getRiskLabel(score)}, score ${score} out of 100`}
    >
      <View style={[styles.arc, { width: size, height: size / 2 + strokeWidth }]}>
        <View
          style={[
            styles.track,
            {
              width: size - strokeWidth,
              height: (size - strokeWidth) / 2,
              borderRadius: (size - strokeWidth) / 2,
              borderWidth: strokeWidth,
              borderColor: colors.lavender,
              borderBottomColor: "transparent",
            },
          ]}
        />
        <Animated.View
          style={[
            styles.fill,
            {
              width: size - strokeWidth,
              height: (size - strokeWidth) / 2,
              borderRadius: (size - strokeWidth) / 2,
              borderWidth: strokeWidth,
              borderColor: riskColor,
              borderBottomColor: "transparent",
            },
            fillStyle,
          ]}
        />
      </View>

      {showLabel && (
        <View style={styles.labelContainer} importantForAccessibility="no-hide-descendants">
          <Text style={[styles.score, { color: riskColor }]}>{score}</Text>
          <Text style={[styles.label, { color: riskColor }]}>
            {getRiskLabel(score)}
          </Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>
            {getRiskDesc(score)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  arc: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  track: {
    position: "absolute",
    top: 0,
  },
  fill: {
    position: "absolute",
    top: 0,
  },
  labelContainer: {
    alignItems: "center",
    position: "absolute",
    bottom: 0,
  },
  score: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  desc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
});
