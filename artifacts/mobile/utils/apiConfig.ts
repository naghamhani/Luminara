/**
 * Backend configuration for the mobile app.
 *
 * The API server (PPD risk model, companion chatbot, anonymized research
 * ingestion) is optional: when EXPO_PUBLIC_API_URL is not set, the app stays
 * fully local-first and the server-backed features surface a friendly
 * "not configured" state instead of erroring.
 *
 * Set it per environment, e.g. in an `.env` picked up by Expo:
 *   EXPO_PUBLIC_API_URL=http://localhost:4000
 */

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export function isBackendConfigured(): boolean {
  return API_BASE_URL.length > 0;
}
