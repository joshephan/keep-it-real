import type {
  CatFilter,
  Category,
  CategoryId,
  ColScale,
  FormDraft,
  Item,
  Lang,
  PersistedState,
  PromoteDraft,
  Track,
  ViewMode,
} from '../types'
import { diffDays } from '../lib/date'
import { defaultCategories } from '../lib/categories'
import { EXPAND_MONTHS, NO_PAD, type AxisPad } from '../lib/axis'
import { systemLang } from '../lib/locale'
import { clampColScale, defaultColScale } from '../tokens'

export interface State {
  /** False until the persisted state has been read back. */
  hydrated: boolean
  items: Item[]
  cats: Category[]
  /** The language in use: whatever was picked in Settings, or the desktop's. */
  lang: Lang
  /** Only a deliberate pick is remembered; null keeps following the desktop. */
  langPref: Lang | null
  /** Day / week / month / year zoom, remembered across restarts. */
  view: ViewMode
  /** Column width multiplier, kept per view and remembered across restarts. */
  colScale: ColScale
  showDiff: boolean
  showWeekend: boolean
  /** Ephemeral UI state, never persisted. */
  /** Months the axis has grown past its default window, in each direction. */
  axisPad: AxisPad
  query: string
  cat: CatFilter
  form: FormDraft | null
  promote: PromoteDraft | null
  trashOpen: boolean
  settingsOpen: boolean
}

export const initialState: State = {
  hydrated: false,
  items: [],
  cats: defaultCategories(),
  lang: systemLang(),
  langPref: null,
  showDiff: true,
  showWeekend: true,
  view: 'week',
  colScale: defaultColScale(),
  axisPad: NO_PAD,
  query: '',
  cat: 'all',
  form: null,
  promote: null,
  trashOpen: false,
  settingsOpen: false,
}

export type Action =
  | { type: 'hydrate'; payload: PersistedState | null }
  | { type: 'setView'; view: ViewMode }
  /** Column width for the view currently on screen. */
  | { type: 'setColScale'; scale: number }
  | { type: 'expandAxis'; direction: 'past' | 'future' }
  | { type: 'setAxisPad'; pad: AxisPad }
  | { type: 'setLang'; lang: Lang }
  | { type: 'toggleDiff' }
  | { type: 'toggleWeekend' }
  | { type: 'setQuery'; query: string }
  | { type: 'setCat'; cat: CatFilter }
  | { type: 'openForm'; draft: FormDraft }
  | { type: 'patchForm'; patch: Partial<FormDraft> }
  | { type: 'closeForm' }
  | { type: 'saveForm'; newId: string }
  /** Bar dragged to another column: dates only, nothing else about the item. */
  | { type: 'moveItem'; id: string; start: string; end: string }
  | { type: 'trashItem'; at: string }
  | { type: 'unpromote' }
  | { type: 'openPromote'; draft: PromoteDraft }
  | { type: 'patchPromote'; patch: Partial<PromoteDraft> }
  | { type: 'closePromote' }
  | { type: 'confirmPromote'; newId: string }
  | { type: 'restore'; id: string }
  | { type: 'purge'; id: string }
  | { type: 'emptyTrash' }
  | { type: 'setTrashOpen'; open: boolean }
  | { type: 'setSettingsOpen'; open: boolean }
  | { type: 'addCategory'; category: Category }
  | { type: 'patchCategory'; id: CategoryId; patch: Partial<Omit<Category, 'id'>> }
  | { type: 'removeCategory'; id: CategoryId }
  | { type: 'loadSample'; items: Item[] }
  | { type: 'resetAll' }

/** A draft is saveable when it has a title, a note, or both. */
export function hasContent(draft: Pick<FormDraft, 'title' | 'note'>): boolean {
  return draft.title.trim().length > 0 || draft.note.trim().length > 0
}

/** End date can never precede the start date. */
function normalizeEnd(start: string, end: string, single: boolean): string {
  if (single) return start
  return diffDays(start, end) < 0 ? start : end
}

/** What the time inputs are seeded with the first time they are opened. */
export const DEFAULT_START_TIME = '09:00'
export const DEFAULT_END_TIME = '10:00'

