import { Feather } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnonymizedPreviewCard } from "@/components/research/AnonymizedPreviewCard";
import { ConsentStepDef, ConsentStepper } from "@/components/research/ConsentStepper";
import { DataTypeToggleList } from "@/components/research/DataTypeToggleList";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { showAlert } from "@/utils/dialog";
import { goBack } from "@/utils/navigation";
import {
  DataTypeKey,
  DEFAULT_RESEARCH_CONSENT,
  PrivacySettings,
} from "@/types/health";
import {
  anonymizedBundleToCSVFiles,
  anonymizedBundleToFHIR,
  buildAnonymizedBundle,
} from "@/utils/anonymize";
import { isBackendConfigured } from "@/utils/apiConfig";
import { BackendNotConfiguredError, submitResearchBundle } from "@/utils/backendClient";

const CONSENT_STEPS: ConsentStepDef[] = [
  { key: "share", title: "What we share", icon: "share-2" },
  { key: "never", title: "What we never share", icon: "shield" },
  { key: "choices", title: "Your choices", icon: "sliders" },
];

function truncatePseudonym(pseudonym: string | undefined): string {
  if (!pseudonym) return "—";
  return pseudonym.length <= 12 ? pseudonym : `${pseudonym.slice(0, 8)}…${pseudonym.slice(-4)}`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function ResearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { privacySettings, savePrivacySettings, buildSnapshot } = useHealth();
  const research = privacySettings.research ?? DEFAULT_RESEARCH_CONSENT;

  const [stepIndex, setStepIndex] = useState(0);
  const [draftDataTypes, setDraftDataTypes] = useState<Record<DataTypeKey, boolean>>(
    research.dataTypes
  );
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "fhir" | null>(null);
  const [contributing, setContributing] = useState(false);

  const snapshot = useMemo(() => buildSnapshot(), [buildSnapshot]);
  const previewBundle = useMemo(
    () =>
      buildAnonymizedBundle(snapshot, {
        participating: true,
        dataTypes: research.participating ? research.dataTypes : draftDataTypes,
        pseudonym: research.pseudonym ?? "preview-pseudonym",
      }),
    [snapshot, research.participating, research.pseudonym, research.dataTypes, draftDataTypes]
  );

  async function handleAgree() {
    const pseudonym = research.pseudonym ?? Crypto.randomUUID();
    const next: PrivacySettings = {
      ...privacySettings,
      research: {
        participating: true,
        consentDate: new Date().toISOString(),
        dataTypes: draftDataTypes,
        pseudonym,
      },
    };
    await savePrivacySettings(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleUpdateTypes(next: Record<DataTypeKey, boolean>) {
    await savePrivacySettings({
      ...privacySettings,
      research: { ...research, dataTypes: next },
    });
  }

  function handleWithdraw() {
    showAlert(
      "Withdraw from research?",
      "Files you already exported and shared cannot be recalled — this only stops any further data from being contributed. You can rejoin any time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            await savePrivacySettings({
              ...privacySettings,
              research: {
                ...research,
                participating: false,
                revokedDate: new Date().toISOString(),
              },
            });
            setStepIndex(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }

  async function shareTextFallback(filename: string, content: string) {
    await Share.share({ message: content, title: filename });
  }

  /** Browser-native download via Blob + temporary anchor — desktop browsers
   * have no native share sheet and no writable app filesystem, so this is
   * the web equivalent of expo-sharing's share dialog. */
  function downloadOnWeb(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }

  async function writeAndShare(filename: string, content: string, mimeType: string) {
    if (Platform.OS === "web") {
      downloadOnWeb(filename, content, mimeType);
      return;
    }
    const uri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: `Share ${filename}` });
    } else {
      await shareTextFallback(filename, content);
    }
  }

  async function handleExportCSV() {
    try {
      setExporting("csv");
      const bundle = buildAnonymizedBundle(snapshot, research);
      const files = anonymizedBundleToCSVFiles(bundle);
      // Combined into a single .csv with clear "### section ###" headers so
      // one export = one file to hand to a study, rather than juggling several
      // share sheets back to back.
      const combined = files
        .map((f) => `### ${f.filename} ###\r\n${f.content}`)
        .join("\r\n\r\n");
      await writeAndShare("luminara_research_export.csv", combined, "text/csv");
    } catch {
      showAlert("Export failed", "Could not build the CSV export. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportFHIR() {
    try {
      setExporting("fhir");
      const bundle = buildAnonymizedBundle(snapshot, research);
      const fhir = anonymizedBundleToFHIR(bundle);
      const content = JSON.stringify(fhir, null, 2);
      await writeAndShare("luminara_research_export.fhir.json", content, "application/json");
    } catch {
      showAlert("Export failed", "Could not build the FHIR export. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  const sampleCheckIn = snapshot.checkIns[0];
  const sampleCycle = snapshot.cycleEntries[0];
  async function handleContribute() {
    if (!isBackendConfigured()) {
      showAlert(
        "No server connected",
        "Contributing directly requires a Luminara research server. You can still export a file and share it with a study. To enable direct upload, set EXPO_PUBLIC_API_URL."
      );
      return;
    }
    try {
      setContributing(true);
      const bundle = buildAnonymizedBundle(snapshot, research);
      const res = await submitResearchBundle(bundle);
      showAlert(
        "Thank you 💛",
        res.ok
          ? "Your anonymized contribution was received. It's stored under your research pseudonym only — no name, no free text, no dates."
          : "The server didn't accept the submission. Please try again."
      );
    } catch (err) {
      if (err instanceof BackendNotConfiguredError) {
        showAlert("No server connected", "Set EXPO_PUBLIC_API_URL to enable direct contribution.");
      } else {
        showAlert("Couldn't contribute", (err as Error).message);
      }
    } finally {
      setContributing(false);
    }
  }

  const bundleCheckIn = previewBundle.checkIns[0];
  const bundleCycle = previewBundle.cycleEntries[0];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack("/(tabs)/profile")} style={styles.backBtn} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Research participation</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero explainer */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="git-pull-request" size={20} color={colors.purple} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Help improve postpartum care — anonymously
          </Text>
          <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>
            Contributing anonymized data means researchers can see patterns — like how mood,
            sleep, and cycle signals shift after birth — across many people, without ever seeing
            who you are.
          </Text>
          <View style={styles.heroRow}>
            <Feather name="x-circle" size={14} color={colors.riskHigh} />
            <Text style={[styles.heroRowText, { color: colors.text }]}>
              Removed: names, baby's name, exact dates, free-text notes, provider & facility names
            </Text>
          </View>
          <View style={styles.heroRow}>
            <Feather name="check-circle" size={14} color={colors.riskLow} />
            <Text style={[styles.heroRowText, { color: colors.text }]}>
              Kept: scores, cycle signals, lab marker values — as day-offset patterns, not dates
            </Text>
          </View>
          <View style={[styles.honestyBox, { backgroundColor: colors.softGreen }]}>
            <Feather name="smartphone" size={14} color={colors.riskLow} />
            <Text style={[styles.honestyText, { color: "#1F5C42" }]}>
              Nothing is uploaded automatically. Export produces files YOU choose to share with a
              study. Private by design — your data stays on this device until you export it.
            </Text>
          </View>
        </View>

        {!research.participating ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <ConsentStepper steps={CONSENT_STEPS} activeIndex={stepIndex} />

            <View style={{ marginTop: 20 }}>
              {stepIndex === 0 && (
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>What we share</Text>
                  <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
                    Only the data types you turn on below, converted into day-offset patterns:
                    check-in scores, cycle & biomarker signals, lab marker values, medication
                    names/dosage types & durations, and partner rating summaries.
                  </Text>
                </View>
              )}
              {stepIndex === 1 && (
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                    What we never share
                  </Text>
                  <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
                    Your name, your baby's name, exact calendar dates, free-text notes or
                    concerns, provider or facility names, and any attached photos/documents never
                    leave this screen — they are stripped before anything is built for export.
                  </Text>
                </View>
              )}
              {stepIndex === 2 && (
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                    Your choices
                  </Text>
                  <Text style={[styles.stepText, { color: colors.mutedForeground, marginBottom: 4 }]}>
                    Choose exactly which data types to contribute. Everything defaults to off —
                    turn on only what you're comfortable with. You can change this anytime, or
                    withdraw entirely.
                  </Text>
                  <DataTypeToggleList value={draftDataTypes} onChange={setDraftDataTypes} />
                </View>
              )}
            </View>

            <View style={styles.stepNavRow}>
              {stepIndex > 0 && (
                <Pressable
                  onPress={() => setStepIndex((s) => Math.max(0, s - 1))}
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Back</Text>
                </Pressable>
              )}
              {stepIndex < CONSENT_STEPS.length - 1 ? (
                <Pressable
                  onPress={() => setStepIndex((s) => Math.min(CONSENT_STEPS.length - 1, s + 1))}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.primaryBtnText}>Next</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleAgree}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>I agree to contribute anonymized data</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <>
            {/* Status card */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.riskLow }]} />
                <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                  You're contributing anonymized data
                </Text>
              </View>
              <Text style={[styles.statusMeta, { color: colors.mutedForeground }]}>
                Since {formatDate(research.consentDate)}
              </Text>
              <View style={[styles.pseudonymBox, { backgroundColor: colors.secondary }]}>
                <Feather name="hash" size={13} color={colors.primary} />
                <Text style={[styles.pseudonymText, { color: colors.primary }]}>
                  Participant code · {truncatePseudonym(research.pseudonym)}
                </Text>
              </View>
            </View>

            {/* Editable data-type toggles */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                What you're contributing
              </Text>
              <DataTypeToggleList value={research.dataTypes} onChange={handleUpdateTypes} />
            </View>

            {/* Preview */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Pressable
                onPress={() => setShowPreview((s) => !s)}
                style={styles.previewToggleRow}
              >
                <View style={styles.previewToggleLeft}>
                  <Feather name="eye" size={16} color={colors.purple} />
                  <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 0 }]}>
                    Preview anonymized data
                  </Text>
                </View>
                <Feather
                  name={showPreview ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {showPreview && (
                <View style={{ marginTop: 14 }}>
                  {!sampleCheckIn && !sampleCycle ? (
                    <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
                      No entries yet — log a check-in or cycle entry to see a live preview here.
                    </Text>
                  ) : (
                    <AnonymizedPreviewCard
                      pairs={[
                        ...(sampleCheckIn
                          ? [
                              {
                                label: "One check-in",
                                before: sampleCheckIn,
                                after: bundleCheckIn,
                              },
                            ]
                          : []),
                        ...(sampleCycle
                          ? [
                              {
                                label: "One cycle entry",
                                before: sampleCycle,
                                after: bundleCycle,
                              },
                            ]
                          : []),
                      ]}
                    />
                  )}
                </View>
              )}
            </View>

            {/* Export */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Export for a study</Text>
              <Text style={[styles.stepText, { color: colors.mutedForeground, marginBottom: 14 }]}>
                Builds a file from your current anonymized data. You choose who to send it to via
                the share sheet — it is never sent automatically.
              </Text>
              <View style={styles.exportRow}>
                <Pressable
                  onPress={handleExportCSV}
                  disabled={exporting !== null}
                  style={[styles.exportBtn, { backgroundColor: colors.secondary }]}
                >
                  {exporting === "csv" ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Feather name="grid" size={16} color={colors.primary} />
                      <Text style={[styles.exportBtnText, { color: colors.primary }]}>Export CSV</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleExportFHIR}
                  disabled={exporting !== null}
                  style={[styles.exportBtn, { backgroundColor: colors.secondary }]}
                >
                  {exporting === "fhir" ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Feather name="file-text" size={16} color={colors.primary} />
                      <Text style={[styles.exportBtnText, { color: colors.primary }]}>
                        Export FHIR JSON
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
              <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
                Not a diagnosis — this data reflects self-reported patterns and should be
                interpreted by researchers or reviewed with your healthcare provider.
              </Text>
            </View>

            {/* Contribute directly to the research server */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Contribute to the research dataset
              </Text>
              <Text style={[styles.stepText, { color: colors.mutedForeground, marginBottom: 14 }]}>
                Sends the same anonymized bundle directly to the Luminara research server, stored
                under your pseudonym to help improve the models. You can do this anytime; withdrawing
                stops future contributions.
              </Text>
              <Pressable
                onPress={handleContribute}
                disabled={contributing}
                style={[styles.exportBtn, { backgroundColor: colors.primary, width: "100%" }]}
              >
                {contributing ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="upload-cloud" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.exportBtnText, { color: colors.primaryForeground }]}>
                      Contribute anonymously
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Withdraw */}
            <Pressable
              onPress={handleWithdraw}
              style={[styles.withdrawBtn, { borderColor: colors.riskHigh }]}
            >
              <Feather name="log-out" size={15} color={colors.riskHigh} />
              <Text style={[styles.withdrawText, { color: colors.riskHigh }]}>
                Withdraw from research
              </Text>
            </Pressable>
            <Text style={[styles.withdrawHint, { color: colors.mutedForeground }]}>
              Withdrawing stops any further contribution. Files already exported and shared
              cannot be recalled.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  scrollContent: { paddingHorizontal: 20, gap: 16 },
  card: {
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8, lineHeight: 24 },
  heroBody: { fontSize: 13.5, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 14 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  heroRowText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_500Medium", lineHeight: 18 },
  honestyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  honestyText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  stepBody: { gap: 8 },
  stepTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  stepText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  stepNavRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 13.5, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  secondaryBtn: {
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statusMeta: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginBottom: 12 },
  pseudonymBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    alignSelf: "flex-start",
  },
  pseudonymText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 12 },
  previewToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  exportRow: { flexDirection: "row", gap: 10 },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 14 },
  withdrawBtn: {
    flexDirection: "row",
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  withdrawHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
