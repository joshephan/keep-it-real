export type Track = 'actual' | 'plan'
export type CategoryId = string
export type ViewMode = 'day' | 'week' | 'month'
export type Lang = 'ko' | 'en'
export type CatFilter = 'all' | CategoryId

/**
 * Categories are user data: renameable, recolourable, addable, removable.
 * `name: null` means "use the built-in bilingual label for this id", which is
 * how the five defaults keep translating until the user renames one.
 */
export interface Category {
  id: CategoryId
  name: string | null
  color: string
}

/** A single record on either track. `YYYY-MM-DD` strings everywhere — no time zones, no clock. */
export interface Item {
  id: string
  kind: Track
  title: string
  cat: CategoryId
  start: string
  /** Equal to `start` for single-day items. */
  end: string
  note: string
  /** Plan only: this plan has been promoted into the actual track. */
  done: boolean
  /** Plan only: id of the actual copy created by promotion. */
  actualId: string | null
  /** Actual only: id of the plan this was promoted from. */
  sourceId: string | null
  deleted: boolean
  deletedAt: string | null
}

/** Draft held by the shared item modal — both tracks use this one shape. */
export interface FormDraft {
  id: string | null
  kind: Track
  title: string
  cat: CategoryId
  start: string
  end: string
  note: string
  single: boolean
}

/** Draft held by the promote modal. The plan record itself is never touched here. */
export interface PromoteDraft {
  id: string
  name: string
  planRange: string
  planEnd: string
  start: string
  end: string
}

export interface PersistedState {
  version: 1
  items: Item[]
  cats: Category[]
  lang: Lang
  showDiff: boolean
  showWeekend: boolean
}
