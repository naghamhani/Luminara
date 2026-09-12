import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View, ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Numeric PIN field with a show/hide (eye) toggle so the PIN can be
 * double-checked while typing. Digits only, max 6, sanitized internally.
 */
export function PinInput({
  value,
  onChangeText,
  placeholder,
  editable = true,
  autoFocus = false,
  centered = false,
  containerStyle,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (pin: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  /** Large centered variant used on the PIN entry gate. */
  centered?: boolean;
  containerStyle?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  return (
    <View
      style={[
        styles.wrap,
        centered ? styles.wrapCentered : null,
        { backgroundColor: colors.secondary, borderColor: colors.border },
        containerStyle,
      ]}
    >
      <TextInput
        style={[
          styles.input,
          centered ? styles.inputCentered : null,
          { color: colors.text },
        ]}
        value={value}
        onChangeText={(t) => {
          const next = t.replace(/[^0-9]/g, "").slice(0, 6);
          if (next.length > value.length && Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onChangeText(next);
        }}
        keyboardType="number-pad"
        secureTextEntry={!visible}
        maxLength={6}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        editable={editable}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel ?? placeholder ?? "PIN"}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        style={styles.eyeBtn}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide PIN" : "Show PIN"}
      >
        <Feather
          name={visible ? "eye-off" : "eye"}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  wrapCentered: {
    height: 56,
    width: 200,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  inputCentered: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 8,
    paddingStart: 40, // balance the eye button so digits stay visually centered
  },
  eyeBtn: {
    width: 40,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