/**
 * Within one day an end time can never precede the start time; across days the
 * dates carry the ordering, so any pair is legal.
 */
function normalizeEndTime(draft: FormDraft): string {
  if (!draft.single || !draft.startTime || !draft.endTime) return draft.endTime
  return draft.endTime < draft.startTime ? draft.startTime : draft.endTime
}

export function newDraft(kind: Track, date: string, cat: CategoryId): FormDraft {
  return {
    id: null,
    kind,
    title: '',
    cat,
    start: date,
    end: date,
    note: '',
    single: true,
    timed: false,
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
  }
}

export function editDraft(item: Item): FormDraft {
  const timed = !!(item.startTime || item.endTime)
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    cat: item.cat,
    start: item.start,
    end: item.end || item.start,
    note: item.note ?? '',
    single: !item.end || item.end === item.start,
    timed,
    startTime: item.startTime ?? (timed ? '' : DEFAULT_START_TIME),
    endTime: item.endTime ?? (timed ? '' : DEFAULT_END_TIME),
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate': {
      const p = action.payload
      if (!p) return { ...state, hydrated: true }
      return {
        ...state,
        hydrated: true,
        items: p.items,
        cats: p.cats.length ? p.cats : defaultCategories(),
        // A store with no language in it keeps following the desktop.
        lang: p.lang ?? systemLang(),
        langPref: p.lang,
        view: p.view,
        colScale: p.colScale,
        showDiff: p.showDiff,
        showWeekend: p.showWeekend,
      }
    }

    case 'setView':
      // Column scale changes completely, and the timeline recentres on today,
      // so however far the old view had been scrolled no longer means anything.
      return { ...state, view: action.view, axisPad: NO_PAD }

    case 'setColScale':
      return {
        ...state,
        colScale: { ...state.colScale, [state.view]: clampColScale(action.scale) },
      }

    case 'expandAxis': {
      const step = EXPAND_MONTHS[state.view]
      const pad = state.axisPad
      return {
        ...state,
        axisPad:
          action.direction === 'past'
            ? { ...pad, past: pad.past + step }
            : { ...pad, future: pad.future + step },
      }
    }

    case 'setAxisPad':
      return { ...state, axisPad: action.pad }
    case 'setLang':
      return { ...state, lang: action.lang, langPref: action.lang }
    case 'toggleDiff':
      return { ...state, showDiff: !state.showDiff }
    case 'toggleWeekend':
      return { ...state, showWeekend: !state.showWeekend }
    case 'setQuery':
      return { ...state, query: action.query }
    case 'setCat':
      return { ...state, cat: action.cat }

    case 'openForm':
      return { ...state, form: action.draft }
    case 'patchForm': {
      if (!state.form) return state
      const next = { ...state.form, ...action.patch }
      // Single-day items keep end pinned to start.
      if (next.single) next.end = next.start
      // …and their end time pinned no earlier than the start time.
      next.endTime = normalizeEndTime(next)
      return { ...state, form: next }
    }
    case 'closeForm':
      return { ...state, form: null }

    case 'saveForm': {
      const f = state.form
      if (!f) return state
      // A title is optional as long as there is a note to identify the item by;
      // with neither, there is nothing to save and the modal just closes.
      if (!hasContent(f)) return { ...state, form: null }
      const end = normalizeEnd(f.start, f.end, f.single)
      // Turning the time off discards the clock entirely: the item goes back to
      // being an all-day one, which is what an empty time input means too.
      const startTime = f.timed && f.startTime ? f.startTime : null
      const endTime = f.timed && f.endTime ? normalizeEndTime(f) : null

      if (f.id) {
        const items = state.items.map((i) =>
          i.id === f.id
            ? {
                ...i,
                title: f.title.trim(),
                cat: f.cat,
                start: f.start,
                end,
                startTime,
                endTime,
                note: f.note,
                kind: f.kind,
              }
            : i,
        )
        return { ...state, items, form: null }
      }

      const item: Item = {
        id: action.newId,
        kind: f.kind,
        title: f.title.trim(),
        cat: f.cat,
        start: f.start,
        end,
        startTime,
        endTime,
        note: f.note,
        done: false,
        actualId: null,
        sourceId: null,
        deleted: false,
        deletedAt: null,
      }
      return { ...state, items: [...state.items, item], form: null }
    }

    case 'moveItem': {
      // Only the dragged record moves. A promoted pair is deliberately left
      // unlinked here: dragging the plan is a replan, dragging the actual is a
      // correction, and the drift between them is what the diff is for.
      const items = state.items.map((i) =>
        i.id === action.id ? { ...i, start: action.start, end: action.end } : i,
      )
      return { ...state, items }
    }

    case 'trashItem': {
      const id = state.form?.id
      if (!id) return { ...state, form: null }
      const items = state.items.map((i) =>
        i.id === id ? { ...i, deleted: true, deletedAt: action.at } : i,
      )
      return { ...state, items, form: null }
    }

    case 'unpromote': {
      const id = state.form?.id
      if (!id) return { ...state, form: null }
      const plan = state.items.find((i) => i.id === id)
      if (!plan) return { ...state, form: null }
      const items = state.items
        .filter((i) => i.id !== plan.actualId)
        .map((i) => (i.id === id ? { ...i, done: false, actualId: null } : i))
      return { ...state, items, form: null }
    }

    case 'openPromote':
      return { ...state, promote: action.draft }
    case 'patchPromote': {
      if (!state.promote) return state
      const next = { ...state.promote, ...action.patch }
      // Dragging the start past the end pulls the end along.
      if (diffDays(next.start, next.end) < 0) next.end = next.start
      return { ...state, promote: next }
    }
    case 'closePromote':
      return { ...state, promote: null }

    case 'confirmPromote': {
      const pr = state.promote
      if (!pr) return state
      const plan = state.items.find((i) => i.id === pr.id)
      if (!plan) return { ...state, promote: null }

      const end = diffDays(pr.start, pr.end) < 0 ? pr.start : pr.end
      // Invariant: the plan's own start/end are never touched by promotion.
      const actual: Item = {
        id: action.newId,
        kind: 'actual',
        title: plan.title,
        cat: plan.cat,
        start: pr.start,
        end,
        // The promote modal moves dates only; the plan's clock rides along.
        startTime: plan.startTime,
        endTime: plan.endTime,
        note: plan.note,
        done: false,
        actualId: null,
        sourceId: plan.id,
        deleted: false,
        deletedAt: null,
      }
      const items = [
        ...state.items.map((i) => (i.id === plan.id ? { ...i, done: true, actualId: actual.id } : i)),
        actual,
      ]
      return { ...state, items, promote: null }
    }

    case 'restore':
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, deleted: false, deletedAt: null } : i,
        ),
      }
    case 'purge':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) }
    case 'emptyTrash':
      return { ...state, items: state.items.filter((i) => !i.deleted) }

    case 'setTrashOpen':
      return { ...state, trashOpen: action.open }
    case 'setSettingsOpen':
      return { ...state, settingsOpen: action.open }

    case 'addCategory':
      return { ...state, cats: [...state.cats, action.category] }

    case 'patchCategory':
      return {
        ...state,
        cats: state.cats.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      }

    case 'removeCategory': {
      // Never leave the app with zero categories to assign items to.
      if (state.cats.length <= 1) return state
      const cats = state.cats.filter((c) => c.id !== action.id)
      const fallback = cats[0].id
      return {
        ...state,
        cats,
        items: state.items.map((i) => (i.cat === action.id ? { ...i, cat: fallback } : i)),
        cat: state.cat === action.id ? 'all' : state.cat,
        form: state.form && state.form.cat === action.id ? { ...state.form, cat: fallback } : state.form,
      }
    }

    case 'loadSample':
      return { ...state, items: action.items, cats: defaultCategories(), settingsOpen: false }
    case 'resetAll':
      return {
        ...state,
        items: [],
        cats: defaultCategories(),
        settingsOpen: false,
        form: null,
        promote: null,
      }

    default:
      return state
  }
}
