import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
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
import { useApp, getTodayString } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

const MOODS = [
  { emoji: "😞", label: "Very low", value: 1 },
  { emoji: "😟", label: "Low", value: 2 },
  { emoji: "😐", label: "Okay", value: 3 },
  { emoji: "🙂", label: "Good", value: 4 },
  { emoji: "😊", label: "Great", value: 5 },
];

const SLEEP_OPTIONS = [
  { label: "< 3h", hours: 2 },
  { label: "3–4h", hours: 3.5 },
  { label: "4–5h", hours: 4.5 },
  { label: "5–6h", hours: 5.5 },
  { label: "6–7h", hours: 6.5 },
  { label: "7–8h", hours: 7.5 },
  { label: "8h+", hours: 9 },
];

function RatingRow({
  label,
  value,
  onChange,
  low,
  high,
  accentColor,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  low: string;
  high: string;
  accentColor?: string;
}) {
  const colors = useColors();
  const color = accentColor ?? colors.primary;
  return (
    <View
      style={ratingStyles.container}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: 5, now: value || undefined }}
      accessibilityState={{ selected: value > 0 }}
    >
      <Text style={[ratingStyles.label, { color: colors.text }]}>{label}</Text>
      <View style={ratingStyles.row}>
        {[1, 2, 3, 4, 5].map((v) => {
          const active = value >= v;
          return (
            <Pressable
              key={v}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(v);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${v} of 5${v === 1 ? `, ${low}` : v === 5 ? `, ${high}` : ""}`}
              accessibilityState={{ selected: value === v }}
              style={[
                ratingStyles.dot,
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
      <View style={ratingStyles.labels}>
        <Text style={[ratingStyles.endLabel, { color: colors.mutedForeground }]}>{low}</Text>
        <Text style={[ratingStyles.endLabel, { color: colors.mutedForeground }]}>{high}</Text>
      </View>
    </View>
  );
}

const ratingStyles = StyleSheet.create({
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
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  endLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

export default function CheckInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addCheckIn, hasCheckedInToday, todayCheckIn } = useApp();

  const [step, setStep] = useState<"mood" | "wellbeing" | "notes" | "done">(
    hasCheckedInToday ? "done" : "mood"
  );
  const [mood, setMood] = useState(0);
  const [sleepIdx, setSleepIdx] = useState(-1);
  const [anxiety, setAnxiety] = useState(0);
  const [appetite, setAppetite] = useState(0);
  const [bonding, setBonding] = useState(0);
  const [support, setSupport] = useState(0);
  const [notes, setNotes] = useState("");
  const [justCompleted, setJustCompleted] = useState(false);
  const [moodError, setMoodError] = useState(false);
  const [wellbeingError, setWellbeingError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Re-sync the step whenever the app returns to the foreground so a
  // midnight rollover (day change while the screen stayed mounted) is
  // reflected instead of showing a stale "done" state for the wrong day.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        if (!hasCheckedInToday) {
          setJustCompleted(false);
          setStep((prev) => (prev === "done" ? "mood" : prev));
        }
      }
    });
    return () => subscription.remove();
  }, [hasCheckedInToday]);

  const transition = (next: typeof step) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 180);
  };

  const handleMoodNext = async () => {
    if (mood === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setMoodError(true);
      return;
    }
    setMoodError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    transition("wellbeing");
  };

  const handleWellbeingNext = async () => {
    if (sleepIdx < 0 || anxiety === 0 || appetite === 0 || bonding === 0 || support === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setWellbeingError(true);
      return;
    }
    setWellbeingError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    transition("notes");
  };

  const handleSubmit = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const sleepHours = SLEEP_OPTIONS[sleepIdx]?.hours ?? 6;
    await addCheckIn({
      date: getTodayString(),
      mood,
      sleep: sleepHours,
      anxiety,
      appetite,
      bonding,
      support,
      notes,
    });
    setJustCompleted(true);
    transition("done");
  };

  const score = todayCheckIn?.riskScore ?? 0;
  const level = score <= 35 ? "low" : score <= 65 ? "moderate" : "high";
  const levelColor =
    level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;

  if (step === "done") {
    return (
      <View
        style={[
          styles.doneContainer,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 40,
          },
        ]}
      >
        <View style={[styles.doneCircle, { backgroundColor: colors.softGreen }]}>
          <Text style={{ fontSize: 52 }}>✅</Text>
        </View>
        <Text style={[styles.doneTitle, { color: colors.foreground }]}>
          Check-in complete
        </Text>
        <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
          {justCompleted
            ? "Your check-in is saved. You showed up for yourself today — that matters."
            : "You've already logged today. Come back tomorrow."}
        </Text>
        {todayCheckIn && (
          <View style={[styles.scoreBox, { backgroundColor: levelColor + "18", borderColor: levelColor + "30", borderWidth: 1.5 }]}>
            <Text style={[styles.scoreBig, { color: levelColor }]}>{todayCheckIn.riskScore}</Text>
            <Text style={[styles.scoreSmall, { color: colors.mutedForeground }]}>
              Risk Score · {level === "low" ? "Low Risk" : level === "moderate" ? "Moderate" : "High Risk"}
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => router.push("/cycle/log")}
          style={({ pressed }) => [
            styles.nextStepCard,
            { backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <View style={[styles.nextStepIcon, { backgroundColor: colors.blush }]}>
            <Feather name="droplet" size={16} color={colors.purple} />
          </View>
          <Text style={[styles.nextStepText, { color: colors.text }]}>
            Complete the picture — log today's cycle & biomarkers
          </Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)")}
          style={[styles.doneBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.doneBtnText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 84,
          },
        ]}
      >
        <View style={styles.topBar}>
          {step !== "mood" ? (
            <Pressable
              onPress={() =>
                transition(
                  step === "notes" ? "wellbeing" : step === "wellbeing" ? "mood" : "mood"
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <View
            style={[styles.stepDots, { gap: 6 }]}
            accessibilityRole="text"
            accessibilityLabel={`Step ${
              step === "mood" ? 1 : step === "wellbeing" ? 2 : 3
            } of 3`}
          >
            {(["mood", "wellbeing", "notes"] as const).map((s) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: s === step ? colors.primary : colors.lavender,
                    width: s === step ? 20 : 8,
                  },
                ]}
              />
            ))}
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, gap: 24 }}>
            {step === "mood" && (
              <>
                <View>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                    How are you feeling today?
                  </Text>
                  <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                    Take a gentle moment to reflect on your day.
                  </Text>
                </View>

                <View
                  style={styles.moodGrid}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Mood"
                >
                  {MOODS.map((m) => {
                    const active = mood === m.value;
                    return (
                      <Pressable
                        key={m.value}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setMood(m.value);
                          setMoodError(false);
                        }}
                        accessibilityRole="radio"
                        accessibilityLabel={`Mood: ${m.label}, ${m.value} of 5`}
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.moodBtn,
                          {
                            backgroundColor: active ? colors.primary + "18" : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                            borderWidth: active ? 2 : 1,
                          },
                        ]}
                      >
                        <Text style={styles.moodEmoji}>{m.emoji}</Text>
                        <Text
                          style={[
                            styles.moodLabel,
                            { color: active ? colors.primary : colors.mutedForeground },
                          ]}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {mood > 0 && (
                  <View
                    style={[
                      styles.moodFeedback,
                      { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.moodFeedbackText, { color: colors.mutedForeground }]}>
                      {mood <= 2
                        ? "It's okay to have hard days. You're not alone."
                        : mood === 3
                        ? "Every day is different. You're doing your best."
                        : "Wonderful — carry that energy forward."}
                    </Text>
                  </View>
                )}

                {moodError && mood === 0 && (
                  <Text
                    style={[styles.validationText, { color: colors.riskHigh }]}
                    accessibilityRole="alert"
                  >
                    Please select a mood to continue.
                  </Text>
                )}
              </>
            )}

            {step === "wellbeing" && (
              <>
                <View>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                    Your wellbeing today
                  </Text>
                  <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                    These signals help track your recovery and flag early changes.
                  </Text>
                </View>

                <View>
                  <Text style={[styles.subSection, { color: colors.text }]}>Sleep last night</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View
                      style={{ flexDirection: "row", gap: 8 }}
                      accessibilityRole="radiogroup"
                      accessibilityLabel="Sleep last night"
                    >
                      {SLEEP_OPTIONS.map((opt, i) => {
                        const active = sleepIdx === i;
                        return (
                          <Pressable
                            key={i}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setSleepIdx(i);
                              setWellbeingError(false);
                            }}
                            accessibilityRole="radio"
                            accessibilityLabel={`Sleep last night: ${opt.label}`}
                            accessibilityState={{ selected: active }}
                            style={[
                              styles.sleepChip,
                              {
                                backgroundColor: active ? colors.primary : colors.card,
                                borderColor: active ? colors.primary : colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.sleepChipText,
                                { color: active ? "#fff" : colors.text },
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.ratingsList}>
                  <RatingRow
                    label="Anxiety level"
                    value={anxiety}
                    onChange={(v) => {
                      setAnxiety(v);
                      setWellbeingError(false);
                    }}
                    low="None"
                    high="Severe"
                    accentColor={anxiety >= 4 ? colors.riskHigh : anxiety === 3 ? colors.riskModerate : colors.primary}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <RatingRow
                    label="Appetite"
                    value={appetite}
                    onChange={(v) => {
                      setAppetite(v);
                      setWellbeingError(false);
                    }}
                    low="None"
                    high="Normal"
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <RatingRow
                    label="Bond with baby"
                    value={bonding}
                    onChange={(v) => {
                      setBonding(v);
                      setWellbeingError(false);
                    }}
                    low="Distant"
                    high="Connected"
                    accentColor={colors.teal}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <RatingRow
                    label="Feeling supported"
                    value={support}
                    onChange={(v) => {
                      setSupport(v);
                      setWellbeingError(false);
                    }}
                    low="Alone"
                    high="Very supported"
                    accentColor={colors.purple}
                  />
                </View>

                {wellbeingError && (
                  <Text
                    style={[styles.validationText, { color: colors.riskHigh }]}
                    accessibilityRole="alert"
                  >
                    Please rate all fields above to continue.
                  </Text>
                )}
              </>
            )}

            {step === "notes" && (
              <>
                <View>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                    Anything to add?
                  </Text>
                  <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                    Optional — write anything you want to remember about today. Your reflections are private and secure.
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.notesInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="What's on your mind today?"
                  placeholderTextColor={colors.mutedForeground}
                  textAlignVertical="top"
                />
              </>
            )}
          </Animated.View>
        </ScrollView>

        <Pressable
          onPress={
            step === "mood"
              ? handleMoodNext
              : step === "wellbeing"
              ? handleWellbeingNext
              : handleSubmit
          }
          accessibilityRole="button"
          accessibilityLabel={step === "notes" ? "Complete Check-In" : "Continue"}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.nextBtnText}>
            {step === "notes" ? "Complete Check-In ✓" : "Continue →"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22, gap: 16 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  stepDots: { flexDirection: "row", alignItems: "center" },
  stepDot: { height: 8, borderRadius: 4 },
  scrollContent: { flexGrow: 1, paddingTop: 8, paddingBottom: 16 },
  stepTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    lineHeight: 32,
  },
  stepSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  moodGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  moodBtn: {
    flex: 1,
    minWidth: "18%",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
  },
  moodEmoji: { fontSize: 30 },
  moodLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  moodFeedback: {
    borderRadius: 14,
    padding: 14,
  },
  moodFeedbackText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    textAlign: "center",
  },
  validationText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  subSection: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sleepChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  sleepChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ratingsList: { gap: 16 },
  divider: { height: 1 },
  notesInput: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 150,
    lineHeight: 22,
  },
  nextBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    marginHorizontal: 12,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  doneCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  doneTitle: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
  doneSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  scoreBox: {
    alignItems: "center",
    paddingHorizontal: 36,
    paddingVertical: 20,
    borderRadius: 20,
    gap: 4,
  },
  scoreBig: { fontSize: 52, fontFamily: "Inter_700Bold" },
  scoreSmall: { fontSize: 13, fontFamily: "Inter_500Medium" },
  doneBtn: {
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  doneBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nextStepCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  nextStepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  nextStepText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
});
