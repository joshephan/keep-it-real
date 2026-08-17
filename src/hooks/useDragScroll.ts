import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

/** How far the pointer may travel before the gesture stops being a click. */
const DRAG_THRESHOLD = 4

interface DragState {
  active: boolean
  moved: boolean
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
  lane: HTMLElement | null
}

const idle = (): DragState => ({
  active: false,
  moved: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
  scrollTop: 0,
  lane: null,
})

/**
 * Grab-and-drag panning for the timeline: horizontal on the shared scroller,
 * vertical on whichever lane the gesture started in.
 *
 * A press that never travels past `DRAG_THRESHOLD` is left alone so the cell
 * and bar click handlers still fire; past it, `didDrag()` stays true until the
 * next press so those handlers can bail out of the click that follows the drag.
 */
export function useDragScroll(scrollerRef: RefObject<HTMLDivElement | null>) {
  const drag = useRef<DragState>(idle())
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Any fresh press ends the previous gesture's click suppression, even one
      // this handler goes on to ignore — otherwise a pan followed by a click on
      // a bar would swallow that click.
      drag.current = idle()

      // Left button only, and never steal a press aimed at a control, or at a
      // bar, which pans nothing and drags itself instead.
      if (e.button !== 0 || e.pointerType !== 'mouse') return
      const target = e.target as HTMLElement
      if (target.closest('button, input, textarea, select, a, [data-bar]')) return

      const scroller = scrollerRef.current
      if (!scroller) return

      const lane = target.closest('[data-lane]') as HTMLElement | null
      drag.current = {
        active: true,
        moved: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: scroller.scrollLeft,
        scrollTop: lane?.scrollTop ?? 0,
        lane,
      }
      // No pointer capture yet: capturing here would retarget the following
      // `click` to this element and break plain cell/bar clicks. It is taken
      // in onPointerMove, once the gesture is unambiguously a drag.
    },
    [scrollerRef],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const state = drag.current
      if (!state.active || e.pointerId !== state.pointerId) return

      const dx = e.clientX - state.startX
      const dy = e.clientY - state.startY
      if (!state.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        state.moved = true
        setDragging(true)
        // Now that this is a drag: keep receiving moves if the pointer leaves
        // the scroller, and let the trailing click retarget here instead of a
        // cell or bar.
        e.currentTarget.setPointerCapture(e.pointerId)
      }

      const scroller = scrollerRef.current
      if (scroller) scroller.scrollLeft = state.scrollLeft - dx
      if (state.lane) state.lane.scrollTop = state.scrollTop - dy
    },
    [scrollerRef],
  )

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state.active || e.pointerId !== state.pointerId) return
    state.active = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    // `state.moved` is intentionally left set: the click event that follows
    // reads it through didDrag() and is discarded.
  }, [])

  const didDrag = useCallback(() => drag.current.moved, [])

  return {
    dragging,
    didDrag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}
