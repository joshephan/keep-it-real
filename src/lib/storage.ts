import type { Category, Item, PersistedState } from '../types'
import { defaultCategories } from './categories'

const WEB_KEY = 'keepitreal.v1'

export interface AutostartState {
  supported: boolean
  enabled: boolean
}

interface KeepItRealApi {
  isElectron: true
  load: () => Promise<unknown | null>
  save: (data: unknown) => Promise<void>
  storePath: () => Promise<string>
  window: (action: 'minimize' | 'toggle-maximize' | 'close') => void
  autostart?: {
    get: () => Promise<AutostartState>
    set: (enabled: boolean) => Promise<AutostartState>
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

function normalize(raw: unknown): PersistedState | null {
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
    lang: o.lang === 'en' ? 'en' : 'ko',
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
