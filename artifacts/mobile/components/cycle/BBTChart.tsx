import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import type { CycleEntry } from "@/types/health";

interface BBTChartProps {
  /** Newest-first cycle entries (as returned by useHealth()). */
  entries: CycleEntry[];
  /** Max number of most-recent logged temps to plot. */
  maxPoints?: number;
}

const CHART_HEIGHT = 110;
const H_PADDING = 8;
const V_PADDING = 14;

/** Simple polyline chart of the last N logged BBT readings, oldest to newest. */
export function BBTChart({ entries, maxPoints = 21 }: BBTChartProps) {
  const colors = useColors();

  const points = useMemo(() => {
    const withBbt = entries.filter((e) => typeof e.bbt === "number");
    // entries are newest-first; take the most recent N then reverse to oldest-first for plotting.
    return [...withBbt.slice(0, maxPoints)].reverse();
  }, [entries, maxPoints]);

  if (points.length < 5) return null;

  const temps = points.map((p) => p.bbt as number);
  const minTemp = Math.min(...temps) - 0.1;
  const maxTemp = Math.max(...temps) + 0.1;
  const range = Math.max(0.1, maxTemp - minTemp);

  return (
    <View>
      <View style={styles.chartWrap}>
        <SvgChart points={points} temps={temps} minTemp={minTemp} range={range} colors={colors} />
      </View>
      <View style={styles.footerRow}>
        <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>
          {points[0].date.slice(5)}
        </Text>
        <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>
          {points[points.length - 1].date.slice(5)}
        </Text>
      </View>
    </View>
  );
}

function SvgChart({
  points,
  temps,
  minTemp,
  range,
  colors,
}: {
  points: CycleEntry[];
  temps: number[];
  minTemp: number;
  range: number;
  colors: ReturnType<typeof useColors>;
}) {
  // Use a fixed viewBox width; RN SVG will scale to the container via width="100%".
  const viewW = 320;
  const viewH = CHART_HEIGHT;
  const plotW = viewW - H_PADDING * 2;
  const plotH = viewH - V_PADDING * 2;

  const coords = points.map((p, i) => {
    const x = H_PADDING + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const t = (temps[i] - minTemp) / range;
    const y = V_PADDING + (1 - t) * plotH;
    return { x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const midY = V_PADDING + plotH / 2;

  return (
    <Svg width="100%" height={viewH} viewBox={`0 0 ${viewW} ${viewH}`}>
      <Line
        x1={H_PADDING}
        y1={midY}
        x2={viewW - H_PADDING}
        y2={midY}
        stroke={colors.border}
        strokeWidth={1}
        strokeDasharray="4,4"
      />
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={colors.purple}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((c, i) => (
        <Circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 4 : 2.5}
          fill={i === coords.length - 1 ? colors.purple : colors.card}
          stroke={colors.purple}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    width: "100%",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 2,
  },
  footerLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
