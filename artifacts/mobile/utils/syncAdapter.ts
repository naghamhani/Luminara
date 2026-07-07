import type { HealthSnapshot } from "@/types/health";

/**
 * Sync preparation layer — docs-as-code, NO network calls.
 * ---------------------------------------------------------------------------
 *
 * Luminara is local-first today: every record, lab result, cycle entry,
 * medication and partner observation lives only in this device's storage
 * (see context/HealthContext.tsx and utils/encryption.ts). This file exists
 * so the rest of the app can already be written against a stable `SyncAdapter`
 * interface, while the actual implementation stays a deliberate no-op until
 * a backend is built and reviewed. Swapping `activeSyncAdapter` for a real
 * implementation should not require touching any calling code.
 *
 * What a future HIPAA-ready backend would need before this becomes real:
 *
 * 1. Transport security (TLS)
 *    - All requests over TLS 1.2+ with certificate pinning on mobile.
 *    - No plaintext fallback, no mixed content, HSTS on any web surface.
 *
 * 2. End-to-end encryption of the snapshot
 *    - The HealthSnapshot payload must be encrypted on-device with the same
 *      (or a derived) key already used for at-rest encryption in
 *      utils/encryption.ts before it ever leaves the phone.
 *    - The server should ideally only ever see ciphertext — i.e. true
 *      end-to-end encryption, not just encryption-in-transit — so a server
 *      compromise does not expose plaintext health data.
 *    - Key management: the on-device key must never be transmitted; any
 *      multi-device sync would need a secure key-exchange/wrapping scheme
 *      (e.g. wrapping the data key with a passphrase- or device-derived key)
 *      rather than shipping the raw key to the server.
 *
 * 3. BAA-covered hosting
 *    - Any backend, storage, logging, or analytics vendor that touches
 *      identifiable health data needs a signed Business Associate Agreement
 *      (BAA) under HIPAA, or equivalent data-processing agreement for
 *      non-US jurisdictions (e.g. GDPR Article 28 for EU users).
 *    - Data residency and backup locations must be documented and
 *      contractually constrained.
 *
 * 4. Audit logging
 *    - Every read/write of a user's synced health data on the server side
 *      must be logged (who/what/when), immutable, and reviewable — mirroring
 *      the on-device share audit trail in utils/shareLog.ts but for
 *      server-side access rather than local PDF shares.
 *    - Logs themselves must not contain plaintext health content.
 *
 * 5. Token auth
 *    - Short-lived access tokens + refresh tokens (e.g. OAuth2 / OIDC),
 *      never long-lived static API keys embedded in the app.
 *    - Tokens scoped per-user and per-device, revocable from a settings
 *      screen, and invalidated immediately on logout / account deletion.
 *
 * Until all of the above exists and has been through a security review,
 * `activeSyncAdapter` must remain `LocalOnlyAdapter` — copy stays honest:
 * "private by design — your data stays on this device."
 */

export interface SyncAdapter {
  readonly name: string;
  /** Push a full local snapshot to the remote store. No-op until a backend exists. */
  pushSnapshot(snapshot: HealthSnapshot): Promise<{ ok: boolean; message: string }>;
  /** Pull the latest remote snapshot, or null if there is none / sync is disabled. */
  pullSnapshot(): Promise<HealthSnapshot | null>;
}

/**
 * The only adapter that ships today. It makes zero network calls and always
 * reports that sync is unavailable, so callers can safely wire up sync UI
 * ahead of time without accidentally leaking data anywhere.
 */
export class LocalOnlyAdapter implements SyncAdapter {
  readonly name = "local-only";

  async pushSnapshot(
    _snapshot: HealthSnapshot
  ): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message: "Sync is not enabled in this build — data is local-only.",
    };
  }

  async pullSnapshot(): Promise<HealthSnapshot | null> {
    return null;
  }
}

export const activeSyncAdapter: SyncAdapter = new LocalOnlyAdapter();
