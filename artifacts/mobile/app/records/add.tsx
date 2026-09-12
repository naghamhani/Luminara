import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
import { RECORD_TYPE_ICONS } from "@/components/records/recordIcons";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import {
  MEDICAL_RECORD_TYPE_LABELS,
  MEDICAL_RECORD_TYPES,
  MedicalRecordInputSchema,
  MedicalRecordType,
  toDateString,
} from "@/types/health";
import { showAlert } from "@/utils/dialog";
import { goBack } from "@/utils/navigation";
import { useTranslation } from "@/i18n";

export default function AddRecordScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { addRecord } = useHealth();

  const [type, setType] = useState<MedicalRecordType>("doctor_note");
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [facility, setFacility] = useState("");
  const [date, setDate] = useState(toDateString(new Date()));
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [attachmentUri, setAttachmentUri] = useState<string | undefined>();
  const [attachmentMime, setAttachmentMime] = useState<string | undefined>();
  const [attachmentName, setAttachmentName] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const tags = tagInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const clearAttachment = () => {
    setAttachmentUri(undefined);
    setAttachmentMime(undefined);
    setAttachmentName(undefined);
  };

  // Picked files (camera roll / document picker) live in a temporary cache
  // directory that the OS can purge at any time. Copy into the persistent
  // app document directory so the attachment survives cache clears/updates.
  const persistAttachment = async (tempUri: string, suggestedName: string) => {
    if (Platform.OS === "web") return tempUri;
    try {
      const ext = suggestedName.includes(".") ? suggestedName.split(".").pop() : undefined;
      const filename = `record-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext ? `.${ext}` : ""}`;
      const destUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      return destUri;
    } catch {
      return tempUri;
    }
  };

  const handlePhotoPress = () => {
    // On web, showAlert falls back to window.confirm, which only supports a
    // single confirm action — "Choose from Library" would be unreachable.
    // Both options land in the same web file-input flow, so go straight to it.
    if (Platform.OS === "web") {
      pickPhoto();
      return;
    }
    showAlert("Add photo", "Choose a source", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert(
        "Camera access needed",
        "Enable camera access in Settings to take a photo of a document."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const persistedUri = await persistAttachment(asset.uri, "photo.jpg");
      setAttachmentUri(persistedUri);
      setAttachmentMime(asset.mimeType ?? "image/jpeg");
      setAttachmentName("Photo");
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert(
        "Photo library access needed",
        "Enable photo library access in Settings to attach an image."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const persistedUri = await persistAttachment(asset.uri, asset.fileName ?? "photo.jpg");
      setAttachmentUri(persistedUri);
      setAttachmentMime(asset.mimeType ?? "image/jpeg");
      setAttachmentName(asset.fileName ?? "Photo");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const persistedUri = await persistAttachment(asset.uri, asset.name ?? "Document.pdf");
        setAttachmentUri(persistedUri);
        setAttachmentMime(asset.mimeType ?? "application/pdf");
        setAttachmentName(asset.name ?? "Document.pdf");
      }
    } catch {
      showAlert("Couldn't open file picker", "Please try again.");
    }
  };

  const isImageAttachment = attachmentMime?.startsWith("image/");

  const handleSave = async () => {
    setError("");
    const parsed = MedicalRecordInputSchema.safeParse({
      type,
      title,
      provider,
      facility: facility.trim() ? facility.trim() : undefined,
      date,
      content,
      attachmentUri,
      attachmentMime,
      tags,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form for errors.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setSaving(true);
      await addRecord(parsed.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack("/records");
    } catch {
      setError("Something went wrong saving this record. Please try again.");
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
      <ScreenHeader title={t("records.addRecord")} fallbackHref="/records" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={[styles.label, { color: colors.text }]}>{t("records.recordType")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={styles.chipRow}>
              {MEDICAL_RECORD_TYPES.map((t) => {
                const active = type === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={RECORD_TYPE_ICONS[t]}
                      size={13}
                      color={active ? "#fff" : colors.mutedForeground}
                    />
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>
                      {MEDICAL_RECORD_TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <Field label="Title" value={title} onChangeText={setTitle} placeholder={t("records.titlePlaceholder")} colors={colors} />
        <Field
          label={t("records.provider")}
          value={provider}
          onChangeText={setProvider}
          placeholder={t("records.providerPlaceholder")}
          colors={colors}
        />
        <Field
          label="Facility"
          value={facility}
          onChangeText={setFacility}
          placeholder={t("records.facilityPlaceholder2")}
          colors={colors}
        />
        <Field
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          colors={colors}
          keyboardType="numbers-and-punctuation"
        />

        <View>
          <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
            ]}
            value={content}
            onChangeText={setContent}
            placeholder={t("records.contentPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Field
          label="Tags"
          value={tagInput}
          onChangeText={setTagInput}
          placeholder={t("records.tagsPlaceholder")}
          colors={colors}
        />
        {tags.length > 0 && (
          <View style={styles.tagPreviewRow}>
            {tags.map((t, i) => (
              <View key={i} style={[styles.tagPill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagPillText, { color: colors.primary }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <View>
          <Text style={[styles.label, { color: colors.text }]}>Attachment</Text>
          <View style={styles.attachRow}>
            <Pressable
              onPress={handlePhotoPress}
              style={[styles.attachBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="camera" size={16} color={colors.primary} />
              <Text style={[styles.attachBtnText, { color: colors.text }]}>Photo</Text>
            </Pressable>
            <Pressable
              onPress={pickDocument}
              style={[styles.attachBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="file-plus" size={16} color={colors.primary} />
              <Text style={[styles.attachBtnText, { color: colors.text }]}>{t("records.documentPdf")}</Text>
            </Pressable>
          </View>

          {attachmentUri && (
            <View style={[styles.attachmentPreview, { backgroundColor: colors.secondary }]}>
              {isImageAttachment ? (
                <Image source={{ uri: attachmentUri }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.fileIcon, { backgroundColor: colors.card }]}>
                  <Feather name="file-text" size={18} color={colors.primary} />
                </View>
              )}
              <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                {attachmentName ?? "Attachment"}
              </Text>
              <Pressable onPress={clearAttachment} hitSlop={8}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
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
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Record"}</Text>
        </Pressable>

        <View style={styles.footerNote}>
          <Feather name="lock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerNoteText, { color: colors.mutedForeground }]}>
            {t("common.privateByDesign")}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  keyboardType?: "default" | "numbers-and-punctuation";
}) {
  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
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
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
    minHeight: 120,
    lineHeight: 20,
  },
  tagPreviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -8 },
  tagPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  tagPillText: { fontSize: 11.5, fontFamily: "Inter_600SemiBold" },
  attachRow: { flexDirection: "row", gap: 10 },
  attachBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  attachBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  attachmentPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 10,
    marginTop: 10,
  },
  thumb: { width: 36, height: 36, borderRadius: 8 },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
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
