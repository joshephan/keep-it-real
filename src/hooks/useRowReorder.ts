import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * Drag-to-reorder for a short vertical list.
 *
 * Each crossing is committed as it happens rather than on drop, so the rows on
 * screen are always the real order and letting go is not a separate step. The
 * list keeps its normal flow layout — nothing is lifted out of it — which is why
 * a row moves the moment the pointer is over its neighbour.
 *
 * Rows are found by their `data-reorder-row` attribute, so the caller stays free
 * to lay them out however it likes.
 */

export const REORDER_ROW_ATTR = 'data-reorder-row'

/** The row the pointer is over, clamped to the ends so a fast drag still lands. */
function rowIndexAt(list: HTMLElement | null, y: number): number | null {
  const rows = list ? Array.from(list.querySelectorAll<HTMLElement>(`[${REORDER_ROW_ATTR}]`)) : []
  if (!rows.length) return null
  for (let i = 0; i < rows.length; i++) {
    if (y < rows[i].getBoundingClientRect().bottom) return i
  }
  return rows.length - 1
}

export function useRowReorder(onMove: (from: number, to: number) => void) {
  const listRef = useRef<HTMLDivElement | null>(null)
  // Held in a ref as well as state: the window listeners below read the live
  // index, while the state drives the dragged row's own styling.
  const gesture = useRef<{ pointerId: number; index: number } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const start = useCallback(
    (index: number) => (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      // Without this the press starts a text selection that follows the drag.
      e.preventDefault()
      gesture.current = { pointerId: e.pointerId, index }
      setDragging(index)
    },
    [],
  )

  // Listening on the window rather than capturing the handle: the handle is
  // moved around the DOM mid-gesture, and a drag that leaves the drawer must
  // still end when the button comes up.
  useEffect(() => {
    if (dragging === null) return

    const move = (e: PointerEvent): void => {
      const g = gesture.current
      if (!g || e.pointerId !== g.pointerId) return
      const to = rowIndexAt(listRef.current, e.clientY)
      if (to === null || to === g.index) return
      onMove(g.index, to)
      // The dragged row is now at `to`, so the next crossing is measured from there.
      g.index = to
      setDragging(to)
    }
    const end = (): void => {
      gesture.current = null
      setDragging(null)
    }

    const previousSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      document.body.style.userSelect = previousSelect
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [dragging, onMove])

  /** Arrow keys do the same thing from the keyboard, one step at a time. */
  const nudge = useCallback(
    (index: number, e: React.KeyboardEvent): void => {
      const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
      if (!step) return
      e.preventDefault()
      onMove(index, index + step)
    },
    [onMove],
  )

  return { listRef, dragging, start, nudge }
}
