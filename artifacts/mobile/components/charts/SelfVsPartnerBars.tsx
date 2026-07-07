import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { PartnerCorrelation } from "@/types/health";

const METRIC_LABELS: Record<PartnerCorrelation["metric"], string> = {
  mood: "Mood",
  sleep: "Sleep quality",
  energy: "Energy",
  wellbeing: "Overall wellbeing",
};

/**
 * Paired-bar comparison (self vs. partner) for each correlated metric, with
 * the agreement note underneath. Values are expected on a 1-5 scale.
 */
export default function SelfVsPartnerBars({
  correlations,
}: {
  correlations: PartnerCorrelation[];
}) {
  const colors = useColors();

  const withData = correlations.filter(
    (c) => c.agreement !== "insufficient_data" && c.selfAvg !== null && c.partnerAvg !== null
  );

  if (withData.length === 0) return null;

  const MAX_SCALE = 5;

  return (
    <View style={styles.container}>
      {withData.map((c) => {
        const selfPct = Math.max(0.04, (c.selfAvg ?? 0) / MAX_SCALE);
        const partnerPct = Math.max(0.04, (c.partnerAvg ?? 0) / MAX_SCALE);
        const agreementColor =
          c.agreement === "aligned"
            ? colors.riskLow
            : c.agreement === "partner_lower"
            ? colors.riskModerate
            : colors.primary;

        return (
          <View key={c.metric} style={styles.metricBlock}>
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: colors.text }]}>
                {METRIC_LABELS[c.metric]}
              </Text>
              <View style={[styles.agreementBadge, { backgroundColor: agreementColor + "1A" }]}>
                <Text style={[styles.agreementText, { color: agreementColor }]}>
                  {c.agreement === "aligned"
                    ? "Aligned"
                    : c.agreement === "partner_lower"
                    ? "Partner sees lower"
                    : "Partner sees higher"}
                </Text>
              </View>
            </View>

            <View style={styles.barRow}>
              <Text style={[styles.barSideLabel, { color: colors.mutedForeground }]}>You</Text>
              <View style={[styles.track, { backgroundColor: colors.lavender }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${selfPct * 100}%` as any, backgroundColor: colors.primary },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: colors.text }]}>
                {c.selfAvg?.toFixed(1)}
              </Text>
            </View>
            <View style={styles.barRow}>
              <Text style={[styles.barSideLabel, { color: colors.mutedForeground }]}>Partner</Text>
              <View style={[styles.track, { backgroundColor: colors.lavender }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${partnerPct * 100}%` as any, backgroundColor: colors.teal },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: colors.text }]}>
                {c.partnerAvg?.toFixed(1)}
              </Text>
            </View>

            <Text style={[styles.note, { color: colors.mutedForeground }]}>{c.note}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  metricBlock: { gap: 8 },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  agreementBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  agreementText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barSideLabel: { fontSize: 10, fontFamily: "Inter_500Medium", width: 46 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  barValue: { fontSize: 11, fontFamily: "Inter_600SemiBold", minWidth: 24, textAlign: "right" },
  note: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 2 },
});
