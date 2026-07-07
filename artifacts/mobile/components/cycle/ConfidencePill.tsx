import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { CyclePrediction } from "@/types/health";

const LABELS: Record<CyclePrediction["confidence"], string> = {
  none: "No data yet",
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function ConfidencePill({ confidence }: { confidence: CyclePrediction["confidence"] }) {
  const colors = useColors();

  const palette =
    confidence === "high"
      ? { bg: colors.softGreen, fg: colors.riskLow }
      : confidence === "medium"
      ? { bg: colors.softOrange, fg: colors.riskModerate }
      : { bg: colors.secondary, fg: colors.mutedForeground };

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{LABELS[confidence]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
