import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export type EmptyStateProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Shared centered empty-state block: icon, title, message, and an optional
 * CTA button. Styled to match the empty-state pattern already used in
 * app/records/index.tsx (icon -> bold title -> muted supporting copy ->
 * primary pill button).
 */
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 36,
    paddingHorizontal: 16,
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  message: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
