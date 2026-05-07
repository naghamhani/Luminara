import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface RiskGaugeProps {
  score: number;
  size?: number;
  showLabel?: boolean;
}

export function RiskGauge({ score, size = 140, showLabel = true }: RiskGaugeProps) {
  const colors = useColors();
  const animatedScore = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedScore, {
      toValue: score,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [score]);

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
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI;
  const clampedScore = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - clampedScore / 100);

  return (
    <View style={[styles.container, { width: size, height: size * 0.6 }]}>
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
              opacity: animatedScore.interpolate({
                inputRange: [0, 100],
                outputRange: [0.3, 1],
              }),
            },
          ]}
        />
      </View>

      {showLabel && (
        <View style={styles.labelContainer}>
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
