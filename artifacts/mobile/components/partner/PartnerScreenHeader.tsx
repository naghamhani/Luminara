import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { goBack } from "@/utils/navigation";

interface PartnerScreenHeaderProps {
  title: string;
  onBack?: () => void;
  /** Where to land if there's no navigation history to pop back to. */
  fallbackHref?: string;
  right?: React.ReactNode;
}

/** Shared in-screen header for the partner portal's stack screens. */
export function PartnerScreenHeader({ title, onBack, fallbackHref = "/partner", right }: PartnerScreenHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={onBack ?? (() => goBack(fallbackHref))}
        style={styles.backBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Feather name="chevron-left" size={26} color={colors.text} />
      </Pressable>
      <Text
        style={[styles.title, { color: colors.foreground }]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={styles.right}>{right ?? <View style={{ width: 36 }} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  right: {
    minWidth: 36,
    alignItems: "flex-end",
  },
});
