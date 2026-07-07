import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

import { ScreenHeader } from "@/components/records/ScreenHeader";
import { LAB_CATEGORY_ICONS } from "@/components/records/recordIcons";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import {
  computeMarkerFlag,
  generateId,
  LAB_CATEGORIES,
  LAB_CATEGORY_LABELS,
  LabCategory,
  LabResultInputSchema,
  toDateString,
} from "@/types/health";
import { goBack } from "@/utils/navigation";

interface MarkerRow {
  key: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

function emptyRow(): MarkerRow {
  return { key: generateId(), name: "", value: "", unit: "", refLow: "", refHigh: "" };
}

export default function AddLabResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLabResult } = useHealth();

  const [testName, setTestName] = useState("");
  const [category, setCategory] = useState<LabCategory>("hormone");
  const [date, setDate] = useState(toDateString(new Date()));
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<MarkerRow[]>([emptyRow()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateRow = (key: string, patch: Partial<MarkerRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const previewFlag = (row: MarkerRow) => {
    const value = parseFloat(row.value.replace(",", "."));
    if (isNaN(value)) return null;
    const refLow = row.refLow.trim() ? parseFloat(row.refLow.replace(",", ".")) : undefined;
    const refHigh = row.refHigh.trim() ? parseFloat(row.refHigh.replace(",", ".")) : undefined;
    if (row.refLow.trim() && isNaN(refLow as number)) return null;
    if (row.refHigh.trim() && isNaN(refHigh as number)) return null;
    return computeMarkerFlag(value, refLow, refHigh);
  };

  const flagColor = (flag: "low" | "normal" | "high") =>
    flag === "high" ? colors.riskHigh : flag === "low" ? colors.riskModerate : colors.riskLow;

  const handleSave = async () => {
    setError("");

    const markers = rows.map((r) => ({
      name: r.name.trim(),
      value: parseFloat(r.value.replace(",", ".")),
      unit: r.unit.trim(),
      refLow: r.refLow.trim() ? parseFloat(r.refLow.replace(",", ".")) : undefined,
      refHigh: r.refHigh.trim() ? parseFloat(r.refHigh.replace(",", ".")) : undefined,
    }));

    const parsed = LabResultInputSchema.safeParse({
      testName,
      category,
      date,
      provider: provider.trim() ? provider.trim() : undefined,
      markers,
      notes: notes.trim() ? notes.trim() : undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the marker rows for errors.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setSaving(true);
      await addLabResult(parsed.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack("/records");
    } catch {
      setError("Something went wrong saving this lab result. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Add Lab Result" fallbackHref="/records" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={[styles.label, { color: colors.text }]}>Test name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={testName}
            onChangeText={setTestName}
            placeholder="e.g. Postpartum hormone panel"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View>
          <Text style={[styles.label, { color: colors.text }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {LAB_CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.teal : colors.card,
                        borderColor: active ? colors.teal : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={LAB_CATEGORY_ICONS[c]}
                      size={13}
                      color={active ? "#fff" : colors.mutedForeground}
                    />
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>
                      {LAB_CATEGORY_LABELS[c]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.text }]}>Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.text }]}>Provider</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={provider}
              onChangeText={setProvider}
              placeholder="Optional"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        <View>
          <View style={styles.markerHeaderRow}>
            <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Markers</Text>
            <Pressable onPress={addRow} style={styles.addRowBtn} hitSlop={8}>
              <Feather name="plus-circle" size={18} color={colors.primary} />
              <Text style={[styles.addRowText, { color: colors.primary }]}>Add marker</Text>
            </Pressable>
          </View>

          <View style={{ gap: 12 }}>
            {rows.map((row, idx) => {
              const flag = previewFlag(row);
              return (
                <View
                  key={row.key}
                  style={[styles.markerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.markerCardTop}>
                    <TextInput
                      style={[styles.markerNameInput, { color: colors.text }]}
                      value={row.name}
                      onChangeText={(v) => updateRow(row.key, { name: v })}
                      placeholder={`Marker ${idx + 1} name (e.g. TSH)`}
                      placeholderTextColor={colors.mutedForeground}
                    />
                    {rows.length > 1 && (
                      <Pressable onPress={() => removeRow(row.key)} hitSlop={8}>
                        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.markerFieldsRow}>
                    <TextInput
                      style={[styles.markerField, { backgroundColor: colors.secondary, color: colors.text }]}
                      value={row.value}
                      onChangeText={(v) => updateRow(row.key, { value: v })}
                      placeholder="Value"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.markerField, { backgroundColor: colors.secondary, color: colors.text }]}
                      value={row.unit}
                      onChangeText={(v) => updateRow(row.key, { unit: v })}
                      placeholder="Unit"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.markerFieldsRow}>
                    <TextInput
                      style={[styles.markerField, { backgroundColor: colors.secondary, color: colors.text }]}
                      value={row.refLow}
                      onChangeText={(v) => updateRow(row.key, { refLow: v })}
                      placeholder="Ref low"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.markerField, { backgroundColor: colors.secondary, color: colors.text }]}
                      value={row.refHigh}
                      onChangeText={(v) => updateRow(row.key, { refHigh: v })}
                      placeholder="Ref high"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {flag && (
                    <View style={styles.flagPreviewRow}>
                      <View style={[styles.flagDot, { backgroundColor: flagColor(flag) }]} />
                      <Text style={[styles.flagPreviewText, { color: flagColor(flag) }]}>
                        {flag === "high" ? "Above range" : flag === "low" ? "Below range" : "Within range"}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional context about this test"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Lab Result"}</Text>
        </Pressable>

        <View style={styles.footerNote}>
          <Feather name="lock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerNoteText, { color: colors.mutedForeground }]}>
            Private by design — your data stays on this device.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
  },
  chipRow: { flexDirection: "row", gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  row2: { flexDirection: "row", gap: 12 },
  markerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  addRowBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  addRowText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  markerCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  markerCardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  markerNameInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 4,
  },
  markerFieldsRow: { flexDirection: "row", gap: 8 },
  markerField: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
  },
  flagPreviewRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  flagDot: { width: 8, height: 8, borderRadius: 4 },
  flagPreviewText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  textArea: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
    minHeight: 90,
    lineHeight: 20,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
  },
  footerNoteText: { fontSize: 11.5, fontFamily: "Inter_400Regular" },
});
