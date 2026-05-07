import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Step = 0 | 1 | 2;

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveProfile } = useApp();

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [babyName, setBabyName] = useState("");
  const [birthDateInput, setBirthDateInput] = useState("");
  const [error, setError] = useState("");

  const formatDateInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + "/" + formatted.slice(5);
    return formatted;
  };

  const parseDate = (input: string): string | null => {
    const parts = input.split("/");
    if (parts.length !== 3) return null;
    const [m, d, y] = parts;
    if (!m || !d || !y || y.length !== 4) return null;
    const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (isNaN(date.getTime())) return null;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  const handleNext = async () => {
    setError("");
    if (step === 0) {
      if (!name.trim()) return setError("Please enter your name");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(1);
    } else if (step === 1) {
      if (!babyName.trim()) return setError("Please enter your baby's name");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(2);
    } else {
      const parsed = parseDate(birthDateInput);
      if (!parsed) return setError("Please enter a valid date (MM/DD/YYYY)");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveProfile({
        name: name.trim(),
        babyName: babyName.trim(),
        birthDate: parsed,
        setupComplete: true,
      });
      router.replace("/(tabs)");
    }
  };

  const steps = [
    {
      title: "Welcome to Bloom",
      subtitle: "Your daily companion for postpartum wellness and peace of mind.",
      label: "What's your name?",
      placeholder: "Your first name",
      value: name,
      onChange: setName,
      keyboardType: "default" as const,
    },
    {
      title: "Hello, mama",
      subtitle: "We'd love to celebrate your little one with you.",
      label: "What's your baby's name?",
      placeholder: "Baby's first name",
      value: babyName,
      onChange: setBabyName,
      keyboardType: "default" as const,
    },
    {
      title: `Meet ${babyName || "your baby"}`,
      subtitle: "This helps us understand where you are in your postpartum journey.",
      label: "When was your baby born?",
      placeholder: "MM/DD/YYYY",
      value: birthDateInput,
      onChange: (v: string) => setBirthDateInput(formatDateInput(v)),
      keyboardType: "numbers-and-punctuation" as const,
    },
  ];

  const current = steps[step];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= step ? colors.primary : colors.lavender,
                  width: i === step ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.content}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.blush },
            ]}
          >
            <Text style={styles.iconEmoji}>🌸</Text>
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {current.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {current.subtitle}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{current.label}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: error ? colors.destructive : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder={current.placeholder}
              placeholderTextColor={colors.mutedForeground}
              value={current.value}
              onChangeText={current.onChange}
              keyboardType={current.keyboardType}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />
            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
            {step < 2 ? "Continue" : "Start my journey"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 36,
    maxWidth: 280,
  },
  fieldGroup: {
    width: "100%",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  error: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  btn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
