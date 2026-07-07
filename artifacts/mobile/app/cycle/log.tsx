import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import {
  addDays,
  CERVICAL_MUCUS_TYPES,
  CYCLE_SYMPTOMS,
  CycleEntryInputSchema,
  FLOW_LEVELS,
  toDateString,
  type CervicalMucusType,
  type CycleEntryInput,
  type FlowLevel,
  type TestOutcome,
} from "@/types/health";
import { goBack } from "@/utils/navigation";

const FLOW_LABELS: Record<FlowLevel, string> = {
  none: "None",
  spotting: "Spotting",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
};

const MUCUS_LABELS: Record<CervicalMucusType, string> = {
  dry: "Dry",
  sticky: "Sticky",
  creamy: "Creamy",
  watery: "Watery",
  eggwhite: "Egg-white",
};

const TEST_OPTIONS: TestOutcome[] = ["not_taken", "negative", "positive"];
const TEST_LABELS: Record<TestOutcome, string> = {
  not_taken: "Not taken",
  negative: "Negative",
  positive: "Positive",
};

function formatDateLong(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function CycleLogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const { cycleEntries, upsertCycleEntry } = useHealth();

  const today = toDateString(new Date());
  const [date, setDate] = useState(dateParam ?? today);

  const existing = useMemo(() => cycleEntries.find((e) => e.date === date), [cycleEntries, date]);

  const [flow, setFlow] = useState<FlowLevel | undefined>(undefined);
  const [bbtText, setBbtText] = useState("");
  const [cervicalMucus, setCervicalMucus] = useState<CervicalMucusType | undefined>(undefined);
  const [ovulationTest, setOvulationTest] = useState<TestOutcome>("not_taken");
  const [pregnancyTest, setPregnancyTest] = useState<TestOutcome>("not_taken");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Prefill whenever the selected date's existing entry changes.
  useEffect(() => {
    if (existing) {
      setFlow(existing.flow);
      setBbtText(existing.bbt !== undefined ? String(existing.bbt) : "");
      setCervicalMucus(existing.cervicalMucus);
      setOvulationTest(existing.ovulationTest ?? "not_taken");
      setPregnancyTest(existing.pregnancyTest ?? "not_taken");
      setSymptoms(existing.symptoms ?? []);
      setNotes(existing.notes ?? "");
    } else {
      setFlow(undefined);
      setBbtText("");
      setCervicalMucus(undefined);
      setOvulationTest("not_taken");
      setPregnancyTest("not_taken");
      setSymptoms([]);
      setNotes("");
    }
    setError("");
  }, [existing, date]);

  const canGoForward = date < today;

  const toggleSymptom = (s: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const handleSave = async () => {
    setError("");

    const bbtTrimmed = bbtText.trim();
    const bbtValue = bbtTrimmed.length > 0 ? parseFloat(bbtTrimmed.replace(",", ".")) : undefined;
    if (bbtTrimmed.length > 0 && Number.isNaN(bbtValue)) {
      setError("BBT must be a valid number");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    const input: CycleEntryInput = {
      date,
      flow,
      bbt: bbtValue,
      cervicalMucus,
      ovulationTest,
      pregnancyTest,
      symptoms,
      notes: notes.trim().length > 0 ? notes.trim() : undefined,
    };

    const parsed = CycleEntryInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your entries");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      await upsertCycleEntry(parsed.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack("/cycle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save entry");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack("/cycle")} style={styles.backBtn} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {date === today ? "Log today" : `Log ${formatDateLong(date)}`}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date row */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => setDate((d) => addDays(d, -1))}
              style={[styles.dateChevron, { backgroundColor: colors.secondary }]}
              hitSlop={8}
            >
              <Feather name="chevron-left" size={18} color={colors.text} />
            </Pressable>
            <Text style={[styles.dateText, { color: colors.foreground }]}>{formatDateLong(date)}</Text>
            <Pressable
              onPress={() => canGoForward && setDate((d) => addDays(d, 1))}
              disabled={!canGoForward}
              style={[
                styles.dateChevron,
                { backgroundColor: canGoForward ? colors.secondary : "transparent" },
              ]}
              hitSlop={8}
            >
              <Feather
                name="chevron-right"
                size={18}
                color={canGoForward ? colors.text : colors.border}
              />
            </Pressable>
          </View>
        </View>

        {/* Flow */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Flow</Text>
          <View style={styles.pillRow}>
            {FLOW_LEVELS.map((level) => {
              const active = flow === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFlow(active ? undefined : level);
                  }}
                  style={[
                    styles.flowPill,
                    {
                      backgroundColor: active ? colors.riskHigh + "1A" : colors.secondary,
                      borderColor: active ? colors.riskHigh : "transparent",
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <Feather
                    name="droplet"
                    size={13}
                    color={active ? colors.riskHigh : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.flowPillText,
                      { color: active ? colors.riskHigh : colors.mutedForeground },
                    ]}
                  >
                    {FLOW_LABELS[level]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* BBT */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Basal body temperature
          </Text>
          <TextInput
            style={[
              styles.bbtInput,
              { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border },
            ]}
            value={bbtText}
            onChangeText={setBbtText}
            placeholder="e.g. 36.55"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            In °C, typically between 35.5 and 37.5
          </Text>
        </View>

        {/* Cervical mucus */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cervical mucus</Text>
          <View style={styles.pillRow}>
            {CERVICAL_MUCUS_TYPES.map((type) => {
              const active = cervicalMucus === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCervicalMucus(active ? undefined : type);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#fff" : colors.text },
                    ]}
                  >
                    {MUCUS_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Ovulation test */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ovulation test</Text>
          <SegmentedControl
            options={TEST_OPTIONS}
            labels={TEST_LABELS}
            value={ovulationTest}
            onChange={setOvulationTest}
            colors={colors}
          />
        </View>

        {/* Pregnancy test */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pregnancy test</Text>
          <SegmentedControl
            options={TEST_OPTIONS}
            labels={TEST_LABELS}
            value={pregnancyTest}
            onChange={setPregnancyTest}
            colors={colors}
          />
          {pregnancyTest === "positive" && (
            <View style={[styles.infoBanner, { backgroundColor: colors.softOrange }]}>
              <Feather name="info" size={15} color={colors.riskModerate} />
              <Text style={[styles.infoBannerText, { color: "#9A5010" }]}>
                Predictions pause while pregnancy is indicated. Please confirm this result with
                your healthcare provider.
              </Text>
            </View>
          )}
        </View>

        {/* Symptoms */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Symptoms</Text>
          <View style={styles.pillRow}>
            {CYCLE_SYMPTOMS.map((s) => {
              const active = symptoms.includes(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => toggleSymptom(s)}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? colors.purple : colors.secondary },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
          <TextInput
            style={[
              styles.notesInput,
              { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything else worth remembering about today?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
        </View>

        {error.length > 0 && (
          <View style={[styles.errorBox, { backgroundColor: colors.softRed }]}>
            <Text style={[styles.errorText, { color: colors.riskHigh }]}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.saveBtnText}>{existing ? "Update entry" : "Save entry"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SegmentedControl<T extends string>({
  options,
  labels,
  value,
  onChange,
  colors,
}: {
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(opt);
            }}
            style={[
              styles.segmentedItem,
              active && { backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
            ]}
          >
            <Text
              style={[
                styles.segmentedText,
                { color: active ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {labels[opt]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  flowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
  },
  flowPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 14,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  bbtInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentedText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 100,
    lineHeight: 20,
  },
  errorBox: {
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  saveBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
