import AsyncStorage from "@react-native-async-storage/async-storage";
import aesjs from "aes-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Encryption-at-rest helper for sensitive health data.
 *
 * - A single 32-byte data key is generated once and kept in the device
 *   secure store (Keychain / Keystore).
 * - Strings are encrypted with AES-256-CTR and a fresh random 16-byte IV
 *   per call, serialized as "enc1:<hexIv>:<hexCipher>".
 * - decryptString is plaintext-tolerant: payloads that do not carry the
 *   "enc1:" prefix are returned unchanged, so previously unencrypted data
 *   keeps loading during migration.
 */

const DATA_KEY_STORAGE_KEY = "luminara_data_key_v1";
const ENC_PREFIX = "enc1:";

let keyPromise: Promise<Uint8Array> | null = null;

async function readStoredKeyHex(): Promise<string | null> {
  if (Platform.OS === "web") {
    // expo-secure-store is unavailable on web (there is no OS keychain in the
    // browser). We fall back to AsyncStorage (localStorage) so the app still
    // works, but note the limitation: on web the key sits next to the data it
    // protects, so encryption there is obfuscation rather than true
    // at-rest protection. On iOS/Android the key lives in the secure enclave
    // backed Keychain/Keystore.
    return AsyncStorage.getItem(DATA_KEY_STORAGE_KEY);
  }
  return SecureStore.getItemAsync(DATA_KEY_STORAGE_KEY);
}

async function writeStoredKeyHex(hex: string): Promise<void> {
  if (Platform.OS === "web") {
    // See comment in readStoredKeyHex: web has no SecureStore.
    await AsyncStorage.setItem(DATA_KEY_STORAGE_KEY, hex);
    return;
  }
  await SecureStore.setItemAsync(DATA_KEY_STORAGE_KEY, hex);
}

/**
 * Returns the app's 32-byte data key, generating and persisting it on first
 * use. Memoized as a single in-flight promise (not just a cached value) so
 * concurrent first-launch callers — e.g. records and labs both encrypting in
 * the same Promise.all — await the SAME key-creation instead of each
 * generating and persisting its own, which would otherwise leave the two
 * collections encrypted under different keys (only the last write survives
 * in storage, permanently corrupting the other on next decrypt).
 */
export async function getOrCreateDataKey(): Promise<Uint8Array> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const existingHex = await readStoredKeyHex();
      if (existingHex && existingHex.length === 64) {
        return aesjs.utils.hex.toBytes(existingHex);
      }
      const fresh = new Uint8Array(await Crypto.getRandomBytesAsync(32));
      await writeStoredKeyHex(aesjs.utils.hex.fromBytes(fresh));
      return fresh;
    })().catch((err) => {
      // Don't cache a failed attempt forever — let the next call retry.
      keyPromise = null;
      throw err;
    });
  }
  return keyPromise;
}

/** True when the string is an "enc1:" envelope produced by encryptString. */
export function isEncrypted(s: string): boolean {
  return s.startsWith(ENC_PREFIX);
}

/**
 * Encrypts a UTF-8 string with AES-256-CTR using a random 16-byte IV.
 * Output format: "enc1:<hexIv>:<hexCipher>".
 */
export async function encryptString(plain: string): Promise<string> {
  const key = await getOrCreateDataKey();
  const iv = new Uint8Array(await Crypto.getRandomBytesAsync(16));
  const ctr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  const cipherBytes = ctr.encrypt(aesjs.utils.utf8.toBytes(plain));
  return (
    ENC_PREFIX +
    aesjs.utils.hex.fromBytes(iv) +
    ":" +
    aesjs.utils.hex.fromBytes(cipherBytes)
  );
}

/**
 * Decrypts an "enc1:" payload back to plaintext. Inputs that are not in the
 * encrypted envelope format are returned unchanged (plaintext-tolerant, so
 * data written before encryption was enabled still loads).
 */
export async function decryptString(payload: string): Promise<string> {
  if (!isEncrypted(payload)) return payload;

  const parts = payload.split(":");
  // Expected shape: ["enc1", hexIv, hexCipher]
  if (parts.length !== 3 || parts[1].length !== 32) return payload;

  const key = await getOrCreateDataKey();
  const iv = aesjs.utils.hex.toBytes(parts[1]);
  const ctr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  const plainBytes = ctr.decrypt(aesjs.utils.hex.toBytes(parts[2]));
  return aesjs.utils.utf8.fromBytes(plainBytes);
}
