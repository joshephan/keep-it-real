import type {
  CatFilter,
  Category,
  CategoryId,
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

export interface State {
  /** False until the persisted state has been read back. */
  hydrated: boolean
  items: Item[]
  cats: Category[]
  lang: Lang
  showDiff: boolean
  showWeekend: boolean
  /** Ephemeral UI state — never persisted. */
  view: ViewMode
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
  lang: 'ko',
  showDiff: true,
  showWeekend: true,
  view: 'week',
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
  | { type: 'setLang'; lang: Lang }
  | { type: 'toggleDiff' }
  | { type: 'toggleWeekend' }
  | { type: 'setQuery'; query: string }
  | { type: 'setCat'; cat: CatFilter }
  | { type: 'openForm'; draft: FormDraft }
  | { type: 'patchForm'; patch: Partial<FormDraft> }
  | { type: 'closeForm' }
  | { type: 'saveForm'; newId: string }
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

export function newDraft(kind: Track, date: string, cat: CategoryId): FormDraft {
  return { id: null, kind, title: '', cat, start: date, end: date, note: '', single: true }
}

export function editDraft(item: Item): FormDraft {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    cat: item.cat,
    start: item.start,
    end: item.end || item.start,
    note: item.note ?? '',
    single: !item.end || item.end === item.start,
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
        lang: p.lang,
        showDiff: p.showDiff,
        showWeekend: p.showWeekend,
      }
    }

    case 'setView':
      return { ...state, view: action.view }
    case 'setLang':
      return { ...state, lang: action.lang }
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

      if (f.id) {
        const items = state.items.map((i) =>
          i.id === f.id
            ? { ...i, title: f.title.trim(), cat: f.cat, start: f.start, end, note: f.note, kind: f.kind }
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
        note: f.note,
        done: false,
        actualId: null,
        sourceId: null,
        deleted: false,
        deletedAt: null,
      }
      return { ...state, items: [...state.items, item], form: null }
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
