import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { CheckIn, UserProfile } from "@/context/AppContext";
import { showAlert } from "@/utils/dialog";
import { generateReportHtml } from "@/utils/generateReport";

/**
 * Web has no expo-print/expo-sharing equivalent, so on web we save the
 * generated report HTML as a downloadable file via a Blob + hidden anchor
 * (works reliably across browsers, unlike window.open which can be blocked
 * as a popup). Returns false if the download could not be initiated so the
 * caller can surface a visible error instead of silently doing nothing.
 */
function downloadHtmlOnWeb(html: string, filename: string): boolean {
  try {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds the Clinical Wellness Report HTML (via `generateReportHtml`),
 * renders it to a PDF with expo-print, and hands it off to the native share
 * sheet with expo-sharing. On web — where neither package has a real native
 * implementation — falls back to downloading the report as an HTML file.
 *
 * Entirely local: the PDF is generated and shared on-device, nothing is sent
 * over the network.
 */
export async function exportWellnessReportPDF(
  profile: UserProfile,
  checkIns: CheckIn[]
): Promise<void> {
  try {
    const html = generateReportHtml(profile, checkIns);

    if (Platform.OS === "web") {
      const opened = downloadHtmlOnWeb(html, "clinical-wellness-report.html");
      if (!opened) {
        showAlert("Download unavailable", "Your browser blocked the report download. Please try again.");
      }
      return;
    }

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Clinical Wellness Report",
        UTI: "com.adobe.pdf",
      });
    } else {
      showAlert("Sharing unavailable", "Your device does not support file sharing.");
    }
  } catch {
    showAlert("Error", "Could not generate the report. Please try again.");
  }
}
