import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Rect, Stop, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import type { CycleEntry } from "@/types/health";
import { useTranslation } from "@/i18n";

const CHART_HEIGHT = 160;
const Y_MIN = 36.0;
const Y_MAX = 37.2;

interface BBTChartProps {
  /** Cycle entries, newest-first (as returned by useHealth()). */
  cycleEntries: CycleEntry[];
  /** Predicted fertile window, YYYY-MM-DD, if available. */
  fertileWindowStart?: string;
  fertileWindowEnd?: string;
}

/**
 * Line chart of basal body temperature over the last 40 logged days.
 * Renders dots on logged days, a shaded band for the predicted fertile
 * window, and a fixed y-axis range of 36.0-37.2 °C.
 */
export default function BBTChart({ cycleEntries, fertileWindowStart, fertileWindowEnd }: BBTChartProps) {
  const colors = useColors();
  const { t } = useTranslation();

  const points = useMemo(() => {
    return [...cycleEntries]
      .filter((e) => typeof e.bbt === "number")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-40);
  }, [cycleEntries]);

  const chartWidth = 320;
  const paddingLeft = 34;
  const paddingRight = 10;
  const paddingTop = 12;
  const paddingBottom = 22;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = CHART_HEIGHT - paddingTop - paddingBottom;

  const xForIndex = (i: number, total: number) =>
    paddingLeft + (total <= 1 ? innerWidth / 2 : (i / (total - 1)) * innerWidth);

  const yForTemp = (t: number) => {
    const clamped = Math.max(Y_MIN, Math.min(Y_MAX, t));
    const pct = (clamped - Y_MIN) / (Y_MAX - Y_MIN);
    return paddingTop + innerHeight - pct * innerHeight;
  };

  if (points.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {t("cycle.bbtEmpty")}
        </Text>
      </View>
    );
  }

  const dates = points.map((p) => p.date);
  const total = points.length;

  const polylinePoints = points
    .map((p, i) => `${xForIndex(i, total)},${yForTemp(p.bbt!)}`)
    .join(" ");

  // Fertile window shading — find index range within our plotted dates.
  let fertileRect: { x1: number; x2: number } | null = null;
  if (fertileWindowStart && fertileWindowEnd) {
    const idxs = dates
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d >= fertileWindowStart && d <= fertileWindowEnd);
    if (idxs.length > 0) {
      const first = idxs[0].i;
      const last = idxs[idxs.length - 1].i;
      fertileRect = {
        x1: xForIndex(first, total) - (total > 1 ? innerWidth / (total - 1) / 2 : 8),
        x2: xForIndex(last, total) + (total > 1 ? innerWidth / (total - 1) / 2 : 8),
      };
    } else if (fertileWindowStart > dates[dates.length - 1]) {
      // Fertile window is entirely in the future relative to logged data —
      // show a thin band at the right edge as a hint of what's ahead.
      fertileRect = { x1: paddingLeft + innerWidth - 18, x2: paddingLeft + innerWidth };
    }
  }

  const yTicks = [36.0, 36.3, 36.6, 36.9, 37.2];

  // Show at most 6 x-axis date labels, evenly spaced.
  const labelCount = Math.min(6, total);
  const labelIdxs = Array.from({ length: labelCount }, (_, k) =>
    Math.round((k / Math.max(1, labelCount - 1)) * (total - 1))
  );

  return (
    <View>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Defs>
          <LinearGradient id="bbtFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.purple} stopOpacity={0.18} />
            <Stop offset="1" stopColor={colors.purple} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Y-axis grid lines + labels */}
        {yTicks.map((t) => (
          <React.Fragment key={t}>
            <Line
              x1={paddingLeft}
              x2={chartWidth - paddingRight}
              y1={yForTemp(t)}
              y2={yForTemp(t)}
              stroke={colors.border}
              strokeWidth={1}
            />
            <SvgText
              x={paddingLeft - 6}
              y={yForTemp(t) + 3}
              fontSize={8}
              fill={colors.mutedForeground}
              textAnchor="end"
            >
              {t.toFixed(1)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Fertile window shaded band */}
        {fertileRect && (
          <Rect
            x={fertileRect.x1}
            y={paddingTop}
            width={Math.max(2, fertileRect.x2 - fertileRect.x1)}
            height={innerHeight}
            fill={colors.warm}
            opacity={0.16}
          />
        )}

        {/* Area under the line */}
        <Polygon
          points={`${xForIndex(0, total)},${paddingTop + innerHeight} ${polylinePoints} ${xForIndex(
            total - 1,
            total
          )},${paddingTop + innerHeight}`}
          fill="url(#bbtFill)"
        />

        {/* BBT line */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.purple}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots on logged days */}
        {points.map((p, i) => (
          <Circle
            key={p.id}
            cx={xForIndex(i, total)}
            cy={yForTemp(p.bbt!)}
            r={2.6}
            fill={colors.card}
            stroke={colors.purple}
            strokeWidth={1.6}
          />
        ))}

        {/* X-axis date labels */}
        {labelIdxs.map((i) => {
          const d = new Date(points[i].date + "T12:00:00");
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          return (
            <SvgText
              key={i}
              x={xForIndex(i, total)}
              y={CHART_HEIGHT - 6}
              fontSize={8}
              fill={colors.mutedForeground}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
      {fertileRect && (
        <View style={styles.legendRow}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.warm, opacity: 0.4 }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
            {t("cycle.predictedFertile")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
