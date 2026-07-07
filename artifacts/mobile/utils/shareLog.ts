import AsyncStorage from "@react-native-async-storage/async-storage";

import { generateId, type ShareLogEntry } from "@/types/health";

/**
 * Local audit log of provider-report shares.
 *
 * Nothing here talks to a network — this is purely an on-device record of
 * "a report left this device, stamped with this verification code, on this
 * date, containing these sections". It exists so the user can see (and
 * clear) a trail of what they've shared, not to enforce or verify anything
 * remotely.
 */

const SHARE_LOG_KEY = "@luminara_share_log";

async function readAll(): Promise<ShareLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SHARE_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ShareLogEntry[];
  } catch {
    return [];
  }
}

async function writeAll(entries: ShareLogEntry[]): Promise<void> {
  await AsyncStorage.setItem(SHARE_LOG_KEY, JSON.stringify(entries));
}

/** Newest-first list of every report share recorded on this device. */
export async function listShareLog(): Promise<ShareLogEntry[]> {
  const entries = await readAll();
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Append a new audit entry and return it (with id/createdAt filled in). */
export async function addShareLogEntry(
  entry: Omit<ShareLogEntry, "id" | "createdAt">
): Promise<ShareLogEntry> {
  const full: ShareLogEntry = {
    ...entry,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  const existing = await readAll();
  await writeAll([...existing, full]);
  return full;
}

/** Wipe the entire share audit trail. */
export async function clearShareLog(): Promise<void> {
  await AsyncStorage.removeItem(SHARE_LOG_KEY);
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function randomSegment(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

/**
 * Human-readable verification code stamped into a shared report, e.g.
 * "LMN-4F8-K2Q". This is a verification stamp the patient and provider can
 * both glance at to confirm a printed/shared report matches the app's audit
 * log — it is not a secret or an access token, so Math.random is fine here.
 */
export function generateShareCode(): string {
  return `LMN-${randomSegment(3)}-${randomSegment(3)}`;
}
