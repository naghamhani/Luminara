/**
 * In-memory (never persisted) flag marking that the partner PIN was verified
 * during THIS app session. Used by app/partner/dashboard.tsx to reject direct
 * navigation (deep link, typed URL, stray router.push) that skips the PIN
 * check in app/partner/index.tsx.
 *
 * Deliberately not AsyncStorage/SecureStore: persisting this would let one PIN
 * entry unlock the partner space forever across app restarts. A plain module
 * variable resets to false on every cold start / full page reload for free.
 *
 * Also reset whenever the top-level partner gateway (app/partner/index.tsx)
 * mounts fresh, so leaving the partner space and returning later requires
 * re-entering the PIN rather than staying unlocked for the rest of the
 * session.
 */
let verified = false;

export function markPartnerVerified(): void {
  verified = true;
}

export function isPartnerVerified(): boolean {
  return verified;
}

export function clearPartnerVerification(): void {
  verified = false;
}
