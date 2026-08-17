import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Item } from '../types'
import { shiftByColumns, type Axis } from '../lib/axis'

/** How far the pointer may travel before the press stops being a click. */
const DRAG_THRESHOLD = 4

interface Gesture {
  id: string
  pointerId: number
  active: boolean
  moved: boolean
  startX: number
  /** Column offsets that keep the bar inside the axis, either side of zero. */
  min: number
  max: number
}

/** Where the bar currently under the pointer would land if dropped now. */
export interface BarPreview {
  id: string
  cols: number
  start: string
  end: string
}

export interface BarDragHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void
}

/**
 * Sideways drag-to-reschedule for the timeline bars. The gesture snaps to whole
 * columns, so a drag in the day view moves the item by days and the same drag
 * in the month view moves it by months; either way the item keeps its span.
 *
 * Nothing here knows about plan/actual pairing on purpose — `onMove` is handed a
 * single id, so dragging one half of a promoted pair never disturbs the other.
 *
 * Like the panning gesture, a press that never travels past `DRAG_THRESHOLD` is
 * left alone so the bar's click handler still opens the editor; past it,
 * `didDragBar()` stays true until the next press so that click can be dropped.
 */
export function useBarDrag(
  axis: Axis,
  onMove: (id: string, start: string, end: string) => void,
) {
  const gesture = useRef<Gesture | null>(null)
  const preview = useRef<BarPreview | null>(null)
  const [shown, setShown] = useState<BarPreview | null>(null)

  const show = (next: BarPreview | null) => {
    preview.current = next
    setShown(next)
  }

  const end = (e: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const g = gesture.current
    if (!g || !g.active || e.pointerId !== g.pointerId) return
    g.active = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const p = preview.current
    show(null)
    // `g.moved` is intentionally left set: the click that follows reads it
    // through didDragBar() and is discarded.
    if (commit && g.moved && p && p.id === g.id && p.cols !== 0) onMove(p.id, p.start, p.end)
  }

  const handlers = (item: Item): BarDragHandlers => ({
    onPointerDown: (e) => {
      // Left button only, and never steal a press aimed at a control such as
      // the plan bar's complete button.
      if (e.button !== 0 || e.pointerType !== 'mouse') return
      if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return
      gesture.current = {
        id: item.id,
        pointerId: e.pointerId,
        active: true,
        moved: false,
        startX: e.clientX,
        min: -axis.colIndex(item.start),
        max: axis.cols.length - 1 - axis.colIndex(item.end || item.start),
      }
      // No pointer capture yet: taking it here would retarget the following
      // `click` and break a plain click on the bar. It is taken in the move
      // handler, once the gesture is unambiguously a drag.
    },

    onPointerMove: (e) => {
      const g = gesture.current
      if (!g || !g.active || g.id !== item.id || e.pointerId !== g.pointerId) return
      const dx = e.clientX - g.startX
      if (!g.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return
        g.moved = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      const cols = Math.min(g.max, Math.max(g.min, Math.round(dx / axis.colW)))
      // Between column boundaries there is nothing new to draw.
      if (preview.current?.id === item.id && preview.current.cols === cols) return
      show({ id: item.id, cols, ...shiftByColumns(item, axis.view, cols) })
    },

    onPointerUp: (e) => end(e, true),
    onPointerCancel: (e) => end(e, false),
  })

  return {
    /** Set only while a bar is being dragged past the threshold. */
    preview: shown,
    handlers,
    didDragBar: () => gesture.current?.moved ?? false,
  }
}
