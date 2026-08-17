import type { PersistedState } from '../types'
import { normalize } from './storage'

/**
 * Export/import file format. The whole store travels in one JSON file — items,
 * categories and settings — wrapped in an envelope that says what it is, so
 * picking the wrong file fails loudly instead of quietly emptying the timeline.
 */

export const BACKUP_FORMAT = 'keep-it-real.backup'

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: 1
  /** `YYYY-MM-DD`, for the person reading the file later — nothing reads it back. */
  exportedAt: string
  state: PersistedState
}

export function buildBackup(state: PersistedState, exportedAt: string): BackupFile {
  return { format: BACKUP_FORMAT, version: 1, exportedAt, state }
}

/** Pretty-printed on purpose: the file is meant to stay readable and diffable. */
export function serializeBackup(state: PersistedState, exportedAt: string): string {
  return JSON.stringify(buildBackup(state, exportedAt), null, 2)
}

export function backupFileName(date: string): string {
  return `keep-it-real-${date}.json`
}

/**
 * Reads either a file written by Export or the app's own `keep-it-real.json`,
 * so a store copied off another machine imports just as well. Returns null for
 * anything else — including valid JSON that simply is not a store.
 */
export function parseBackup(text: string): PersistedState | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null

  const envelope = raw as Record<string, unknown>
  const body = envelope.format === BACKUP_FORMAT ? envelope.state : raw
  // An items array is the one thing both shapes must have. Without that check
  // any JSON object would normalize into an empty store and wipe the timeline.
  if (!body || typeof body !== 'object') return null
  if (!Array.isArray((body as Record<string, unknown>).items)) return null

  return normalize(body)
}

/** What the import confirmation counts — the items the user would actually see. */
export function liveItemCount(state: PersistedState): number {
  return state.items.filter((i) => !i.deleted).length
}
