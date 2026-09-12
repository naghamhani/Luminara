import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { ReproductivePhase } from "@/types/health";

const PHASE_ORDER: ReproductivePhase[] = ["menstrual", "follicular", "ovulation", "luteal"];

/**
 * Compact ribbon visualizing where the current cycle day falls across the
 * four cycle phases (menstrual / follicular / ovulation / luteal). Renders
 * nothing meaningful for non-cycle phases (pregnancy/postpartum/menopause/
 * unknown) beyond a neutral, evenly-lit ribbon — callers should prefer to
 * only show this alongside a phase chip that already communicates the state.
 */
export default function PhaseRibbon({
  phase,
  currentCycleDay,
  avgCycleLength,
}: {
  phase: ReproductivePhase;
  currentCycleDay?: number;
  avgCycleLength?: number;
}) {
  const colors = useColors();

  const cycleLength = avgCycleLength && avgCycleLength > 0 ? avgCycleLength : 28;
  const day = currentCycleDay && currentCycleDay > 0 ? currentCycleDay : undefined;
  const progressPct = day ? Math.max(0, Math.min(1, day / cycleLength)) : undefined;

  // Rough segment boundaries as a fraction of a typical cycle: menstrual
  // ~0-18%, follicular ~18-46%, ovulation ~46-57%, luteal ~57-100%.
  const segments: { key: ReproductivePhase; from: number; to: number; color: string }[] = [
    { key: "menstrual", from: 0, to: 0.18, color: colors.riskHigh },
    { key: "follicular", from: 0.18, to: 0.46, color: colors.teal },
    { key: "ovulation", from: 0.46, to: 0.57, color: colors.warm },
    { key: "luteal", from: 0.57, to: 1, color: colors.purple },
  ];

  const isCyclePhase = PHASE_ORDER.includes(phase);

  return (
    <View>
      <View style={styles.ribbon}>
        {segments.map((s) => (
          <View
            key={s.key}
            style={[
              styles.segment,
              {
                flex: s.to - s.from,
                backgroundColor: isCyclePhase && s.key === phase ? s.color : s.color + "40",
              },
            ]}
          />
        ))}
        {progressPct !== undefined && (
          <View
            style={[
              styles.marker,
              {
                left: `${progressPct * 100}%` as any,
                borderColor: colors.card,
                backgroundColor: colors.foreground,
              },
            ]}
          />
        )}
      </View>
      <View style={styles.labelsRow}>
        {segments.map((s) => (
          <Text
            key={s.key}
            style={[
              styles.segLabel,
              {
                color: isCyclePhase && s.key === phase ? colors.foreground : colors.mutedForeground,
                fontFamily: isCyclePhase && s.key === phase ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}
          >
            {s.key === "menstrual"
              ? "Period"
              : s.key === "follicular"
              ? "Follicular"
              : s.key === "ovulation"
              ? "Ovulation"
              : "Luteal"}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    position: "relative",
  },
  segment: { height: "100%" },
  marker: {
    position: "absolute",
    top: -3,
    width: 8,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    marginStart: -4,
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  segLabel: { fontSize: 9 },
});
