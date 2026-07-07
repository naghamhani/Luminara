import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { addDays, toDateString, type CycleEntry, type CyclePrediction, type FlowLevel } from "@/types/health";

interface CycleStripProps {
  entries: CycleEntry[];
  prediction: CyclePrediction;
  today?: string;
  days?: number;
}

function isFlowActive(flow: FlowLevel | undefined): boolean {
  return flow === "light" || flow === "medium" || flow === "heavy";
}

/**
 * Horizontal strip of small day cells spanning the last few days through the
 * next couple of weeks. Colors:
 *  - logged flow day -> destructive/soft red fill
 *  - predicted fertile window -> teal/softGreen fill
 *  - predicted period (future) -> destructive outline only
 *  - today -> highlighted border
 */
export function CycleStrip({ entries, prediction, today, days = 35 }: CycleStripProps) {
  const colors = useColors();
  const todayStr = today ?? toDateString(new Date());

  const entryByDate = new Map(entries.map((e) => [e.date, e]));

  // Show a window that starts ~10 days before today so recent logged flow is
  // visible, then runs forward to cover predictions.
  const startOffset = -10;
  const cells = Array.from({ length: days }, (_, i) => addDays(todayStr, startOffset + i));

  const isPredictedFertile = (date: string) =>
    !!prediction.fertileWindowStart &&
    !!prediction.fertileWindowEnd &&
    date >= prediction.fertileWindowStart &&
    date <= prediction.fertileWindowEnd;

  const isPredictedOvulation = (date: string) => date === prediction.ovulationDate;

  const isPredictedPeriod = (date: string) => {
    if (!prediction.nextPeriodStart) return false;
    const periodLen = Math.round(prediction.avgPeriodLength ?? 5);
    const end = addDays(prediction.nextPeriodStart, periodLen - 1);
    return date >= prediction.nextPeriodStart && date <= end;
  };

  return (
    <View>
      <View style={styles.scrollRow}>
        {cells.map((date) => {
          const entry = entryByDate.get(date);
          const isToday = date === todayStr;
          const loggedFlow = isFlowActive(entry?.flow);
          const predictedFertile = !loggedFlow && isPredictedFertile(date);
          const predictedOvulation = !loggedFlow && isPredictedOvulation(date);
          const predictedPeriod = !loggedFlow && !predictedFertile && isPredictedPeriod(date);

          let backgroundColor = colors.secondary;
          let borderColor: string | undefined;
          let borderWidth = 0;
          let dotColor: string | undefined;

          if (loggedFlow) {
            backgroundColor = colors.softRed;
            dotColor = colors.riskHigh;
          } else if (predictedOvulation) {
            backgroundColor = colors.teal + "33";
            borderColor = colors.teal;
            borderWidth = 1.5;
          } else if (predictedFertile) {
            backgroundColor = colors.softGreen;
          } else if (predictedPeriod) {
            borderColor = colors.riskHigh;
            borderWidth = 1;
          }

          const d = new Date(date + "T12:00:00");
          const dayNum = d.getDate();
          const isFirstOfRange = date === cells[0];
          const showMonthLabel = isFirstOfRange || dayNum === 1;

          return (
            <View key={date} style={styles.cellCol}>
              {showMonthLabel ? (
                <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>
                  {d.toLocaleDateString("en-US", { month: "short" })}
                </Text>
              ) : (
                <Text style={styles.monthLabel} />
              )}
              <View
                style={[
                  styles.cell,
                  {
                    backgroundColor,
                    borderColor,
                    borderWidth,
                  },
                  isToday && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: isToday ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {dayNum}
                </Text>
                {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <LegendItem swatchColor={colors.softRed} label="Period" colors={colors} />
        <LegendItem swatchColor={colors.softGreen} label="Fertile window" colors={colors} />
        <LegendItem swatchColor={colors.teal + "33"} borderColor={colors.teal} label="Ovulation" colors={colors} />
        <LegendItem outlineColor={colors.riskHigh} label="Predicted period" colors={colors} />
      </View>
    </View>
  );
}

function LegendItem({
  swatchColor,
  borderColor,
  outlineColor,
  label,
  colors,
}: {
  swatchColor?: string;
  borderColor?: string;
  outlineColor?: string;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          swatchColor ? { backgroundColor: swatchColor } : { backgroundColor: "transparent" },
          borderColor ? { borderColor, borderWidth: 1.5 } : undefined,
          outlineColor ? { borderColor: outlineColor, borderWidth: 1 } : undefined,
        ]}
      />
      <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const CELL_SIZE = 26;

const styles = StyleSheet.create({
  scrollRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  cellCol: {
    alignItems: "center",
    width: (CELL_SIZE * 7 + 6 * 4) / 7 - 0.6,
  },
  monthLabel: {
    fontSize: 8,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
    height: 11,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  dot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
