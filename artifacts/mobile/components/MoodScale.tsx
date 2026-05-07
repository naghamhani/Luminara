import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface MoodScaleProps {
  value: number;
  onChange: (v: number) => void;
  labels?: string[];
  activeColor?: string;
}

const defaultLabels = ["Very bad", "Bad", "Okay", "Good", "Great"];

export function MoodScale({
  value,
  onChange,
  labels = defaultLabels,
  activeColor,
}: MoodScaleProps) {
  const colors = useColors();
  const color = activeColor ?? colors.primary;

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((v) => {
        const active = value === v;
        return (
          <TouchableOpacity
            key={v}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(v);
            }}
            style={[
              styles.btn,
              {
                backgroundColor: active ? color : colors.secondary,
                borderColor: active ? color : colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.num, { color: active ? "#fff" : colors.text }]}>
              {v}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ScaleLabels({ labels = defaultLabels }: { labels?: string[] }) {
  const colors = useColors();
  return (
    <View style={styles.labelsRow}>
      <Text style={[styles.labelText, { color: colors.mutedForeground }]}>
        {labels[0]}
      </Text>
      <Text style={[styles.labelText, { color: colors.mutedForeground }]}>
        {labels[4]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  num: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 6,
  },
  labelText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
