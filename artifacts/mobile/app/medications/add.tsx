import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  MEDICATION_KINDS,
  MedicationInputSchema,
  toDateString,
  type MedicationInput,
  type MedicationKind,
} from "@/types/health";
import { goBack } from "@/utils/navigation";
import { directionalIcon } from "@/utils/rtl";
import { useTranslation } from "@/i18n";

const KIND_ICONS: Record<MedicationKind, keyof typeof Feather.glyphMap> = {
  medication: "circle",
  supplement: "feather",
  vitamin: "sun",
};

const KIND_LABELS: Record<MedicationKind, string> = {
  medication: "Medication",
  supplement: "Supplement",
  vitamin: "Vitamin",
};

export default function AddMedicationScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { medications, addMedication, updateMedication } = useHealth();

  const isEdit = !!id;
  const existing = useMemo(() => medications.find((m) => m.id === id), [medications, id]);

  const today = toDateString(new Date());

  const [name, setName] = useState("");
  const [kind, setKind] = useState<MedicationKind>("medication");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [prescribedBy, setPrescribedBy] = useState("");
  const [providerNotes, setProviderNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setKind(existing.kind);
      setDosage(existing.dosage);
      setFrequency(existing.frequency);
      setStartDate(existing.startDate);
      setEndDate(existing.endDate ?? "");
      setPrescribedBy(existing.prescribedBy ?? "");
      setProviderNotes(existing.providerNotes ?? "");
    }
  }, [existing]);

  const handleSave = async () => {
    if (saving) return;

    setErrors({});
    setFormError("");

    if (isEdit && !existing) {
      setFormError("This entry could not be found. It may have been deleted or changed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    const input: MedicationInput = {
      name: name.trim(),
      kind,
      dosage: dosage.trim(),
      frequency: frequency.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim().length > 0 ? endDate.trim() : undefined,
      prescribedBy: prescribedBy.trim().length > 0 ? prescribedBy.trim() : undefined,
      providerNotes: providerNotes.trim().length > 0 ? providerNotes.trim() : undefined,
      active: existing?.active ?? true,
    };

    const parsed = MedicationInputSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] ? String(issue.path[0]) : "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setFormError(parsed.error.issues[0]?.message ?? "Please check your entries");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSaving(true);
    try {
      if (isEdit && existing) {
        await updateMedication(existing.id, parsed.data);
      } else {
        await addMedication(parsed.data);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack("/medications");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack("/medications")} style={styles.backBtn} hitSlop={10}>
          <Feather name={directionalIcon("chevron-left")} size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isEdit ? "Edit entry" : "Add medication"}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Name" error={errors.name} colors={colors}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.text }]}
            value={name}
            onChangeText={setName}
            placeholder={t("medications.namePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
          />
        </Field>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Kind</Text>
          <View style={styles.kindRow}>
            {MEDICATION_KINDS.map((k) => {
              const active = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setKind(k);
                  }}
                  style={[
                    styles.kindChip,
                    { backgroundColor: active ? colors.primary : colors.secondary },
                  ]}
                >
                  <Feather
                    name={KIND_ICONS[k]}
                    size={14}
                    color={active ? "#fff" : colors.mutedForeground}
                  />
                  <Text style={[styles.kindChipText, { color: active ? "#fff" : colors.text }]}>
                    {KIND_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field label="Dosage" error={errors.dosage} colors={colors}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.text }]}
            value={dosage}
            onChangeText={setDosage}
            placeholder="e.g. 50 mg"
            placeholderTextColor={colors.mutedForeground}
          />
        </Field>

        <Field label="Frequency" error={errors.frequency} colors={colors}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.text }]}
            value={frequency}
            onChangeText={setFrequency}
            placeholder={t("medications.freqPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
          />
        </Field>

        <Field label={t("medications.startDate")} error={errors.startDate} colors={colors}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.text }]}
            value={startDate}
            onChangeText={setStartDate}
            placeholder={today}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
          />
        </Field>

        <Field
          label={t("medications.endDate")}
          error={errors.endDate}
          colors={colors}
        >
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.text }]}
            value={endDate}
            onChangeText={setEndDate}
            placeholder={t("medications.endDatePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
          />
        </Field>

        <Field label={t("medications.prescribedBy")} error={errors.prescribedBy} colors={colors}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.text }]}
            value={prescribedBy}
            onChangeText={setPrescribedBy}
            placeholder={t("medications.prescribedByPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
          />
        </Field>

        <Field label={t("medications.providerNotes")} error={errors.providerNotes} colors={colors}>
          <TextInput
            style={[
              styles.input,
              styles.multiline,
              { backgroundColor: colors.secondary, color: colors.text },
            ]}
            value={providerNotes}
            onChangeText={setProviderNotes}
            placeholder={t("medications.providerNotesPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
        </Field>

        {formError.length > 0 && (
          <View style={[styles.errorBox, { backgroundColor: colors.softRed }]}>
            <Text style={[styles.errorBoxText, { color: colors.riskHigh }]}>{formError}</Text>
          </View>
        )}

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          {t("common.alwaysConfirmPrescriber")}
        </Text>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.85 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{isEdit ? "Save changes" : "Add"}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  error,
  colors,
  children,
}: {
  label: string;
  error?: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      {children}
      {error && <Text style={[styles.fieldError, { color: colors.destructive }]}>{error}</Text>}
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
    gap: 16,
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
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  kindRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
  },
  kindChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  multiline: {
    minHeight: 90,
    lineHeight: 20,
  },
  fieldError: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  errorBox: {
    borderRadius: 12,
    padding: 12,
  },
  errorBoxText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    textAlign: "center",
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
