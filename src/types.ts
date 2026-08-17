export type Track = 'actual' | 'plan'
export type CategoryId = string
export type ViewMode = 'day' | 'week' | 'month' | 'year'
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

/**
 * A single record on either track. Dates are local `YYYY-MM-DD` strings — no
 * time zones. Times are optional `HH:MM` strings: an item without them is an
 * all-day item, which stays the default.
 */
export interface Item {
  id: string
  kind: Track
  title: string
  cat: CategoryId
  start: string
  /** Equal to `start` for single-day items. */
  end: string
  /** `HH:MM` on the start date, or null for an all-day item. */
  startTime: string | null
  /** `HH:MM` on the end date, or null when no end time was given. */
  endTime: string | null
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
  /** Off by default — the time inputs only appear once the user asks for them. */
  timed: boolean
  /** Kept while `timed` is off so toggling back restores what was typed. */
  startTime: string
  endTime: string
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
  view: ViewMode
  showDiff: boolean
  showWeekend: boolean
}
