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
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, getTodayString } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/i18n";
import { Feather } from "@expo/vector-icons";

function useMoods() {
  const { t } = useTranslation();
  return [
    { emoji: "😞", label: t("checkin.moodVeryLow"), value: 1 },
    { emoji: "😟", label: t("checkin.moodLow"), value: 2 },
    { emoji: "😐", label: t("checkin.moodOkay"), value: 3 },
    { emoji: "🙂", label: t("checkin.moodGood"), value: 4 },
    { emoji: "😊", label: t("checkin.moodGreat"), value: 5 },
  ];
}

function useSleepOptions() {
  const { t } = useTranslation();
  return [
    { label: t("checkin.sleepUnder3"), hours: 2 },
    { label: t("checkin.sleep3to4"), hours: 3.5 },
    { label: t("checkin.sleep4to5"), hours: 4.5 },
    { label: t("checkin.sleep5to6"), hours: 5.5 },
    { label: t("checkin.sleep6to7"), hours: 6.5 },
    { label: t("checkin.sleep7to8"), hours: 7.5 },
    { label: t("checkin.sleep8plus"), hours: 9 },
  ];
}

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

function MoodOptionButton({
  emoji,
  label,
  value,
  active,
  onPress,
}: {
  emoji: string;
  label: string;
  value: number;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View style={[{ flex: 1, minWidth: "18%" }, scaleStyle]}>
      <Pressable
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
        accessibilityRole="radio"
        accessibilityLabel={`${label}, ${value} / 5`}
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
        <Text style={styles.moodEmoji}>{emoji}</Text>
        <Text
          style={[
            styles.moodLabel,
            { color: active ? colors.primary : colors.mutedForeground },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Reanimated.View>
  );
}

export default function CheckInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addCheckIn, hasCheckedInToday, todayCheckIn } = useApp();
  const { t } = useTranslation();
  const MOODS = useMoods();
  const SLEEP_OPTIONS = useSleepOptions();

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

  // One restrained warning-level pulse when a check-in first surfaces as
  // High Risk on the completion screen — never repeated on re-renders at
  // the same level, per the app's calm, non-alarming design philosophy.
  useEffect(() => {
    if (step === "done" && justCompleted && level === "high" && Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [step, justCompleted, level]);

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
          {t("checkin.doneTitle")}
        </Text>
        <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
          {justCompleted ? t("checkin.doneSubNew") : t("checkin.doneSubAlready")}
        </Text>
        {todayCheckIn && (
          <View style={[styles.scoreBox, { backgroundColor: levelColor + "18", borderColor: levelColor + "30", borderWidth: 1.5 }]}>
            <Text style={[styles.scoreBig, { color: levelColor }]}>{todayCheckIn.riskScore}</Text>
            <Text style={[styles.scoreSmall, { color: colors.mutedForeground }]}>
              {t("checkin.riskScoreLabel").replace(
                "{level}",
                level === "low" ? t("checkin.riskLow") : level === "moderate" ? t("checkin.riskModerate") : t("checkin.riskHigh")
              )}
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
            {t("checkin.nextStepCycle")}
          </Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)")}
          style={[styles.doneBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.doneBtnText}>{t("checkin.backToHome")}</Text>
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
              accessibilityLabel={t("common.back")}
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
            accessibilityLabel={t("checkin.stepOf")
              .replace("{current}", String(step === "mood" ? 1 : step === "wellbeing" ? 2 : 3))
              .replace("{total}", "3")}
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
                    {t("checkin.moodTitle")}
                  </Text>
                  <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                    {t("checkin.moodSubtitle")}
                  </Text>
                </View>

                <View
                  style={styles.moodGrid}
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t("checkin.moodTitle")}
                >
                  {MOODS.map((m) => (
                    <MoodOptionButton
                      key={m.value}
                      emoji={m.emoji}
                      label={m.label}
                      value={m.value}
                      active={mood === m.value}
                      onPress={() => {
                        setMood(m.value);
                        setMoodError(false);
                      }}
                    />
                  ))}
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
                        ? t("checkin.moodFeedbackLow")
                        : mood === 3
                        ? t("checkin.moodFeedbackMid")
                        : t("checkin.moodFeedbackHigh")}
                    </Text>
                  </View>
                )}

                {moodError && mood === 0 && (
                  <Text
                    style={[styles.validationText, { color: colors.riskHigh }]}
                    accessibilityRole="alert"
                  >
                    {t("checkin.moodValidation")}
                  </Text>
                )}
              </>
            )}

            {step === "wellbeing" && (
              <>
                <View>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                    {t("checkin.wellbeingTitle")}
                  </Text>
                  <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                    {t("checkin.wellbeingSubtitle")}
                  </Text>
                </View>

                <View>
                  <Text style={[styles.subSection, { color: colors.text }]}>{t("checkin.sleepLastNight")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View
                      style={{ flexDirection: "row", gap: 8 }}
                      accessibilityRole="radiogroup"
                      accessibilityLabel={t("checkin.sleepLastNight")}
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
                            accessibilityLabel={`${t("checkin.sleepLastNight")}: ${opt.label}`}
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
                    label={t("checkin.anxietyLabel")}
                    value={anxiety}
                    onChange={(v) => {
                      setAnxiety(v);
                      setWellbeingError(false);
                    }}
                    low={t("checkin.anxietyLow")}
                    high={t("checkin.anxietyHigh")}
                    accentColor={anxiety >= 4 ? colors.riskHigh : anxiety === 3 ? colors.riskModerate : colors.primary}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <RatingRow
                    label={t("checkin.appetiteLabel")}
                    value={appetite}
                    onChange={(v) => {
                      setAppetite(v);
                      setWellbeingError(false);
                    }}
                    low={t("checkin.appetiteLow")}
                    high={t("checkin.appetiteHigh")}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <RatingRow
                    label={t("checkin.bondingLabel")}
                    value={bonding}
                    onChange={(v) => {
                      setBonding(v);
                      setWellbeingError(false);
                    }}
                    low={t("checkin.bondingLow")}
                    high={t("checkin.bondingHigh")}
                    accentColor={colors.teal}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <RatingRow
                    label={t("checkin.supportLabel")}
                    value={support}
                    onChange={(v) => {
                      setSupport(v);
                      setWellbeingError(false);
                    }}
                    low={t("checkin.supportLow")}
                    high={t("checkin.supportHigh")}
                    accentColor={colors.purple}
                  />
                </View>

                {wellbeingError && (
                  <Text
                    style={[styles.validationText, { color: colors.riskHigh }]}
                    accessibilityRole="alert"
                  >
                    {t("checkin.wellbeingValidation")}
                  </Text>
                )}
              </>
            )}

            {step === "notes" && (
              <>
                <View>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                    {t("checkin.notesTitle")}
                  </Text>
                  <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                    {t("checkin.notesSubtitle")}
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
                  placeholder={t("checkin.notesPlaceholder")}
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
          accessibilityLabel={step === "notes" ? t("checkin.completeCheckIn") : t("common.continue")}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.nextBtnText}>
            {step === "notes" ? t("checkin.completeCheckIn") : t("checkin.continueArrow")}
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
