import type { ComponentProps } from "react";
import type { Feather } from "@expo/vector-icons";

import type { LabCategory, MedicalRecordType } from "@/types/health";

type FeatherName = ComponentProps<typeof Feather>["name"];

export const RECORD_TYPE_ICONS: Record<MedicalRecordType, FeatherName> = {
  doctor_note: "file-text",
  lab_report: "activity",
  imaging: "image",
  prescription: "clipboard",
  discharge_summary: "log-out",
  other: "folder",
};

export const LAB_CATEGORY_ICONS: Record<LabCategory, FeatherName> = {
  hormone: "activity",
  blood: "droplet",
  thyroid: "target",
  vitamin: "sun",
  metabolic: "trending-up",
  other: "folder",
};
