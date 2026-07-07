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
import { LuminaraLogo } from "@/components/LuminaraLogo";

const MOODS = [
  { emoji: "😞", label: "Very low" },
  { emoji: "😟", label: "Struggling" },
  { emoji: "😐", label: "Okay" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😊", label: "Great" },
];

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
    const month = Number(m);
    const day = Number(d);
    const year = Number(y);
    // Construct in local time and verify the parts round-trip, so impossible
    // dates like 02/31 are rejected instead of silently rolling into March.
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    if (date.getTime() > Date.now()) return null; // birth date can't be in the future
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
      transition(5);
    } else if (step === 5) {
      transition(6);
    } else if (step === 6) {
      if (!babyName.trim()) return setError("Please enter your baby's name");
      transition(7);
    } else if (step === 7) {
      const parsed = parseDate(birthDateInput);
      if (!parsed) return setError("Please enter a valid date (MM/DD/YYYY) that isn't in the future");
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

  const totalSteps = 8;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 32,
          },
        ]}
      >
        <View style={styles.topRow}>
          {step > 0 ? (
            <Pressable
              onPress={() => {
                setError("");
                transition((step - 1) as Step);
              }}
              style={[styles.backBtn, { backgroundColor: colors.card }]}
            >
              <Feather name="arrow-left" size={18} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <View style={[styles.progressBar, { backgroundColor: colors.lavender }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${progress}%` as any, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <Text style={[styles.stepNum, { color: colors.mutedForeground }]}>
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
                <LuminaraLogo variant="badge" size={124} />
                <Text style={[styles.splashTitle, { color: colors.foreground }]}>
                  A safe space{"\n"}for your mind.
                </Text>
                <Text style={[styles.splashDesc, { color: colors.mutedForeground }]}>
                  We help you navigate the emotional journey of motherhood with care, insight, and expert guidance.
                </Text>
                <View style={styles.featuresGrid}>
                  {[
                    { icon: "📊", label: "Daily Mood\nTracking" },
                    { icon: "🧠", label: "Early Risk\nAwareness" },
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
                    Luminara Health · Step 01
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
                    🔒 This reflection is just for you in this moment — it isn't saved.
                  </Text>
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.promoScreen}>
                <View style={[styles.promoIconCircle, { backgroundColor: colors.softGreen }]}>
                  <Text style={{ fontSize: 56 }}>🧘</Text>
                </View>
                <Text style={[styles.promoEyebrow, { color: colors.teal }]}>UNDERSTAND YOUR RHYTHMS</Text>
                <Text style={[styles.promoTitle, { color: colors.foreground }]}>
                  Track your mood,{"\n"}sleep, and energy.
                </Text>
                <Text style={[styles.promoDesc, { color: colors.mutedForeground }]}>
                  Daily check-ins take less than a minute and help you stay in tune with your needs — so you can get support before things feel overwhelming.
                </Text>
                <View style={styles.promoBadges}>
                  {["✓ Evidence-informed guidance", "✓ Private by design", "✓ Takes under 1 minute"].map((b) => (
                    <View key={b} style={[styles.promoBadge, { backgroundColor: colors.softGreen }]}>
                      <Text style={[styles.promoBadgeText, { color: colors.teal }]}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={{ gap: 8 }}>
                <View style={[styles.stepHeader, { backgroundColor: colors.blush }]}>
                  <Text style={[styles.stepHeaderTitle, { color: colors.foreground }]}>
                    Let's get started
                  </Text>
                  <Text style={[styles.stepHeaderSub, { color: colors.mutedForeground }]}>
                    A few details help us personalize your experience.
                  </Text>
                </View>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Your name</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: colors.card,
                    borderColor: error ? colors.destructive : colors.border,
                    color: colors.text,
                  }]}
                  placeholder="Your first name"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  maxLength={40}
                  autoFocus
                />
                {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
              </View>
            )}

            {step === 4 && (
              <View style={styles.promoScreen}>
                <View style={[styles.promoIconCircle, { backgroundColor: colors.blush }]}>
                  <Text style={{ fontSize: 56 }}>🧭</Text>
                </View>
                <Text style={[styles.promoEyebrow, { color: colors.purple }]}>EARLY RISK INSIGHTS</Text>
                <Text style={[styles.promoTitle, { color: colors.foreground }]}>Peace of mind{"\n"}for you.</Text>
                <Text style={[styles.promoDesc, { color: colors.mutedForeground }]}>
                  Our rule-based check-in heuristic looks at patterns in your daily data to help you notice early signs of postpartum depression, so you can get the support you deserve — before a crisis.
                </Text>
                <View style={styles.promoBadges}>
                  {[
                    { icon: "🔒", label: "Private by design" },
                    { icon: "🧭", label: "Early risk awareness, not a diagnosis" },
                    { icon: "🔐", label: "Anonymous & Encrypted" },
                  ].map((b) => (
                    <View key={b.label} style={[styles.promoBadge, { backgroundColor: colors.blush }]}>
                      <Text>{b.icon}</Text>
                      <Text style={[styles.promoBadgeText, { color: colors.purple }]}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {step === 5 && (
              <View style={styles.promoScreen}>
                <View style={[styles.promoIconCircle, { backgroundColor: colors.softOrange }]}>
                  <Text style={{ fontSize: 56 }}>🌷</Text>
                </View>
                <Text style={[styles.promoEyebrow, { color: colors.warm }]}>YOUR WHOLE PICTURE</Text>
                <Text style={[styles.promoTitle, { color: colors.foreground }]}>
                  More than mood —{"\n"}your whole reproductive health.
                </Text>
                <Text style={[styles.promoDesc, { color: colors.mutedForeground }]}>
                  Luminara goes beyond daily check-ins to help you keep everything in one place.
                </Text>
                <View style={styles.promoBadges}>
                  {[
                    { icon: "🗂️", label: "Medical records & labs in one place" },
                    { icon: "🩸", label: "Cycle & biomarker tracking with predictions" },
                    { icon: "🤝", label: "An optional partner space with consent-first sharing" },
                  ].map((b) => (
                    <View key={b.label} style={[styles.promoBadge, { backgroundColor: colors.softOrange }]}>
                      <Text>{b.icon}</Text>
                      <Text style={[styles.promoBadgeText, { color: "#9A5010" }]}>{b.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.privacyNote, { color: colors.mutedForeground, textAlign: "center" }]}>
                  🔒 Everything stays on your phone. Research sharing is strictly opt-in.
                </Text>
              </View>
            )}

            {(step === 6 || step === 7) && (
              <View style={{ gap: 8 }}>
                {step === 6 && (
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
                      maxLength={40}
                      autoFocus
                    />
                    {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
                  </>
                )}
                {step === 7 && (
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

          </Animated.View>
        </ScrollView>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor:
                step === 2
                  ? colors.teal
                  : step === 4
                  ? colors.purple
                  : colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.nextBtnText}>
            {step === 0
              ? "Begin Your Journey"
              : step === 2
              ? "Next →"
              : step === 4
              ? "Next →"
              : step === 7
              ? "Start with Luminara 🌸"
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

  // Shared layout for the three full-screen "promo" steps (2, 4, 5) — each
  // supplies its own accent color (icon circle / eyebrow / badge) inline so
  // the same soft, light-themed structure reads as one cohesive family
  // instead of a slideshow of unrelated colors.
  promoScreen: { gap: 20, alignItems: "center", paddingTop: 8 },
  promoIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  promoEyebrow: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  promoTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 34,
  },
  promoDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
  },
  promoBadges: { gap: 8, alignItems: "flex-start", width: "100%" },
  promoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  promoBadgeText: { fontSize: 13, fontFamily: "Inter_500Medium" },

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
