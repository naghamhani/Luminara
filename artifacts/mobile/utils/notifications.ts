import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { daysBetween, type CyclePrediction, type Medication } from "@/types/health";

/**
 * Local (device-only) notification scheduling — no push tokens, no backend.
 * expo-notifications has limited/no support on web, so every entry point
 * here early-returns on Platform.OS === "web" rather than calling into the
 * native module, which would otherwise throw or silently no-op there.
 *
 * Scheduled notification identifiers are persisted in AsyncStorage so
 * reminders can be cancelled/rescheduled idempotently (e.g. when medications
 * change, or a toggle is flipped off then on) without leaving orphaned
 * notifications behind.
 */

const CHECKIN_REMINDER_KEY = "@luminara_notif_checkin_id";
const MEDICATION_REMINDER_IDS_KEY = "@luminara_notif_medication_ids";
const CYCLE_REMINDER_IDS_KEY = "@luminara_notif_cycle_ids";

/** Days before the predicted next period / fertile window to remind the user. */
const CYCLE_PERIOD_REMINDER_DAYS_BEFORE = 2;
const CYCLE_FERTILE_REMINDER_DAYS_BEFORE = 1;

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/** Requests notification permission; returns whether it was granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function getStoredIds(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function cancelStoredIds(key: string): Promise<void> {
  const ids = await getStoredIds(key);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await AsyncStorage.removeItem(key);
}

/** Days from today (local) to a YYYY-MM-DD date; negative if the date is in the past. */
function daysFromToday(date: string): number {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return daysBetween(todayStr, date);
}

// ---------------------------------------------------------------------------
// Daily check-in reminder
// ---------------------------------------------------------------------------

/**
 * Cancels any previously scheduled daily check-in reminder, then schedules a
 * new one at the given local hour/minute, repeating every day.
 */
export async function scheduleDailyCheckInReminder(
  hour: number,
  minute: number
): Promise<string | null> {
  if (Platform.OS === "web") return null;

  await cancelStoredIds(CHECKIN_REMINDER_KEY);

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "How are you feeling today?",
      body: "Take a minute for your daily wellness check-in.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(CHECKIN_REMINDER_KEY, JSON.stringify([identifier]));
  return identifier;
}

/** Cancels the scheduled daily check-in reminder, if any. */
export async function cancelDailyCheckInReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelStoredIds(CHECKIN_REMINDER_KEY);
}

// ---------------------------------------------------------------------------
// Medication reminders
// ---------------------------------------------------------------------------

/**
 * Cancels existing medication reminder notifications, then schedules one
 * daily reminder per active medication. Medications without an active
 * course, or already past their end date, are skipped.
 */
export async function scheduleMedicationReminders(
  medications: Medication[]
): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelStoredIds(MEDICATION_REMINDER_IDS_KEY);

  const active = medications.filter((m) => m.active);
  const identifiers: string[] = [];

  for (const med of active) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Time for ${med.name}`,
        body: `${med.dosage} · ${med.frequency}`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
      },
    });
    identifiers.push(identifier);
  }

  if (identifiers.length > 0) {
    await AsyncStorage.setItem(MEDICATION_REMINDER_IDS_KEY, JSON.stringify(identifiers));
  }
}

/** Cancels all scheduled medication reminders, if any. */
export async function cancelMedicationReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelStoredIds(MEDICATION_REMINDER_IDS_KEY);
}

// ---------------------------------------------------------------------------
// Cycle prediction reminders
// ---------------------------------------------------------------------------

/**
 * Schedules one-off reminders ahead of the predicted next period and the
 * start of the fertile window, based on the current CyclePrediction. Dates
 * already in the past (or missing) are skipped. Existing cycle reminders are
 * cancelled first so this stays idempotent when predictions are recomputed.
 */
export async function scheduleCyclePredictionReminders(
  prediction: CyclePrediction
): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelStoredIds(CYCLE_REMINDER_IDS_KEY);

  const identifiers: string[] = [];

  if (prediction.nextPeriodStart) {
    const daysUntil = daysFromToday(prediction.nextPeriodStart) - CYCLE_PERIOD_REMINDER_DAYS_BEFORE;
    if (daysUntil > 0) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Period expected soon",
          body: `Your next period is predicted to start in about ${CYCLE_PERIOD_REMINDER_DAYS_BEFORE} days.`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: daysUntil * 86400,
          repeats: false,
        },
      });
      identifiers.push(identifier);
    }
  }

  if (prediction.fertileWindowStart) {
    const daysUntil =
      daysFromToday(prediction.fertileWindowStart) - CYCLE_FERTILE_REMINDER_DAYS_BEFORE;
    if (daysUntil > 0) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Fertile window approaching",
          body: "Your predicted fertile window starts soon.",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: daysUntil * 86400,
          repeats: false,
        },
      });
      identifiers.push(identifier);
    }
  }

  if (identifiers.length > 0) {
    await AsyncStorage.setItem(CYCLE_REMINDER_IDS_KEY, JSON.stringify(identifiers));
  }
}

/** Cancels all scheduled cycle prediction reminders, if any. */
export async function cancelCyclePredictionReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelStoredIds(CYCLE_REMINDER_IDS_KEY);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/** Cancels every reminder tracked by this module (check-in, medications, cycle). */
export async function cancelAllScheduledReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all([
    cancelStoredIds(CHECKIN_REMINDER_KEY),
    cancelStoredIds(MEDICATION_REMINDER_IDS_KEY),
    cancelStoredIds(CYCLE_REMINDER_IDS_KEY),
  ]);
}
