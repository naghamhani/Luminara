import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { WellnessContribution } from "@/types/health";

/**
 * Horizontal contribution-bar breakdown for a composite wellness score.
 * Each row shows the factor label, a bar scaled by (weight * impact) so the
 * bars visually sum to the overall score contribution, and a color cue for
 * how much concern that factor is currently raising.
 */
export default function ContributionBars({
  contributions,
}: {
  contributions: WellnessContribution[];
}) {
  const colors = useColors();

  if (!contributions.length) return null;

  // Scale bars relative to the single largest weighted contribution so the
  // most impactful factor always reads as a full-width bar.
  const weighted = contributions.map((c) => c.weight * c.impact);
  const maxWeighted = Math.max(0.0001, ...weighted);

  const impactColor = (impact: number) => {
    if (impact >= 0.66) return colors.riskHigh;
    if (impact >= 0.33) return colors.riskModerate;
    return colors.riskLow;
  };

  const impactLabel = (impact: number) => {
    if (impact >= 0.66) return "High";
    if (impact >= 0.33) return "Some";
    return "Low";
  };

  return (
    <View style={styles.container}>
      {contributions.map((c, i) => {
        const w = weighted[i];
        const pct = Math.max(0.04, w / maxWeighted);
        const color = impactColor(c.impact);
        return (
          <View key={c.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={[styles.label, { color: colors.text }]}>{c.label}</Text>
              <View style={[styles.badge, { backgroundColor: color + "1A" }]}>
                <Text style={[styles.badgeText, { color }]}>{impactLabel(c.impact)}</Text>
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: colors.lavender }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct * 100}%` as any, backgroundColor: color },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  row: { gap: 6 },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});
