import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChipGroup } from "@/components/partner/ChipGroup";
import { PartnerScreenHeader } from "@/components/partner/PartnerScreenHeader";
import { RatingRow } from "@/components/partner/RatingRow";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import {
  PARTNER_STRESS_FACTORS,
  PARTNER_SUPPORT_ACTIVITIES,
  PartnerObservationInputSchema,
  toDateString,
} from "@/types/health";
import { goBack } from "@/utils/navigation";

function formatDateLabel(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function addDaysLocal(date: string, n: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

export default function PartnerLogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { partnerSettings, addPartnerObservation } = useHealth();

  const today = toDateString(new Date());
  const [date, setDate] = useState(today);
  const [mood, setMood] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [sleepQuality, setSleepQuality] = useState(0);
  const [overallWellbeing, setOverallWellbeing] = useState(0);
  const [stressFactors, setStressFactors] = useState<string[]>([]);
  const [supportProvided, setSupportProvided] = useState<string[]>([]);
  const [concerns, setConcerns] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [sharedWithUser, setSharedWithUser] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleStressFactor = (opt: string) =>
    setStressFactors((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  const toggleSupport = (opt: string) =>
    setSupportProvided((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));

  const handleSave = async () => {
    const input = {
      date,
      observerName: partnerSettings.partnerName || "Partner",
      mood,
      energy,
      sleepQuality,
      overallWellbeing,
      stressFactors,
      supportProvided,
      concerns: concerns.trim() || undefined,
      contextNotes: contextNotes.trim() || undefined,
      sharedWithUser,
    };

    const parsed = PartnerObservationInputSchema.safeParse(input);
    if (!parsed.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const missingRating = parsed.error.issues.some((i) =>
        ["mood", "energy", "sleepQuality", "overallWellbeing"].includes(String(i.path[0]))
      );
      setErrors(
        missingRating
          ? ["Please rate all four categories before submitting."]
          : parsed.error.issues.map((i) => i.message)
      );
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      await addPartnerObservation(parsed.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack("/partner");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors([e instanceof Error ? e.message : "Could not save this observation."]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PartnerScreenHeader title="Log an observation" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.dateRow, { backgroundColor: colors.card }]}>
          <Pressable
            onPress={() => setDate((d) => addDaysLocal(d, -1))}
            hitSlop={8}
            style={styles.dateArrow}
          >
            <Feather name="chevron-left" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.dateText, { color: colors.foreground }]}>
            {formatDateLabel(date)}
          </Text>
          <Pressable
            onPress={() => date < today && setDate((d) => addDaysLocal(d, 1))}
            hitSlop={8}
            style={styles.dateArrow}
            disabled={date >= today}
          >
            <Feather
              name="chevron-right"
              size={20}
              color={date >= today ? colors.border : colors.text}
            />
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            How did they seem today?
          </Text>
          <View style={styles.ratingsList}>
            <RatingRow label="Mood" value={mood} onChange={setMood} low="Very low" high="Great" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <RatingRow
              label="Energy"
              value={energy}
              onChange={setEnergy}
              low="Drained"
              high="Energetic"
              accentColor={colors.warm}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <RatingRow
              label="Sleep quality"
              value={sleepQuality}
              onChange={setSleepQuality}
              low="Very poor"
              high="Great"
              accentColor={colors.purple}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <RatingRow
              label="Overall wellbeing"
              value={overallWellbeing}
              onChange={setOverallWellbeing}
              low="Struggling"
              high="Thriving"
              accentColor={colors.teal}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <ChipGroup
            label="What stress did you notice?"
            options={PARTNER_STRESS_FACTORS}
            selected={stressFactors}
            onToggle={toggleStressFactor}
            accentColor={colors.riskModerate}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <ChipGroup
            label="How did you support them?"
            options={PARTNER_SUPPORT_ACTIVITIES}
            selected={supportProvided}
            onToggle={toggleSupport}
            accentColor={colors.teal}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Anything worrying you noticed?
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Optional — withdrawal, appetite changes, trouble sleeping, or anything else on your mind.
          </Text>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border },
            ]}
            value={concerns}
            onChangeText={setConcerns}
            multiline
            placeholder="Share what you've noticed..."
            placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top"
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Life events, visitors, milestones…
          </Text>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border, minHeight: 90 },
            ]}
            value={contextNotes}
            onChangeText={setContextNotes}
            multiline
            placeholder="Anything worth remembering about today..."
            placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top"
          />
        </View>

        <View style={[styles.shareCard, { backgroundColor: colors.card }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Share this entry with your partner
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Off keeps it visible only in this partner space — your partner will never see it.
            </Text>
          </View>
          <Switch
            value={sharedWithUser}
            onValueChange={(v) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSharedWithUser(v);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {errors.length > 0 && (
          <View style={[styles.errorBox, { backgroundColor: colors.softRed }]}>
            {errors.map((e, i) => (
              <Text key={i} style={[styles.errorText, { color: colors.destructive }]}>
                • {e}
              </Text>
            ))}
          </View>
        )}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: saving ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.saveBtnText}>Save observation</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  dateArrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dateText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: -6 },
  ratingsList: { gap: 16 },
  divider: { height: 1 },
  textArea: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 90,
    lineHeight: 20,
  },
  shareCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  errorBox: { borderRadius: 14, padding: 14, gap: 4 },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  saveBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
