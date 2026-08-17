import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ViewMode } from './types'
import { C, SANS } from './tokens'
import { useApp } from './state/AppContext'
import { createAxis, padToReveal } from './lib/axis'
import { TopBar } from './components/TopBar'
import { FilterBar } from './components/FilterBar'
import { Gutter } from './components/Gutter'
import { Timeline } from './components/Timeline'
import { ItemModal } from './components/ItemModal'
import { PromoteModal } from './components/PromoteModal'
import { TrashDrawer } from './components/TrashDrawer'
import { SettingsDrawer } from './components/SettingsDrawer'

/** How close to an edge a scroll gets before the axis grows, in pixels. */
const EDGE_TRIGGER = 200

export default function App() {
  const { state, dispatch, today } = useApp()
  const scrollerRef = useRef<HTMLDivElement>(null)

  const axis = useMemo(
    () => createAxis(state.view, state.items, today, state.lang, state.axisPad),
    [state.view, state.items, today, state.lang, state.axisPad],
  )

  const centerOn = useCallback(
    (date: string) => {
      const el = scrollerRef.current
      if (!el) return
      el.scrollLeft = Math.max(0, axis.colIndex(date) * axis.colW - el.clientWidth / 2 + axis.colW / 2)
    },
    [axis],
  )

  const centerToday = useCallback(() => centerOn(today), [centerOn, today])

  /** Set while an expansion is in flight so one gesture cannot queue several. */
  const expanding = useRef(false)
  /** A date to centre on once the axis has grown far enough to contain it. */
  const pendingJump = useRef<string | null>(null)
  const anchor = useRef<{ view: ViewMode; todayX: number } | null>(null)

  // Keep the viewport on the same dates when the axis grows. Adding months to
  // the past shifts every column right, so the scroll offset has to move with
  // them; without this, scrolling back in time would feel like a rubber band.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    const todayX = axis.colIndex(today) * axis.colW
    const previous = anchor.current
    anchor.current = { view: axis.view, todayX }
    expanding.current = false
    if (!el) return

    const jump = pendingJump.current
    if (jump) {
      pendingJump.current = null
      el.scrollLeft = Math.max(0, axis.colIndex(jump) * axis.colW - el.clientWidth / 2 + axis.colW / 2)
      return
    }

    if (previous && previous.view === axis.view) {
      const delta = todayX - previous.todayX
      if (delta !== 0) el.scrollLeft += delta
    }
  }, [axis, today])

  // Reaching either end grows the range rather than stopping the scroll.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => {
      if (expanding.current) return
      if (el.scrollLeft < EDGE_TRIGGER) {
        expanding.current = true
        dispatch({ type: 'expandAxis', direction: 'past' })
      } else if (el.scrollLeft + el.clientWidth > el.scrollWidth - EDGE_TRIGGER) {
        expanding.current = true
        dispatch({ type: 'expandAxis', direction: 'future' })
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [dispatch])

  const goToDate = useCallback(
    (date: string) => {
      if (!date) return
      const pad = padToReveal(axis, state.axisPad, date)
      if (pad) {
        // Out of range: grow first, centre in the layout effect that follows.
        pendingJump.current = date
        dispatch({ type: 'setAxisPad', pad })
      } else {
        centerOn(date)
      }
    },
    [axis, state.axisPad, dispatch, centerOn],
  )

  // Raw scrollLeft is meaningless across column scales, so recentre on mount and
  // after every view change rather than trying to preserve the offset.
  const centerRef = useRef(centerToday)
  centerRef.current = centerToday
  useEffect(() => {
    const id = setTimeout(() => centerRef.current(), 60)
    return () => clearTimeout(id)
  }, [state.view, state.hydrated])

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: C.canvas,
        fontFamily: SANS,
        color: C.text,
        overflow: 'hidden',
      }}
    >
      <TopBar
        onPrev={() => scrollByPage(-1)}
        onNext={() => scrollByPage(1)}
        onToday={centerToday}
        onGoToDate={goToDate}
      />
      <FilterBar />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Gutter axis={axis} />
        <Timeline axis={axis} scrollerRef={scrollerRef} />
      </div>

      {state.form && <ItemModal key={state.form.id ?? 'new'} />}
      {state.promote && <PromoteModal />}
      {state.trashOpen && <TrashDrawer />}
      {state.settingsOpen && <SettingsDrawer />}
    </div>
  )
}
