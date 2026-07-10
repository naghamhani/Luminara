import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

interface ChipGroupProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (option: string) => void;
  accentColor?: string;
}

/** Multi-select chip group used for stress factors & support activities. */
export function ChipGroup({ label, options, selected, onToggle, accentColor }: ChipGroupProps) {
  const colors = useColors();
  const color = accentColor ?? colors.primary;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggle(opt);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? color + "18" : colors.card,
                  borderColor: active ? color : colors.border,
                  borderWidth: active ? 1.5 : 1,
                },
              ]}
              accessibilityRole="switch"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt}
              accessibilityHint={active ? "Double tap to remove" : "Double tap to select"}
            >
              <Text style={[styles.chipText, { color: active ? color : colors.text }]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
