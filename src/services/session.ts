// Session state lives ONLY on this device, for the duration of this session.
//
// We use sessionStorage (not localStorage, not a cookie, not a server) so the
// data naturally disappears when the tab is closed, and we clear it explicitly
// when the patient ends the session. There is no patient account, no history,
// no database, and no persistent patient ID.

import type { Handover } from '../types'

const STORAGE_KEY = 'kabla.session.v1'

export type PersistedSession = {
  screen: string
  handover: Handover
}

/** Generate a random-looking 3-digit handover number (NOT an account ID). */
export function generateSessionNumber(): string {
  // 1..999, zero-padded to three digits. Purely local, never sent anywhere.
  const n = Math.floor(Math.random() * 999) + 1
  return String(n).padStart(3, '0')
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed || typeof parsed.handover !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function saveSession(session: PersistedSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage may be unavailable (private mode / quota). The app still works
    // fully in-memory for the active session; we simply skip persistence.
  }
}

/** Remove all patient information from this device. */
export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing persisted — nothing to clear.
  }
}
