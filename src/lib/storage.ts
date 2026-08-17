import type { Category, ColScale, Item, PersistedState, ViewMode } from '../types'
import { defaultCategories } from './categories'
import { isTime } from './date'
import { clampColScale, defaultColScale } from '../tokens'

const WEB_KEY = 'keepitreal.v1'

export interface AutostartState {
  supported: boolean
  enabled: boolean
}

/** Results of the two native file dialogs, kept flat so both ends agree. */
export type BackupSaveResult =
  | { status: 'saved'; path: string }
  | { status: 'canceled' }
  | { status: 'failed' }

export type BackupOpenResult =
  | { status: 'opened'; text: string; name: string }
  | { status: 'canceled' }
  | { status: 'failed' }

interface KeepItRealApi {
  isElectron: true
  load: () => Promise<unknown | null>
  save: (data: unknown) => Promise<void>
  storePath: () => Promise<string>
  window: (action: 'minimize' | 'toggle-maximize' | 'close') => void
  /** Added after the first release, so a preload from an older build may lack it. */
  onExternalChange?: (listener: () => void) => () => void
  autostart?: {
    get: () => Promise<AutostartState>
    set: (enabled: boolean) => Promise<AutostartState>
  }
  /** Also added later: the browser fallback covers a preload without it. */
  backup?: {
    save: (json: string, suggestedName: string) => Promise<BackupSaveResult>
    open: () => Promise<BackupOpenResult>
  }
}

declare global {
  interface Window {
    keepItReal?: KeepItRealApi
  }
}

export const bridge = (): KeepItRealApi | undefined =>
  typeof window !== 'undefined' ? window.keepItReal : undefined

/** Fills in every field so records written by an older version stay loadable. */
function normalizeItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.title !== 'string' || typeof o.start !== 'string') return null
  return {
    id: o.id,
    kind: o.kind === 'actual' ? 'actual' : 'plan',
    title: o.title,
    cat: typeof o.cat === 'string' && o.cat ? o.cat : 'etc',
    start: o.start,
    end: typeof o.end === 'string' && o.end ? o.end : o.start,
    // Stores written before times existed have neither key: all-day, as before.
    startTime: isTime(o.startTime) ? o.startTime : null,
    endTime: isTime(o.endTime) ? o.endTime : null,
    note: typeof o.note === 'string' ? o.note : '',
    done: o.done === true,
    actualId: typeof o.actualId === 'string' ? o.actualId : null,
    sourceId: typeof o.sourceId === 'string' ? o.sourceId : null,
    deleted: o.deleted === true,
    deletedAt: typeof o.deletedAt === 'string' ? o.deletedAt : null,
  }
}

function normalizeCategory(raw: unknown): Category | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  return {
    id: o.id,
    name: typeof o.name === 'string' ? o.name : null,
    color: typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#4B535C',
  }
}

/** Missing or out-of-range widths fall back to the designed one, per view. */
function normalizeColScale(raw: unknown): ColScale {
  const out = defaultColScale()
  if (!raw || typeof raw !== 'object') return out
  const o = raw as Record<string, unknown>
  for (const view of Object.keys(out) as ViewMode[]) {
    if (typeof o[view] === 'number') out[view] = clampColScale(o[view])
  }
  return out
}

/**
 * Turns anything that parsed as JSON into a state this version can run on, or
 * null if there was no object at all. Exported because an imported backup has
 * to survive exactly the same field-by-field vetting as the store file.
 */
export function normalize(raw: unknown): PersistedState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const items = Array.isArray(o.items)
    ? (o.items.map(normalizeItem).filter(Boolean) as Item[])
    : []
  // Stores written before categories were editable have no `cats` key.
  const cats = Array.isArray(o.cats)
    ? (o.cats.map(normalizeCategory).filter(Boolean) as Category[])
    : []
  return {
    version: 1,
    items,
    cats: cats.length ? cats : defaultCategories(),
    // Absent (or unrecognised) means the user has never picked one.
    lang: o.lang === 'en' || o.lang === 'ko' ? o.lang : null,
    // Stores written before the view was remembered fall back to the default.
    view: o.view === 'day' || o.view === 'month' || o.view === 'year' ? o.view : 'week',
    colScale: normalizeColScale(o.colScale),
    showDiff: o.showDiff !== false,
    showWeekend: o.showWeekend !== false,
  }
}

export async function loadState(): Promise<PersistedState | null> {
  const api = bridge()
  if (api) return normalize(await api.load())
  try {
    const raw = localStorage.getItem(WEB_KEY)
    return raw ? normalize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/**
 * Calls back when the store file was written from outside this window — the MCP
 * server, say. Returns an unsubscribe; in the browser build there is nothing to
 * watch, so it is a no-op.
 */
export function onExternalChange(listener: () => void): () => void {
  return bridge()?.onExternalChange?.(listener) ?? (() => {})
}

export async function saveState(state: PersistedState): Promise<void> {
  const api = bridge()
  if (api) {
    await api.save(state)
    return
  }
  try {
    localStorage.setItem(WEB_KEY, JSON.stringify(state))
  } catch {
    /* storage full or blocked — nothing else to fall back to */
  }
}
