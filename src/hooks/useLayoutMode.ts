import { useSyncExternalStore } from 'react'

/**
 * Desktop-only responsive rules. The top bar has a fixed shopping list of
 * controls that must never wrap or clip, so as the window narrows the least
 * important pieces drop out in a fixed order:
 *
 *   < 1240  the brand tagline goes
 *   < 1120  bar padding and gaps tighten, the search box shrinks
 *   < 1040  the KO/EN toggle goes (it is also in Settings → Language)
 *
 * Below that the window's own minimum width takes over — this is a desktop
 * app, not a phone.
 */
export const BREAKPOINT = {
  compact: 1240,
  tight: 1120,
  narrow: 1040,
} as const

export interface LayoutMode {
  width: number
  /** Hide decorative text. */
  compact: boolean
  /** Tighten spacing. */
  tight: boolean
  /** Drop duplicated controls. */
  narrow: boolean
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

export function useViewportWidth(): number {
  // Only re-renders when the number actually changes.
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => BREAKPOINT.compact,
  )
}

export function useLayoutMode(): LayoutMode {
  const width = useViewportWidth()
  return {
    width,
    compact: width < BREAKPOINT.compact,
    tight: width < BREAKPOINT.tight,
    narrow: width < BREAKPOINT.narrow,
  }
}
