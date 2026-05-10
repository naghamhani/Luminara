import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
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
import { Feather } from "@expo/vector-icons";

const MOODS = [
  { emoji: "😞", label: "Very low" },
  { emoji: "😟", label: "Struggling" },
  { emoji: "😐", label: "Okay" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😊", label: "Great" },
];

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveProfile } = useApp();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [step, setStep] = useState<Step>(0);
  const [selectedMood, setSelectedMood] = useState(-1);
  const [openingThought, setOpeningThought] = useState("");
  const [name, setName] = useState("");
  const [babyName, setBabyName] = useState("");
  const [birthDateInput, setBirthDateInput] = useState("");
  const [error, setError] = useState("");

  const transition = (next: Step) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 160);
  };

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step === 0) {
      transition(1);
    } else if (step === 1) {
      transition(2);
    } else if (step === 2) {
      transition(3);
    } else if (step === 3) {
      if (!name.trim()) return setError("Please enter your name");
      transition(4);
    } else if (step === 4) {
      if (!babyName.trim()) return setError("Please enter your baby's name");
      transition(5);
    } else if (step === 5) {
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

  const totalSteps = 6;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: step === 2 ? "#0D3B38" : step === 3 ? "#1A1040" : colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 32),
          },
        ]}
      >
        <View style={styles.topRow}>
          {step > 0 ? (
            <Pressable
              onPress={() => transition((step - 1) as Step)}
              style={[
                styles.backBtn,
                {
                  backgroundColor:
                    step === 2 || step === 3
                      ? "rgba(255,255,255,0.15)"
                      : colors.card,
                },
              ]}
            >
              <Feather
                name="arrow-left"
                size={18}
                color={step === 2 || step === 3 ? "#fff" : colors.text}
              />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <View style={[styles.progressBar, { backgroundColor: step === 2 || step === 3 ? "rgba(255,255,255,0.2)" : colors.lavender }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%` as any,
                  backgroundColor: step === 2 || step === 3 ? "#3AAFA9" : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.stepNum, { color: step === 2 || step === 3 ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
            {step + 1}/{totalSteps}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, gap: 24 }}>

            {step === 0 && (
              <View style={styles.splashContent}>
                <View style={[styles.logoCircle, { backgroundColor: colors.secondary }]}>
                  <Text style={{ fontSize: 52 }}>🌸</Text>
                </View>
                <Text style={[styles.brandName, { color: colors.primary }]}>Bloom</Text>
                <Text style={[styles.splashTitle, { color: colors.foreground }]}>
                  A safe space{"\n"}for your mind.
                </Text>
                <Text style={[styles.splashDesc, { color: colors.mutedForeground }]}>
                  We help you navigate the emotional journey of motherhood with care, insight, and expert guidance.
                </Text>
                <View style={styles.featuresGrid}>
                  {[
                    { icon: "📊", label: "Daily Mood\nTracking" },
                    { icon: "🧠", label: "AI Risk\nInsights" },
                    { icon: "🔒", label: "Privacy\nFirst" },
                    { icon: "💬", label: "Expert\nGuidance" },
                  ].map((f, i) => (
                    <View key={i} style={[styles.featureChip, { backgroundColor: colors.card }]}>
                      <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                      <Text style={[styles.featureLabel, { color: colors.text }]}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {step === 1 && (
              <View style={{ gap: 24 }}>
                <View style={[styles.onbHeader, { backgroundColor: colors.blush }]}>
                  <Text style={[styles.onbTitleSmall, { color: colors.primary }]}>
                    Luminara · Step 01
                  </Text>
                  <Text style={[styles.onbTitle, { color: colors.foreground }]}>
                    How are you,{"\n"}radiant mama?
                  </Text>
                  <Text style={[styles.onbSub, { color: colors.mutedForeground }]}>
                    Take a gentle moment to reflect on your day.
                  </Text>
                </View>
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Current vibe</Text>
                  <View style={styles.moodRow}>
                    {MOODS.map((m, i) => {
                      const active = selectedMood === i;
                      return (
                        <Pressable
                          key={i}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedMood(i);
                          }}
                          style={[
                            styles.moodBtn,
                            {
                              backgroundColor: active ? colors.primary : colors.card,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text style={styles.moodEmoji}>{m.emoji}</Text>
                          <Text
                            style={[
                              styles.moodLabel,
                              { color: active ? "#fff" : colors.mutedForeground },
                            ]}
                          >
                            {m.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>
                    What's happening in your mind today?
                  </Text>
                  <TextInput
                    style={[
                      styles.thoughtInput,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={openingThought}
                    onChangeText={setOpeningThought}
                    multiline
                    placeholder="Share what's on your mind... (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    textAlignVertical="top"
                  />
                  <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
                    🔒 Your reflections are private and secure.
                  </Text>
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.darkScreen}>
                <View style={[styles.darkIconCircle, { backgroundColor: "rgba(58,175,169,0.2)" }]}>
                  <Text style={{ fontSize: 60 }}>🧘</Text>
                </View>
                <Text style={styles.darkEyebrow}>UNDERSTAND YOUR RHYTHMS</Text>
                <Text style={styles.darkTitle}>
                  Track your mood,{"\n"}sleep, and energy.
                </Text>
                <Text style={styles.darkDesc}>
                  Daily check-ins take less than a minute and help you stay in tune with your needs — so you can get support before things feel overwhelming.
                </Text>
                <View style={styles.darkBadges}>
                  {["✓ Science-backed", "✓ Clinically validated", "✓ Takes under 1 minute"].map((b) => (
                    <View key={b} style={[styles.darkBadge, { backgroundColor: "rgba(58,175,169,0.2)" }]}>
                      <Text style={[styles.darkBadgeText, { color: "#3AAFA9" }]}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={[styles.darkScreen, { backgroundColor: "transparent" }]}>
                <View style={[styles.darkIconCircle, { backgroundColor: "rgba(124,92,191,0.2)" }]}>
                  <Text style={{ fontSize: 60 }}>🔮</Text>
                </View>
                <Text style={[styles.darkEyebrow, { color: "#9B8DD4" }]}>EARLY RISK INSIGHTS</Text>
                <Text style={styles.darkTitle}>Peace of mind{"\n"}for you.</Text>
                <Text style={styles.darkDesc}>
                  Our algorithm uses your daily data to help identify early signs of postpartum depression, so you can get the support you deserve — before a crisis.
                </Text>
                <View style={styles.darkBadges}>
                  {[
                    { icon: "🏥", label: "100% HIPAA Compliant" },
                    { icon: "🔬", label: "Clinically Validated Research" },
                    { icon: "🔒", label: "Anonymous & Encrypted" },
                  ].map((b) => (
                    <View key={b.label} style={[styles.darkBadge, { backgroundColor: "rgba(124,92,191,0.2)" }]}>
                      <Text>{b.icon}</Text>
                      <Text style={[styles.darkBadgeText, { color: "#9B8DD4" }]}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {step === 3 && null}

            {(step === 3 || step === 4 || step === 5) && step !== 3 && (
              <View style={{ gap: 8 }}>
                {step === 4 && (
                  <>
                    <View style={[styles.stepHeader, { backgroundColor: colors.blush }]}>
                      <Text style={[styles.stepHeaderTitle, { color: colors.foreground }]}>
                        {name ? `Nice to meet you, ${name}!` : "Tell us about yourself"}
                      </Text>
                      <Text style={[styles.stepHeaderSub, { color: colors.mutedForeground }]}>
                        We'd love to know a bit more about you.
                      </Text>
                    </View>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Your baby's name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.border, color: colors.text }]}
                      placeholder="Baby's first name"
                      placeholderTextColor={colors.mutedForeground}
                      value={babyName}
                      onChangeText={setBabyName}
                      autoFocus
                    />
                    {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
                  </>
                )}
                {step === 5 && (
                  <>
                    <View style={[styles.stepHeader, { backgroundColor: colors.blush }]}>
                      <Text style={[styles.stepHeaderTitle, { color: colors.foreground }]}>
                        Welcome, {name}! 🌸
                      </Text>
                      <Text style={[styles.stepHeaderSub, { color: colors.mutedForeground }]}>
                        When was {babyName || "your baby"} born?
                      </Text>
                    </View>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Baby's birth date</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.border, color: colors.text }]}
                      placeholder="MM/DD/YYYY"
                      placeholderTextColor={colors.mutedForeground}
                      value={birthDateInput}
                      onChangeText={(v) => setBirthDateInput(formatDateInput(v))}
                      keyboardType="numbers-and-punctuation"
                      autoFocus
                    />
                    {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
                  </>
                )}
              </View>
            )}

            {step === 3 && (
              <View style={{ gap: 8 }}>
                <View style={[styles.stepHeader, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                  <Text style={[styles.stepHeaderTitle, { color: "#fff" }]}>
                    Let's get started
                  </Text>
                  <Text style={[styles.stepHeaderSub, { color: "rgba(255,255,255,0.6)" }]}>
                    A few details help us personalize your experience.
                  </Text>
                </View>
                <Text style={[styles.fieldLabel, { color: "rgba(255,255,255,0.8)" }]}>Your name</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: "rgba(255,255,255,0.12)",
                    borderColor: error ? "#E85555" : "rgba(255,255,255,0.2)",
                    color: "#fff",
                  }]}
                  placeholder="Your first name"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
                {error ? <Text style={[styles.error, { color: "#FF8A8A" }]}>{error}</Text> : null}
              </View>
            )}

          </Animated.View>
        </ScrollView>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor:
                step === 2
                  ? "#3AAFA9"
                  : step === 3
                  ? "#7C5CBF"
                  : colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.nextBtnText}>
            {step === 0
              ? "Get Started"
              : step === 2
              ? "Next →"
              : step === 3
              ? "Next →"
              : step === 5
              ? "Start My Journey 🌸"
              : "Continue →"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, gap: 16 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  stepNum: { fontSize: 12, fontFamily: "Inter_500Medium", minWidth: 30, textAlign: "right" },
  scrollContent: { flexGrow: 1, paddingTop: 12, paddingBottom: 8 },

  splashContent: { alignItems: "center", gap: 20, paddingTop: 8 },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  splashTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 38,
  },
  splashDesc: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 8,
  },
  featureChip: {
    width: "46%",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  featureLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 17,
  },

  onbHeader: { borderRadius: 20, padding: 20, gap: 4 },
  onbTitleSmall: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginBottom: 4 },
  onbTitle: { fontSize: 26, fontFamily: "Inter_700Bold", lineHeight: 32 },
  onbSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 4 },

  moodRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  moodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 4,
    minWidth: 58,
  },
  moodEmoji: { fontSize: 26 },
  moodLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },

  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  thoughtInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 100,
    lineHeight: 21,
  },
  privacyNote: { fontSize: 11, fontFamily: "Inter_400Regular" },

  darkScreen: { gap: 20, alignItems: "center", paddingTop: 8 },
  darkIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  darkEyebrow: {
    color: "#3AAFA9",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  darkTitle: {
    color: "#fff",
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 36,
  },
  darkDesc: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
  },
  darkBadges: { gap: 8, alignItems: "flex-start", width: "100%" },
  darkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  darkBadgeText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  stepHeader: { borderRadius: 16, padding: 16, gap: 4 },
  stepHeaderTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  stepHeaderSub: { fontSize: 13, fontFamily: "Inter_400Regular" },

  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  error: { fontSize: 12, fontFamily: "Inter_400Regular" },

  nextBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
