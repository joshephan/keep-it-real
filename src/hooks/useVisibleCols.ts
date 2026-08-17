import { useLayoutEffect, useMemo, useState, type RefObject } from 'react'

/**
 * Pixels kept rendered beyond each edge of the viewport. The margin absorbs a
 * fast flick and a bar dragged sideways, so nothing appears out of nowhere.
 */
const OVERSCAN = 900

/**
 * The window only moves in steps this size. Scrolling within one step changes
 * nothing to render, so most scroll events cost a comparison and no re-render.
 */
const STEP = 300

/** The slice of the track that is worth putting in the DOM. */
export interface ColRange {
  /** Column indices to render: `from` inclusive, `to` exclusive. */
  from: number
  to: number
  /** The same window in track pixels, for culling bars. */
  left: number
  right: number
}

/**
 * Which columns the scroller is actually looking at. The timeline can be tens
 * of thousands of columns wide once the axis has grown, and rendering all of
 * them is what makes it crawl — so only this window is drawn, the rest of the
 * width being held open by the track's own `width`.
 */
export function useVisibleCols(
  ref: RefObject<HTMLDivElement | null>,
  colW: number,
  count: number,
): ColRange {
  const [win, setWin] = useState({ left: 0, right: STEP })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const left = Math.floor((el.scrollLeft - OVERSCAN) / STEP) * STEP
      const right = Math.ceil((el.scrollLeft + el.clientWidth + OVERSCAN) / STEP) * STEP
      // Same window as last time: bail out before touching state, so a scroll
      // that stays inside the current step never re-renders the timeline.
      setWin((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    // The window is also wrong after a resize, which fires no scroll event.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [ref])

  return useMemo(() => {
    const left = Math.max(0, win.left)
    const right = Math.min(count * colW, Math.max(left, win.right))
    return {
      from: Math.max(0, Math.floor(left / colW)),
      to: Math.min(count, Math.ceil(right / colW)),
      left,
      right,
    }
  }, [win, colW, count])
}
