import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react'
import { initialState, reducer, toPersisted, type Action, type State } from './reducer'
import { loadState, onExternalChange, saveState } from '../lib/storage'
import { strings, type Strings } from '../i18n'
import { todayISO } from '../lib/date'

interface AppContextValue {
  state: State
  dispatch: Dispatch<Action>
  t: Strings
  /** Today's date, refreshed if the app is left open across midnight. */
  today: string
}

const AppContext = createContext<AppContextValue | null>(null)

const SAVE_DEBOUNCE_MS = 150

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const today = useToday()

  // Read persisted state once on mount.
  useEffect(() => {
    let cancelled = false
    void loadState().then((payload) => {
      if (!cancelled) dispatch({ type: 'hydrate', payload })
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The MCP server edits the same file. Reading it back keeps the window honest
  // and stops the next save from burying whatever was written there.
  useEffect(() =>
    onExternalChange(() => {
      void loadState().then((payload) => {
        if (payload) dispatch({ type: 'hydrate', payload })
      })
    }),
  [])

  // Persist after every mutating action (debounced), never before hydration.
  useEffect(() => {
    if (!state.hydrated) return
    const handle = setTimeout(() => {
      void saveState(toPersisted(state))
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(handle)
    // Every field `toPersisted` reads is listed, so the closure it captures can
    // never hold a stale copy of anything that actually gets written.
  }, [
    state.hydrated,
    state.items,
    state.cats,
    state.langPref,
    state.view,
    state.colScale,
    state.showDiff,
    state.showWeekend,
  ])

  // Keeps <html lang> matching what is actually on screen.
  useEffect(() => {
    document.documentElement.lang = state.lang
  }, [state.lang])

  const t = useMemo(() => strings(state.lang), [state.lang])
  const value = useMemo<AppContextValue>(() => ({ state, dispatch, t, today }), [state, t, today])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/** Keeps "today" honest when the app is left running past midnight. */
function useToday(): string {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const id = setInterval(() => {
      const now = todayISO()
      setToday((prev) => (prev === now ? prev : now))
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
