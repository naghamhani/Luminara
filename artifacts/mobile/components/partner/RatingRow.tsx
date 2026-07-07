import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

interface RatingRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  low: string;
  high: string;
  accentColor?: string;
}

/**
 * Reusable 1-5 rating row for the partner observation form — visually
 * modeled on the RatingRow pattern in app/(tabs)/checkin.tsx and the dot
 * scale used across the app's daily check-in.
 */
export function RatingRow({ label, value, onChange, low, high, accentColor }: RatingRowProps) {
  const colors = useColors();
  const color = accentColor ?? colors.primary;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((v) => {
          const active = value >= v;
          return (
            <Pressable
              key={v}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(v);
              }}
              hitSlop={4}
              style={[
                styles.dot,
                {
                  backgroundColor: active ? color : colors.lavender,
                  width: active && value === v ? 30 : 22,
                  height: active && value === v ? 30 : 22,
                  borderRadius: active && value === v ? 15 : 11,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        <Text style={[styles.endLabel, { color: colors.mutedForeground }]}>{low}</Text>
        <Text style={[styles.endLabel, { color: colors.mutedForeground }]}>{high}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  dot: {
    alignItems: "center",
    justifyContent: "center",
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  endLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
