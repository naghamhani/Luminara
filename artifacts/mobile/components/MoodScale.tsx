import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface MoodScaleProps {
  value: number;
  onChange: (v: number) => void;
  labels?: string[];
  activeColor?: string;
}

const defaultLabels = ["Very bad", "Bad", "Okay", "Good", "Great"];

function MoodOption({
  v,
  active,
  color,
  onPress,
  label,
}: {
  v: number;
  active: boolean;
  color: string;
  onPress: () => void;
  label: string;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={scaleStyle}>
      <TouchableOpacity
        onPress={() => {
          scale.value = withSequence(
            withSpring(0.92, { duration: 120 }),
            withSpring(1, { duration: 160 })
          );
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress();
        }}
        style={[
          styles.btn,
          {
            backgroundColor: active ? color : colors.secondary,
            borderColor: active ? color : colors.border,
          },
        ]}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ checked: active }}
        accessibilityLabel={`${label} (${v} of 5)`}
        accessibilityHint="Selects this rating on the mood scale"
      >
        <Text style={[styles.num, { color: active ? "#fff" : colors.text }]}>{v}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

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
      {[1, 2, 3, 4, 5].map((v) => (
        <MoodOption
          key={v}
          v={v}
          active={value === v}
          color={color}
          onPress={() => onChange(v)}
          label={labels[v - 1] ?? String(v)}
        />
      ))}
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
