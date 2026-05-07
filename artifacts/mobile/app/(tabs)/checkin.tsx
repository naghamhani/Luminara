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
import { useApp, getTodayString } from "@/context/AppContext";
import { MoodScale, ScaleLabels } from "@/components/MoodScale";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

const STEPS = [
  {
    key: "mood" as const,
    title: "How is your mood?",
    subtitle: "Rate how you're feeling emotionally right now",
    labels: ["Very low", "Low", "Neutral", "Good", "Great"],
  },
  {
    key: "sleep" as const,
    title: "How did you sleep?",
    subtitle: "Rate the quality and amount of rest you got",
    labels: ["Terrible", "Poor", "Fair", "Good", "Great"],
    isSleep: true,
  },
  {
    key: "anxiety" as const,
    title: "Anxiety level",
    subtitle: "How much anxiety or worry are you experiencing?",
    labels: ["None", "Mild", "Moderate", "High", "Severe"],
    isAnxiety: true,
  },
  {
    key: "appetite" as const,
    title: "How's your appetite?",
    subtitle: "Have you been able to eat regular meals today?",
    labels: ["No appetite", "Poor", "Fair", "Good", "Great"],
  },
  {
    key: "bonding" as const,
    title: "Connection with baby",
    subtitle: "How connected do you feel to your baby today?",
    labels: ["Disconnected", "Low", "Some", "Good", "Very close"],
  },
  {
    key: "support" as const,
    title: "Feeling supported",
    subtitle: "Have you felt supported by people around you?",
    labels: ["Not at all", "Barely", "Somewhat", "Mostly", "Very much"],
  },
];

export default function CheckInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addCheckIn, hasCheckedInToday, todayCheckIn } = useApp();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    mood: 0,
    sleep: 0,
    anxiety: 0,
    appetite: 0,
    bonding: 0,
    support: 0,
  });
  const [sleepHours, setSleepHours] = useState("6");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const progress = (step / (STEPS.length + 1)) * 100;
  const currentStep = STEPS[step];

  const animateNext = (next: number) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      const key = currentStep.key;
      if (values[key] === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateNext(step + 1);
    } else if (step === STEPS.length - 1) {
      const key = currentStep.key;
      if (values[key] === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateNext(step + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const hrs = parseFloat(sleepHours) || 6;
      await addCheckIn({
        date: getTodayString(),
        mood: values.mood,
        sleep: hrs,
        anxiety: values.anxiety,
        appetite: values.appetite,
        bonding: values.bonding,
        support: values.support,
        notes,
      });
      setDone(true);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateNext(step - 1);
    }
  };

  const setValue = (key: keyof typeof values, v: number) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  if (done || (hasCheckedInToday && !done)) {
    const score = todayCheckIn?.riskScore ?? 0;
    const level =
      score <= 35 ? "low" : score <= 65 ? "moderate" : "high";
    const levelColor =
      level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;

    return (
      <View
        style={[
          styles.doneContainer,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40),
          },
        ]}
      >
        <View style={[styles.doneIcon, { backgroundColor: colors.blush }]}>
          <Text style={{ fontSize: 48 }}>🌸</Text>
        </View>
        <Text style={[styles.doneTitle, { color: colors.foreground }]}>
          {done ? "Check-in complete" : "Already checked in"}
        </Text>
        <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
          {done ? "You showed up for yourself today. That matters." : "You've already logged today. Come back tomorrow."}
        </Text>
        {todayCheckIn && (
          <View style={[styles.scoreBox, { backgroundColor: levelColor + "20" }]}>
            <Text style={[styles.scoreBig, { color: levelColor }]}>
              {todayCheckIn.riskScore}
            </Text>
            <Text style={[styles.scoreLabel, { color: levelColor }]}>
              {level === "low" ? "Low Risk" : level === "moderate" ? "Moderate Risk" : "High Risk"}
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => router.push("/(tabs)")}
          style={[styles.doneBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.doneBtnText, { color: "#fff" }]}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const isNotesStep = step === STEPS.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16),
          },
        ]}
      >
        <View style={styles.topBar}>
          {step > 0 ? (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <Text style={[styles.stepCounter, { color: colors.mutedForeground }]}>
            {isNotesStep ? "Almost done" : `${step + 1} of ${STEPS.length}`}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={[styles.progressBarBg, { backgroundColor: colors.lavender }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progress}%` as any, backgroundColor: colors.primary },
            ]}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
            {!isNotesStep && currentStep ? (
              <>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {currentStep.title}
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  {currentStep.subtitle}
                </Text>

                {currentStep.isSleep ? (
                  <View style={styles.sleepSection}>
                    <MoodScale
                      value={values.sleep}
                      onChange={(v) => setValue("sleep", v)}
                      labels={currentStep.labels}
                      activeColor={colors.primary}
                    />
                    <ScaleLabels labels={currentStep.labels} />
                    <View style={styles.hoursRow}>
                      <Text style={[styles.hoursLabel, { color: colors.mutedForeground }]}>
                        Hours slept
                      </Text>
                      <TextInput
                        style={[
                          styles.hoursInput,
                          {
                            backgroundColor: colors.secondary,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        value={sleepHours}
                        onChangeText={setSleepHours}
                        keyboardType="decimal-pad"
                        placeholder="6"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <MoodScale
                      value={values[currentStep.key]}
                      onChange={(v) => setValue(currentStep.key, v)}
                      labels={currentStep.labels}
                      activeColor={
                        currentStep.isAnxiety
                          ? values.anxiety >= 4
                            ? colors.riskHigh
                            : values.anxiety === 3
                            ? colors.riskModerate
                            : colors.primary
                          : colors.primary
                      }
                    />
                    <ScaleLabels labels={currentStep.labels} />
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Any thoughts to add?
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  Optional — write anything you want to remember about today
                </Text>
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
                  numberOfLines={5}
                  placeholder="How was your day? Anything weighing on you?"
                  placeholderTextColor={colors.mutedForeground}
                  textAlignVertical="top"
                />
              </>
            )}
          </Animated.View>
        </ScrollView>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor:
                !isNotesStep && currentStep && values[currentStep.key as keyof typeof values] === 0
                  ? colors.muted
                  : colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.nextBtnText,
              {
                color:
                  !isNotesStep && currentStep && values[currentStep.key as keyof typeof values] === 0
                    ? colors.mutedForeground
                    : "#fff",
              },
            ]}
          >
            {isNotesStep ? "Complete Check-In" : "Next"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCounter: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  content: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 28,
  },
  sleepSection: {
    gap: 16,
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  hoursLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  hoursInput: {
    width: 70,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  notesInput: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 130,
    lineHeight: 22,
  },
  nextBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  nextBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  doneIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  doneTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  doneSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  scoreBox: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 20,
    gap: 4,
  },
  scoreBig: {
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    lineHeight: 58,
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  doneBtn: {
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
